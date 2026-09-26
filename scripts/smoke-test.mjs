import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import { EVENTS } from '../dist-server/shared/events.js';
import { ROUND_CONTENT } from '../dist-server/shared/content.js';

const PORT = Number(process.env.TEST_PORT ?? 4123);
const URL = `http://localhost:${PORT}`;
const SCALE = Number(process.env.TIMER_SCALE ?? 0.2);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let checks = 0;
let failures = 0;
const allClients = [];
function check(label, condition) {
  checks += 1;
  if (condition) console.log(`  PASS  ${label}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${label}`);
  }
}

class Client {
  constructor(label, { host = false } = {}) {
    this.label = label;
    this.socket = io(URL, { query: { host: host ? '1' : '0' }, transports: ['websocket'] });
    this.states = [];
    this.ticks = [];
    this.toasts = [];
    this.successes = [];
    this.chunks = [];
    this.undos = [];
    this.clears = [];
    this.id = undefined;
    this.token = undefined;
    allClients.push(this);
    this.socket.on(EVENTS.roomState, (state) => {
      this.states.push(state);
      if (state.you) {
        this.id = state.you.id;
        this.token = state.you.token;
      }
    });
    this.socket.on(EVENTS.tick, (tick) => this.ticks.push(tick));
    this.socket.on(EVENTS.toast, (message) => this.toasts.push(message));
    this.socket.on(EVENTS.guessSuccess, (payload) => this.successes.push(payload));
    this.socket.on(EVENTS.strokeChunk, (chunk) => this.chunks.push(chunk));
    this.socket.on(EVENTS.undo, (payload) => this.undos.push(payload));
    this.socket.on(EVENTS.clearCanvas, () => this.clears.push(Date.now()));
    this.open = new Promise((resolve) => this.socket.on('connect', resolve));
  }
  get state() {
    return this.states[this.states.length - 1];
  }
  get live() {
    return this.socket.connected;
  }
  emit(event, payload) {
    this.socket.emit(event, payload);
  }
  async disconnect() {
    if (!this.socket.connected) return;
    await new Promise((resolve) => {
      this.socket.once('disconnect', resolve);
      this.socket.disconnect();
    });
  }
}

async function waitState(client, predicate, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = client.state;
    if (state && predicate(state)) return state;
    await sleep(40);
  }
  return undefined;
}

async function waitForTick(client, predicate, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = client.ticks.find(predicate);
    if (found) return found;
    await sleep(40);
  }
  return undefined;
}

function playerIn(state, id) {
  return state.players.find((player) => player.id === id);
}

function revealedCount(maskedWord) {
  if (!maskedWord) return 0;
  return [...maskedWord].filter((character) => character !== '•' && character !== ' ').length;
}

function totalSlots(maskedWord) {
  if (!maskedWord) return 0;
  return [...maskedWord].filter((character) => character !== ' ').length;
}

function aliasFor(word) {
  const content = ROUND_CONTENT.find((item) => item.word === word);
  return content.aliases[0];
}

const server = spawn(process.execPath, ['dist-server/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), TIMER_SCALE: String(SCALE) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (data) => process.stdout.write(`[server] ${data}`));
server.stderr.on('data', (data) => process.stderr.write(`[server-err] ${data}`));

async function main() {
  let healthy = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${URL}/healthz`);
      const body = await response.json();
      healthy = body.ok === true;
      if (healthy) break;
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  check('healthz responds ok', healthy);
  if (!healthy) throw new Error('server did not start');

  console.log('\n== Setup: host + 5 players ==');
  const host = new Client('host', { host: true });
  await host.open;
  await sleep(200);
  check('initial phase is lobby', host.state.phase === 'lobby');

  host.emit(EVENTS.startGame);
  await sleep(400);
  check('start rejected with fewer than 2 connected players', host.state.phase === 'lobby' && host.toasts.some((message) => message.includes('Cần ít nhất 2')));

  const players = [];
  for (const name of ['An', 'Bình', 'Chi', 'Dũng', 'Em']) {
    const client = new Client(name);
    players.push(client);
    await client.open;
    client.emit(EVENTS.joinRoom, { name });
  }
  await waitState(host, (state) => state.players.length === 5);
  check('5 players joined in order', host.state.players.length === 5 && host.state.players.map((player) => player.name).join(',') === 'An,Bình,Chi,Dũng,Em');
  check('players received identity tokens', players.every((client) => typeof client.id === 'string' && typeof client.token === 'string'));
  check('host without name has no you info', host.state.you === undefined);
  check('regular player does not see word choices', players[0].state.wordChoices === undefined);

  console.log('\n== Reaction rate limit ==');
  const reactionsBefore = host.state.recentReactions.length;
  for (let i = 0; i < 6; i += 1) players[4].emit(EVENTS.reaction, '🎉');
  await sleep(600);
  const reactionsAfter = host.state.recentReactions.length;
  check('reaction spam limited to at most 2', reactionsAfter - reactionsBefore >= 1 && reactionsAfter - reactionsBefore <= 2);

  console.log('\n== Round 1: full happy path ==');
  host.emit(EVENTS.startGame);
  await waitState(host, (state) => state.phase === 'drawing' && state.subPhase === 'choosing');
  check('game started into choosing', host.state.phase === 'drawing' && host.state.subPhase === 'choosing');
  check('round is 1', host.state.round === 1);

  const drawerClient = () => players.find((client) => client.live && client.id === host.state.drawerId);
  const guesserClients = () => players.filter((client) => client.live && client.id !== host.state.drawerId);
  const quizIndices = [];
  let previousDrawerId = undefined;

  const drawer1 = drawerClient();
  check('drawer is a joined player', Boolean(drawer1));
  check('drawer sees 3 word choices', Array.isArray(drawer1.state.wordChoices) && drawer1.state.wordChoices.length === 3);
  check('host sees word choices', host.state.wordChoices?.length === 3);
  previousDrawerId = drawer1.id;

  const g1 = guesserClients()[0];
  const g2 = guesserClients()[1];

  g1.emit(EVENTS.submitGuess, { guess: 'gia dinh hat nhan' });
  await sleep(350);
  check('guess before word selection is ignored', g1.successes.length === 0 && host.state.guessedPlayerIds.length === 0);

  const choices1 = drawer1.state.wordChoices;
  const chosenWord1 = choices1[0];
  drawer1.emit(EVENTS.chooseWord, { index: 0 });
  await waitState(host, (state) => state.subPhase === 'countdown');
  check('pre-draw countdown starts', host.state.subPhase === 'countdown');
  check('drawer sees private word', drawer1.state.privateWord === chosenWord1);
  check('guesser sees masked word', typeof g1.state.maskedWord === 'string' && g1.state.maskedWord.includes('•'));

  g1.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await sleep(80);
  check('guess during countdown is ignored', g1.successes.length === 0 && host.state.subPhase === 'countdown');

  await waitState(host, (state) => state.subPhase === 'drawing');
  check('drawing subphase after countdown', host.state.subPhase === 'drawing');

  console.log('\n== Stroke streaming, undo, clear ==');
  const viewer = guesserClients()[2];
  const viewerChunksBefore = viewer.chunks.length;
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-a', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }], color: '#242323', width: 5 });
  await sleep(120);
  check('live chunk broadcast to viewers', viewer.chunks.length === viewerChunksBefore + 1 && viewer.chunks[viewer.chunks.length - 1].id === 'stroke-a');
  check('chunk not echoed back to drawer', !drawer1.chunks.some((chunk) => chunk.id === 'stroke-a'));
  await sleep(80);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-a', points: [{ x: 0.4, y: 0.4 }], color: '#242323', width: 5 });
  await sleep(120);
  check('chunk extension delivered', viewer.chunks[viewer.chunks.length - 1].id === 'stroke-a' && viewer.chunks[viewer.chunks.length - 1].points.length === 1);

  await sleep(80);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-bad-size', points: Array.from({ length: 100 }, (_, index) => ({ x: index / 300, y: 0.5 })), color: '#242323', width: 5 });
  await sleep(80);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-bad-color', points: [{ x: 0.5, y: 0.5 }], color: 'red', width: 5 });
  await sleep(150);
  check('oversized chunk dropped', !viewer.chunks.some((chunk) => chunk.id === 'stroke-bad-size'));
  check('invalid color dropped', !viewer.chunks.some((chunk) => chunk.id === 'stroke-bad-color'));

  await sleep(80);
  drawer1.emit(EVENTS.undo);
  await sleep(150);
  check('undo broadcast with stroke id', viewer.undos.length > 0 && viewer.undos[viewer.undos.length - 1].id === 'stroke-a');
  await sleep(80);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-c', points: [{ x: 0.6, y: 0.6 }], color: '#d90429', width: 8 });
  await sleep(120);
  drawer1.emit(EVENTS.clearCanvas);
  await sleep(150);
  check('clear broadcast', viewer.clears.length > 0);

  const drawingTick = host.ticks.find((tick) => tick.phase === 'drawing' && tick.subPhase === 'drawing');
  check('tick stream is lightweight', Boolean(drawingTick) && !('strokes' in drawingTick) && JSON.stringify(drawingTick).length < 300);

  console.log('\n== Round 1: guesses + quiz shuffle ==');
  const scoreBefore1 = playerIn(host.state, g1.id).score;
  g1.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await waitState(host, (state) => state.phase === 'quiz');
  check('quiz phase after first correct guess', host.state.phase === 'quiz');
  const success1 = viewer.successes.find((payload) => payload.playerId === g1.id);
  check('guess success broadcast with 500 points', Boolean(success1) && success1.points === 500 && success1.position === 0);
  check('first guesser scored +500', playerIn(host.state, g1.id).score === scoreBefore1 + 500);

  g2.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await sleep(350);
  check('second guesser accepted during quiz', host.state.guessedPlayerIds.includes(g2.id));
  check('second guesser scored +380', playerIn(host.state, g2.id).score === 380);

  const content1 = ROUND_CONTENT.find((item) => item.word === chosenWord1);
  check('first guesser receives quiz', g1.state.quiz?.prompt === content1.quiz.prompt);
  check('quiz correct answer preserved after shuffle', g1.state.quiz.options[g1.state.quiz.correctIndex] === content1.quiz.options[content1.quiz.correctIndex]);
  quizIndices.push(g1.state.quiz.correctIndex);
  check('quiz hidden from other players', g2.state.quiz === undefined);

  g1.emit(EVENTS.submitQuiz, { answer: g1.state.quiz.correctIndex });
  await waitState(host, (state) => state.phase === 'reveal');
  check('reveal after correct quiz answer', host.state.phase === 'reveal' && host.state.reveal?.quizResult === 'correct');
  check('quiz correct awarded +400', playerIn(host.state, g1.id).score === scoreBefore1 + 900);
  check('summary recorded for round 1', host.state.summary?.length === 1 && host.state.summary[0].word === chosenWord1);
  check('drawer awarded for 2 guessers', playerIn(host.state, drawer1.id).score === 300);

  console.log('\n== Round 2: hints + wrong quiz ==');
  await waitState(host, (state) => state.phase === 'drawing' && state.subPhase === 'choosing' && state.round === 2);
  check('round 2 started', host.state.round === 2);
  const drawer2 = drawerClient();
  check('drawer rotates to a new player', drawer2.id !== previousDrawerId);
  previousDrawerId = drawer2.id;
  const choices2 = drawer2.state.wordChoices;
  drawer2.emit(EVENTS.chooseWord, { index: 1 });
  const chosenWord2 = choices2[1];
  await waitState(host, (state) => state.subPhase === 'drawing');

  const late = new Client('late-joiner');
  await late.open;
  late.emit(EVENTS.joinRoom, { name: 'Người Muộn' });
  await sleep(400);
  check('late join blocked mid-game', late.toasts.some((message) => message.includes('Ván chơi đang diễn ra')) && !host.state.players.some((player) => player.name === 'Người Muộn'));
  await late.disconnect();

  const hintTick1 = await waitForTick(host, (tick) => tick.phase === 'drawing' && tick.subPhase === 'drawing' && revealedCount(tick.maskedWord) >= 1, 9000);
  check('hint letters revealed at 30s mark', Boolean(hintTick1));
  const hintTick2 = await waitForTick(
    host,
    (tick) => tick.phase === 'drawing' && tick.subPhase === 'drawing' && revealedCount(tick.maskedWord) > revealedCount(hintTick1?.maskedWord ?? ''),
    9000,
  );
  check('more letters revealed at 15s mark', Boolean(hintTick2) && revealedCount(hintTick2?.maskedWord ?? '') > revealedCount(hintTick1?.maskedWord ?? ''));
  check('masked word never fully revealed', revealedCount(hintTick2?.maskedWord ?? '') < totalSlots(hintTick2?.maskedWord ?? ''));

  const round2Guessers = guesserClients();
  const wrongGuesser = round2Guessers.find((client) => !client.state.you?.hasGuessed);
  const wrongBefore = playerIn(host.state, wrongGuesser.id).score;
  wrongGuesser.emit(EVENTS.submitGuess, { guess: 'mot dap an sai hoan toan' });
  await sleep(350);
  check('wrong guess gets private feedback', wrongGuesser.toasts.some((message) => message.includes('Chưa đúng')));
  check('wrong guess scores nothing', playerIn(host.state, wrongGuesser.id).score === wrongBefore);

  const r2Guesser = round2Guessers.find((client) => client !== wrongGuesser);
  const r2Before = playerIn(host.state, r2Guesser.id).score;
  r2Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord2) });
  await waitState(host, (state) => state.phase === 'quiz');
  const content2 = ROUND_CONTENT.find((item) => item.word === chosenWord2);
  check('round 2 quiz correct answer preserved', r2Guesser.state.quiz.options[r2Guesser.state.quiz.correctIndex] === content2.quiz.options[content2.quiz.correctIndex]);
  quizIndices.push(r2Guesser.state.quiz.correctIndex);
  r2Guesser.emit(EVENTS.submitQuiz, { answer: (r2Guesser.state.quiz.correctIndex + 1) % 4 });
  await waitState(host, (state) => state.phase === 'reveal');
  check('wrong quiz answer −200', playerIn(host.state, r2Guesser.id).score === r2Before + 500 - 200);
  check('reveal shows incorrect result', host.state.reveal?.quizResult === 'incorrect');

  console.log('\n== Round 3: reconnect + quiz timeout ==');
  await waitState(host, (state) => state.phase === 'drawing' && state.round === 3 && state.subPhase === 'choosing');
  const drawer3 = drawerClient();
  previousDrawerId = drawer3.id;
  const choices3 = drawer3.state.wordChoices;
  drawer3.emit(EVENTS.chooseWord, { index: 2 });
  const chosenWord3 = choices3[2];
  await waitState(host, (state) => state.subPhase === 'drawing');

  const victim = guesserClients()[0];
  const victimId = victim.id;
  const victimToken = victim.token;
  const victimScore = playerIn(host.state, victimId).score;
  await victim.disconnect();
  await waitState(host, (state) => !playerIn(state, victimId).connected);
  check('disconnect marks player offline', playerIn(host.state, victimId).connected === false);

  const reconnected = new Client(`${victim.label}-re`);
  await reconnected.open;
  reconnected.emit(EVENTS.joinRoom, { name: victim.label, playerId: victimId, token: victimToken });
  await waitState(host, (state) => playerIn(state, victimId)?.connected === true);
  check('reconnect reattaches same identity', reconnected.id === victimId && reconnected.token === victimToken);
  check('reconnect preserves score', playerIn(host.state, victimId).score === victimScore);
  check('reconnect does not duplicate player entry', host.state.players.length === 5);
  check('reconnect welcomed back', reconnected.toasts.some((message) => message.includes('Kết nối lại thành công')));
  players[players.indexOf(victim)] = reconnected;

  const r3Guesser = guesserClients().find((client) => !client.state.you?.hasGuessed);
  const r3Before = playerIn(host.state, r3Guesser.id).score;
  r3Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord3) });
  await waitState(host, (state) => state.phase === 'quiz');
  const r3FirstGuesserId = host.state.firstGuesserId;
  check('round 3 quiz underway', playerIn(host.state, r3FirstGuesserId).score === r3Before + 500);
  await waitState(host, (state) => state.phase === 'reveal' && state.reveal?.quizResult === 'timeout', 9000);
  check('unanswered quiz times out at −100', playerIn(host.state, r3FirstGuesserId).score === r3Before + 500 - 100);

  console.log('\n== Round 4: drawer disconnect + replacement + auto-pick ==');
  await waitState(host, (state) => state.phase === 'drawing' && state.round === 4 && state.subPhase === 'choosing');
  const abandonedDrawer = drawerClient();
  const abandonedDrawerId = abandonedDrawer.id;
  await abandonedDrawer.disconnect();
  const replaced = await waitState(
    host,
    (state) => state.drawerId && state.drawerId !== abandonedDrawerId && state.round === 4 && state.subPhase === 'choosing',
    8000,
  );
  check('replacement drawer chosen after grace', Boolean(replaced));
  check('round number unchanged after replacement', replaced?.round === 4);
  const newDrawer = players.find((client) => client.live && client.id === replaced?.drawerId);
  const choicesSeen = await waitState(newDrawer, (state) => Array.isArray(state.wordChoices) && state.wordChoices.length >= 1, 5000);
  const replacementChoices = choicesSeen?.wordChoices;
  check('replacement drawer sees fresh word choices', Array.isArray(replacementChoices) && replacementChoices.length >= 1);
  const autoPickState = await waitState(newDrawer, (state) => state.privateWord !== undefined, 6000);
  check('auto-pick when replacement drawer is idle', Boolean(autoPickState?.privateWord) && autoPickState.privateWord === replacementChoices?.[0]);
  await waitState(host, (state) => state.subPhase === 'drawing');

  const r4Guesser = guesserClients().find((client) => !client.state.you?.hasGuessed);
  r4Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(autoPickState.privateWord) });
  await waitState(host, (state) => state.phase === 'quiz');
  const r4Answerer = players.find((client) => client.id === host.state.firstGuesserId);
  quizIndices.push(r4Answerer.state.quiz.correctIndex);
  r4Answerer.emit(EVENTS.submitQuiz, { answer: r4Answerer.state.quiz.correctIndex });
  await waitState(host, (state) => state.phase === 'reveal');

  console.log('\n== Rounds 5-7: finish the game ==');
  for (const roundNumber of [5, 6, 7]) {
    await waitState(host, (state) => state.phase === 'drawing' && state.round === roundNumber && state.subPhase === 'choosing');
    const roundDrawer = drawerClient();
    if (roundNumber === 7) {
      check('final round has a single remaining word', roundDrawer.state.wordChoices?.length === 1);
    }
    const roundChoices = roundDrawer.state.wordChoices;
    roundDrawer.emit(EVENTS.chooseWord, { index: 0 });
    const chosenWord = roundChoices[0];
    await waitState(host, (state) => state.subPhase === 'drawing');
    const answerer = guesserClients().find((client) => !client.state.you?.hasGuessed);
    answerer.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord) });
    await waitState(host, (state) => state.phase === 'quiz');
    quizIndices.push(answerer.state.quiz.correctIndex);
    answerer.emit(EVENTS.submitQuiz, { answer: answerer.state.quiz.correctIndex });
    await waitState(host, (state) => state.phase === 'reveal');
    if (roundNumber === 7) {
      await waitState(host, (state) => state.phase === 'finished', 9000);
    }
  }

  check('game finished after 7 rounds', host.state.phase === 'finished');
  check('summary contains all 7 rounds', host.state.summary?.length === 7);
  const summaryWords = host.state.summary.map((item) => item.word);
  check('no repeated words across the game', new Set(summaryWords).size === 7);
  check('quiz answer positions are shuffled', new Set(quizIndices).size >= 2);
  const livePlayer = players.find((client) => client.live);
  await waitState(livePlayer, (state) => state.phase === 'finished', 6000);
  check('summary visible to regular players after finish', livePlayer.state.summary?.length === 7);
  check('someone has a positive score', host.state.players.some((player) => player.score > 0));

  console.log('\n== Restart: play again ==');
  host.emit(EVENTS.nextRound);
  await waitState(host, (state) => state.phase === 'lobby');
  check('next_round returns room to lobby', host.state.phase === 'lobby');
  check('scores reset for new game', host.state.players.every((player) => player.score === 0));
  check('summary cleared', host.state.summary?.length === 0);

  host.emit(EVENTS.startGame);
  const restarted = await waitState(host, (state) => state.phase === 'drawing' && state.round === 1 && state.subPhase === 'choosing');
  check('second game starts from round 1', Boolean(restarted));
  const restartDrawer = drawerClient();
  check('word pool refilled after restart', restartDrawer.state.wordChoices?.length === 3);

  console.log('\n== Cleanup ==');
  for (const client of [host, ...players]) await client.disconnect();
}

main()
  .then(() => {
    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) {
      console.log(`SMOKE TEST FAILED: ${failures} failing checks`);
      process.exitCode = 1;
    } else {
      console.log('SMOKE TEST PASSED');
    }
  })
  .catch((error) => {
    console.error('SMOKE TEST CRASHED:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    server.kill();
    for (const client of allClients) {
      try {
        client.socket.disconnect();
      } catch {
        /* ignore */
      }
    }
    setTimeout(() => process.exit(process.exitCode ?? 0), 300);
  });
