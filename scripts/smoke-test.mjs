import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import { EVENTS, PROJECTOR_PASSWORD_QUERY, PROJECTOR_REJECTED_ERROR } from '../dist-server/shared/events.js';
import { PROJECTOR_PASSWORD } from '../dist-server/shared/projector.js';
import { ROUND_CONTENT } from '../dist-server/shared/content.js';

const PORT = Number(process.env.TEST_PORT ?? 4123);
const URL = `http://localhost:${PORT}`;
const SCALE = Number(process.env.TIMER_SCALE ?? 0.4);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Game seconds -> real milliseconds, so timeouts follow the game clock instead of a magic number.
const gameMs = (seconds) => Math.round(seconds * 1000 * SCALE);
const DRAW_SECONDS = 75;

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
  constructor(label, { projector = false } = {}) {
    this.label = label;
    this.socket = io(URL, {
      query: projector
        ? { projector: '1', [PROJECTOR_PASSWORD_QUERY]: PROJECTOR_PASSWORD }
        : { projector: '0' },
      transports: ['websocket'],
    });
    this.states = [];
    this.ticks = [];
    this.toasts = [];
    this.successes = [];
    this.reactions = [];
    this.chunks = [];
    this.undos = [];
    this.clears = [];
    this.erases = [];
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
    this.socket.on(EVENTS.reaction, (payload) => this.reactions.push(payload));
    this.socket.on(EVENTS.guessSuccess, (payload) => this.successes.push(payload));
    this.socket.on(EVENTS.strokeChunk, (chunk) => this.chunks.push(chunk));
    this.socket.on(EVENTS.undo, (payload) => this.undos.push(payload));
    this.socket.on(EVENTS.clearCanvas, () => this.clears.push(Date.now()));
    this.socket.on(EVENTS.erase, (payload) => this.erases.push(payload));
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

// The quiz opens after all connected guessers answer or the drawing clock expires.
async function waitForQuiz(client) {
  const state = await waitState(client, (next) => next.phase === 'quiz', gameMs(DRAW_SECONDS) + 12000);
  return state;
}

async function waitFor(predicate, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true;
    await sleep(8);
  }
  return predicate();
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

  console.log('\n== Projector password gate ==');
  const lockedSocket = io(URL, {
    query: { projector: '1', [PROJECTOR_PASSWORD_QUERY]: 'sai-mat-khau' },
    transports: ['websocket'],
    reconnection: false,
  });
  const rejection = await new Promise((resolve) => {
    lockedSocket.on('connect_error', resolve);
    lockedSocket.on('connect', () => resolve(new Error('connected without password')));
    setTimeout(() => resolve(new Error('no rejection')), 3000);
  });
  check('projector with a wrong password is rejected', rejection.message === PROJECTOR_REJECTED_ERROR);
  lockedSocket.close();

  console.log('\n== Setup: projector + 5 players ==');
  const projector = new Client('projector', { projector: true });
  await projector.open;
  await sleep(200);
  check('initial phase is lobby', projector.state.phase === 'lobby');

  projector.emit(EVENTS.startGame);
  await sleep(400);
  check('start rejected with fewer than 2 connected players', projector.state.phase === 'lobby' && projector.toasts.some((message) => message.includes('Cần ít nhất 2')));

  const players = [];
  for (const name of ['An', 'Bình', 'Chi', 'Dũng', 'Em']) {
    const client = new Client(name);
    players.push(client);
    await client.open;
    client.emit(EVENTS.joinRoom, { name });
  }
  await waitState(projector, (state) => state.players.length === 5);
  check('5 players joined in order', projector.state.players.length === 5 && projector.state.players.map((player) => player.name).join(',') === 'An,Bình,Chi,Dũng,Em');
  check('players received identity tokens', players.every((client) => typeof client.id === 'string' && typeof client.token === 'string'));
  check('projector without name has no you info', projector.state.you === undefined);
  check('regular player does not see word choices', players[0].state.wordChoices === undefined);
  players[0].emit(EVENTS.startGame);
  await sleep(80);
  check('regular player cannot start the game', projector.state.phase === 'lobby');

  console.log('\n== Answer normalisation rules ==');
  const isAscii = (text) => /^[\x00-\x7F]*$/.test(text);
  const stripDiacritics = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  check(
    'no Vietnamese answer is missing its diacritics',
    ROUND_CONTENT.every((item) =>
      [item.word, ...item.aliases].every((answer) => isAscii(answer) || stripDiacritics(answer) !== answer.toLocaleLowerCase('vi-VN')),
    ),
  );
  check('question bank has at least 30 unique family words', ROUND_CONTENT.length >= 30 && new Set(ROUND_CONTENT.map((item) => item.word)).size === ROUND_CONTENT.length);
  check('every word has a complete ABCD quiz', ROUND_CONTENT.every((item) => item.quiz.prompt && item.quiz.options.length === 4 && new Set(item.quiz.options).size === 4 && item.quiz.correctIndex >= 0 && item.quiz.correctIndex < 4));

  console.log('\n== Reactions have no rate limit ==');
  const reactionsBefore = projector.reactions.length;
  for (let i = 0; i < 6; i += 1) players[4].emit(EVENTS.reaction, '😭');
  await waitFor(() => projector.reactions.length >= reactionsBefore + 6);
  check('reaction spam is not rate limited', projector.reactions.length >= reactionsBefore + 6);
  check('reaction payload carries the emoji', projector.reactions.slice(-6).every((item) => item.reaction === '😭' && typeof item.id === 'string'));
  players[4].emit(EVENTS.reaction, '');
  await sleep(300);
  check('empty reaction is dropped', projector.reactions.length === reactionsBefore + 6);
  players[4].emit(EVENTS.reaction, '⛄');
  await sleep(300);
  check('unsupported reaction is dropped', projector.reactions.length === reactionsBefore + 6);

  console.log('\n== Round 1: full happy path ==');
  projector.emit(EVENTS.startGame);
  await waitState(projector, (state) => state.phase === 'drawing' && state.subPhase === 'choosing');
  check('game started into choosing', projector.state.phase === 'drawing' && projector.state.subPhase === 'choosing');
  check('round is 1', projector.state.round === 1);
  check('game has 10 rounds', projector.state.totalRounds === 10);

  const drawerClient = () => players.find((client) => client.live && client.id === projector.state.drawerId);
  const guesserClients = () => players.filter((client) => client.live && client.id !== projector.state.drawerId);
  const quizIndices = [];
  let previousDrawerId = undefined;

  const drawer1 = drawerClient();
  check('drawer is a joined player', Boolean(drawer1));
  check('drawer sees 3 word choices', Array.isArray(drawer1.state.wordChoices) && drawer1.state.wordChoices.length === 3);
  check('projector sees word choices', projector.state.wordChoices?.length === 3);
  previousDrawerId = drawer1.id;

  const g1 = guesserClients()[0];
  const g2 = guesserClients()[1];

  g1.emit(EVENTS.submitGuess, { guess: 'gia dinh hat nhan' });
  await sleep(350);
  check('guess before word selection is ignored', g1.successes.length === 0 && projector.state.guessedPlayerIds.length === 0);

  const choices1 = drawer1.state.wordChoices;
  const chosenWord1 = choices1[0];
  drawer1.emit(EVENTS.chooseWord, { index: 0 });
  await waitState(projector, (state) => state.subPhase === 'countdown');
  check('pre-draw countdown starts', projector.state.subPhase === 'countdown');
  check('drawer sees private word', drawer1.state.privateWord === chosenWord1);
  check('guesser sees masked word', typeof g1.state.maskedWord === 'string' && g1.state.maskedWord.includes('•'));

  g1.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await sleep(80);
  check('guess during countdown is ignored', g1.successes.length === 0 && projector.state.subPhase === 'countdown');

  await waitState(projector, (state) => state.subPhase === 'drawing');
  check('drawing subphase after countdown', projector.state.subPhase === 'drawing');
  check('drawing timer starts at 75 seconds', projector.state.secondsLeft <= DRAW_SECONDS && projector.state.secondsLeft >= DRAW_SECONDS - 1);

  console.log('\n== Stroke streaming, undo, clear ==');
  const viewer = guesserClients()[2];
  const viewerChunksBefore = viewer.chunks.length;
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-a', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }], color: '#242323', width: 5 });
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-a', points: [{ x: 0.4, y: 0.4 }], color: '#242323', width: 5 });
  await waitFor(() => viewer.chunks.length >= viewerChunksBefore + 2);
  check('live chunk broadcast to viewers', viewer.chunks[viewerChunksBefore]?.id === 'stroke-a');
  check('chunk not echoed back to drawer', !drawer1.chunks.some((chunk) => chunk.id === 'stroke-a'));
  check('rapid chunk extension delivered', viewer.chunks[viewer.chunks.length - 1].id === 'stroke-a' && viewer.chunks[viewer.chunks.length - 1].points.length === 1);

  await sleep(30);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-bad-size', points: Array.from({ length: 100 }, (_, index) => ({ x: index / 300, y: 0.5 })), color: '#242323', width: 5 });
  await sleep(30);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-bad-color', points: [{ x: 0.5, y: 0.5 }], color: 'red', width: 5 });
  await sleep(80);
  check('oversized chunk dropped', !viewer.chunks.some((chunk) => chunk.id === 'stroke-bad-size'));
  check('invalid color dropped', !viewer.chunks.some((chunk) => chunk.id === 'stroke-bad-color'));

  await sleep(30);
  drawer1.emit(EVENTS.undo);
  await waitFor(() => viewer.undos.length > 0);
  check('undo broadcast with stroke id', viewer.undos.length > 0 && viewer.undos[viewer.undos.length - 1].id === 'stroke-a');
  await sleep(30);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-c', points: [{ x: 0.6, y: 0.6 }], color: '#d90429', width: 8 });
  await sleep(30);
  const fillBefore = viewer.chunks.length;
  drawer1.emit(EVENTS.strokeChunk, { id: 'fill-a', points: [{ x: 0.5, y: 0.5 }], color: '#1769e8', width: 1, tool: 'fill' });
  await waitFor(() => viewer.chunks.length > fillBefore);
  check('fill tool action is broadcast', viewer.chunks.length === fillBefore + 1 && viewer.chunks.at(-1)?.tool === 'fill');
  await sleep(30);
  drawer1.emit(EVENTS.undo);
  await waitFor(() => viewer.undos.at(-1)?.id === 'fill-a');
  check('undo removes the fill action', viewer.undos.at(-1)?.id === 'fill-a');
  const eraserBefore = viewer.chunks.length;
  drawer1.emit(EVENTS.strokeChunk, { id: 'erase-a', points: [{ x: 0.45, y: 0.45 }, { x: 0.5, y: 0.5 }], color: '#ffffff', width: 28, tool: 'erase' });
  await waitFor(() => viewer.chunks.length > eraserBefore);
  check('eraser is broadcast as an ordered drawing action', viewer.chunks.at(-1)?.id === 'erase-a' && viewer.chunks.at(-1)?.tool === 'erase');
  await sleep(30);
  drawer1.emit(EVENTS.undo);
  await waitFor(() => viewer.undos.at(-1)?.id === 'erase-a');
  check('undo removes the eraser action', viewer.undos.at(-1)?.id === 'erase-a');
  await sleep(30);
  drawer1.emit(EVENTS.clearCanvas);
  await waitFor(() => viewer.clears.length > 0);
  check('clear broadcast', viewer.clears.length > 0);

  console.log('\n== Eraser splits strokes ==');
  const eraseLine = Array.from({ length: 17 }, (_, index) => ({ x: 0.1 + index * 0.05, y: 0.5 }));
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-erase', points: eraseLine.slice(0, 9), color: '#242323', width: 5 });
  await sleep(30);
  drawer1.emit(EVENTS.strokeChunk, { id: 'stroke-erase', points: eraseLine.slice(9), color: '#242323', width: 5 });
  await sleep(30);

  const erasesBefore = viewer.erases.length;
  drawer1.emit(EVENTS.erase, { x: 0.5, y: 0.5, radius: 0.06, aspect: 0.5 });
  await waitFor(() => viewer.erases.length > erasesBefore);
  const erasePayload = viewer.erases[viewer.erases.length - 1];
  const erasePieces = erasePayload?.strokes?.filter((stroke) => stroke.points.length > 0) ?? [];
  check('erase broadcast to viewers', viewer.erases.length === erasesBefore + 1 && Array.isArray(erasePayload?.strokes));
  check('eraser cuts the stroke into two pieces', erasePieces.length === 2);
  check('erased points are removed', erasePieces.every((stroke) => stroke.points.every((point) => Math.abs(point.x - 0.5) > 0.03 || Math.abs(point.y - 0.5) > 0.03)));
  check('erase echoed to the drawer too', drawer1.erases.length > 0);

  await sleep(50);
  const erasesBeforeNoop = viewer.erases.length;
  drawer1.emit(EVENTS.erase, { x: 0.5, y: 0.5, radius: 0.06, aspect: 0.5 });
  await sleep(50);
  drawer1.emit(EVENTS.erase, { x: 0.5, y: 0.5, radius: 99, aspect: 0.5 });
  await sleep(50);
  guesserClients()[0]?.emit(EVENTS.erase, { x: 0.2, y: 0.5, radius: 0.06, aspect: 0.5 });
  await sleep(120);
  check('re-erasing the gap is a no-op', viewer.erases.length === erasesBeforeNoop);
  check('out-of-range erase radius dropped', viewer.erases.length === erasesBeforeNoop);
  check('non-drawer cannot erase', viewer.erases.length === erasesBeforeNoop);

  const drawingTick = projector.ticks.find((tick) => tick.phase === 'drawing' && tick.subPhase === 'drawing');
  check('tick stream is lightweight', Boolean(drawingTick) && !('strokes' in drawingTick) && JSON.stringify(drawingTick).length < 300);

  console.log('\n== Round 1: guesses + quiz shuffle ==');
  const accentProbe = guesserClients()[3];
  const successesBeforeAccentProbe = viewer.successes.length;
  accentProbe.emit(EVENTS.submitGuess, { guess: stripDiacritics(chosenWord1).toLocaleLowerCase('vi-VN') });
  await sleep(300);
  check(
    'answer without diacritics is rejected',
    viewer.successes.length === successesBeforeAccentProbe && !projector.state.guessedPlayerIds.includes(accentProbe.id),
  );
  check('unaccented answer explains the diacritic rule', accentProbe.toasts.some((message) => message.includes('thiếu dấu')));

  const scoreBefore1 = playerIn(projector.state, g1.id).score;
  g1.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await waitState(projector, (state) => state.firstGuesserId === g1.id);
  check(
    'clock keeps running after the first correct guess',
    projector.state.phase === 'drawing' && projector.state.secondsLeft > 0 && projector.state.quiz === undefined,
  );
  check(
    'projector shows the first guesser name while the class keeps guessing',
    playerIn(projector.state, g1.id)?.name === g1.label && projector.state.firstGuesserId === g1.id,
  );
  const success1 = viewer.successes.find((payload) => payload.playerId === g1.id);
  check('first guesser gets fast-guess points (150-500)', Boolean(success1) && success1.position === 0 && success1.points >= 150 && success1.points <= 500);
  check('first guesser score matches broadcast points', Boolean(success1) && playerIn(projector.state, g1.id).score === scoreBefore1 + success1.points);

  // Wait long enough that the late guesser is charged at least one full second of waiting.
  await sleep(1300);
  g2.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  await sleep(350);
  check('second guesser accepted while the clock keeps running', projector.state.guessedPlayerIds.includes(g2.id) && projector.state.phase === 'drawing');
  const success2 = viewer.successes.find((payload) => payload.playerId === g2.id);
  check('second guesser scores less than first (time + order)', Boolean(success1) && Boolean(success2) && success2.position === 1 && success2.points >= 100 && success2.points <= 450 && success2.points < success1.points && playerIn(projector.state, g2.id).score === success2.points);
  check('late guesser loses time points, not just the order bonus', Boolean(success1) && Boolean(success2) && success2.points < success1.points - 50);

  accentProbe.emit(EVENTS.submitGuess, { guess: chosenWord1.toLocaleUpperCase('vi-VN') });
  await sleep(350);
  check(
    'answer is accepted regardless of letter case',
    projector.state.guessedPlayerIds.includes(accentProbe.id) && playerIn(projector.state, accentProbe.id).score > 0,
  );

  const lastGuesser = guesserClients().find((client) => ![g1, g2, accentProbe].includes(client));
  check(
    'quiz waits while a connected guesser has not answered',
    projector.state.phase === 'drawing' && projector.state.guessedPlayerIds.length === 3,
  );
  const secondsBeforeLastGuesser = projector.state.secondsLeft;
  lastGuesser.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord1) });
  const quizOpenedBeforeTimeout = secondsBeforeLastGuesser > 3 && await waitFor(() => projector.state.phase === 'quiz', 3000);
  check('quiz opens before the timer when the last connected guesser is correct', quizOpenedBeforeTimeout);
  await waitForQuiz(g1);
  check(
    'quiz opens as soon as every connected guesser answers correctly',
    projector.state.phase === 'quiz' && projector.state.secondsLeft === 0 && projector.state.guessedPlayerIds.length === 4,
  );

  const content1 = ROUND_CONTENT.find((item) => item.word === chosenWord1);
  check('first guesser receives quiz', g1.state.quiz?.prompt === content1.quiz.prompt);
  check('quiz correct answer preserved after shuffle', g1.state.quiz.options[g1.state.quiz.correctIndex] === content1.quiz.options[content1.quiz.correctIndex]);
  quizIndices.push(g1.state.quiz.correctIndex);
  check('quiz hidden from other players', g2.state.quiz === undefined);
  check('quiz visible on projector', projector.state.quiz?.prompt === content1.quiz.prompt);

  g1.emit(EVENTS.submitQuiz, { answer: g1.state.quiz.correctIndex });
  await waitFor(() => projector.state.quizAnswered === true);
  check('answer locks in without finishing the round', projector.state.phase === 'quiz' && projector.state.quizAnswered === true);
  check('projector sees chosen option before reveal', projector.state.quizAnswer === g1.state.quiz.correctIndex);
  check('chosen option hidden from other players', g2.state.quizAnswer === undefined);
  g1.emit(EVENTS.submitQuiz, { answer: (g1.state.quiz.correctIndex + 1) % 4 });
  await sleep(300);
  check('locked answer cannot be changed', projector.state.phase === 'quiz' && projector.state.quizAnswered === true);
  check('no quiz points applied before projector reveals', Boolean(success1) && playerIn(projector.state, g1.id).score === scoreBefore1 + success1.points);
  projector.emit(EVENTS.revealQuiz);
  await waitState(projector, (state) => state.phase === 'reveal');
  check('reveal after projector opens the answer', projector.state.phase === 'reveal' && projector.state.reveal?.quizResult === 'correct');
  check('quiz correct awarded +400', Boolean(success1) && playerIn(projector.state, g1.id).score === scoreBefore1 + success1.points + 400);
  check('reveal carries the correct answer', projector.state.reveal?.answer === content1.quiz.options[content1.quiz.correctIndex]);
  check('summary recorded for round 1', projector.state.summary?.length === 1 && projector.state.summary[0].word === chosenWord1);
  check('drawer awarded 500 when all 4 guessers answer correctly', projector.state.guessedPlayerIds.length === 4 && playerIn(projector.state, drawer1.id).score === 500);
  projector.emit(EVENTS.advanceRound);

  console.log('\n== Round 2: word length + wrong quiz ==');
  await waitState(projector, (state) => state.phase === 'drawing' && state.subPhase === 'choosing' && state.round === 2);
  check('round 2 started', projector.state.round === 2);
  const drawer2 = drawerClient();
  check('drawer rotates to a new player', drawer2.id !== previousDrawerId);
  previousDrawerId = drawer2.id;
  const drawer2Before = playerIn(projector.state, drawer2.id).score;
  const choices2 = drawer2.state.wordChoices;
  drawer2.emit(EVENTS.chooseWord, { index: 1 });
  const chosenWord2 = choices2[1];
  await waitState(projector, (state) => state.subPhase === 'drawing');

  const late = new Client('late-joiner');
  await late.open;
  late.emit(EVENTS.joinRoom, { name: 'Người Muộn' });
  await sleep(400);
  check('late join blocked mid-game', late.toasts.some((message) => message.includes('Ván chơi đang diễn ra')) && !projector.state.players.some((player) => player.name === 'Người Muộn'));
  await late.disconnect();

  const initialMasked = projector.state.maskedWord;
  await sleep(gameMs(20));
  check('word length is visible and letters stay masked', Boolean(initialMasked) && revealedCount(initialMasked) === 0 && totalSlots(initialMasked) > 0 && projector.state.maskedWord === initialMasked);

  const round2Guessers = guesserClients();
  const wrongGuesser = round2Guessers.find((client) => !client.state.you?.hasGuessed);
  const wrongBefore = playerIn(projector.state, wrongGuesser.id).score;
  wrongGuesser.emit(EVENTS.submitGuess, { guess: 'mot dap an sai hoan toan' });
  await sleep(350);
  check('wrong guess gets private feedback', wrongGuesser.toasts.some((message) => message.includes('Chưa đúng')));
  check('wrong guess scores nothing', playerIn(projector.state, wrongGuesser.id).score === wrongBefore);

  const r2Guesser = round2Guessers.find((client) => client !== wrongGuesser);
  const r2Before = playerIn(projector.state, r2Guesser.id).score;
  const round2Live = await waitState(projector, (state) => state.phase === 'drawing' && state.subPhase === 'drawing', 2000);
  check('round 2 still drawing when the correct guess is sent', Boolean(round2Live));
  // successes accumulate for the whole session, so drop round 1 events before looking this one up.
  r2Guesser.successes.length = 0;
  r2Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord2) });
  await waitForQuiz(r2Guesser);
  const r2Success = r2Guesser.successes.find((payload) => payload.playerId === r2Guesser.id);
  check('round 2 first guess is recorded as position 0', Boolean(r2Success) && r2Success.position === 0);
  check('round 2 first guess earns time-based points', Boolean(r2Success) && r2Success.points >= 150 && r2Success.points <= 500);
  const content2 = ROUND_CONTENT.find((item) => item.word === chosenWord2);
  check('round 2 quiz correct answer preserved', r2Guesser.state.quiz.options[r2Guesser.state.quiz.correctIndex] === content2.quiz.options[content2.quiz.correctIndex]);
  const guessedBeforeQuiz = projector.state.guessedPlayerIds.length;
  const notYetGuessed = round2Guessers.find((client) => !projector.state.guessedPlayerIds.includes(client.id));
  notYetGuessed?.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord2) });
  await sleep(80);
  check('guessing closes when the timeout opens the quiz', projector.state.guessedPlayerIds.length === guessedBeforeQuiz);
  quizIndices.push(r2Guesser.state.quiz.correctIndex);
  r2Guesser.emit(EVENTS.submitQuiz, { answer: (r2Guesser.state.quiz.correctIndex + 1) % 4 });
  await waitFor(() => projector.state.quizAnswered === true);
  check('wrong answer locks in without finishing the round', projector.state.phase === 'quiz' && projector.state.quizAnswered === true);
  projector.emit(EVENTS.revealQuiz);
  await waitState(projector, (state) => state.phase === 'reveal');
  check('wrong quiz answer −200', Boolean(r2Success) && playerIn(projector.state, r2Guesser.id).score === r2Before + r2Success.points - 200);
  check('reveal shows incorrect result', projector.state.reveal?.quizResult === 'incorrect');
  check('drawer awarded 125 for 1 of 4 guessers', playerIn(projector.state, drawer2.id).score === drawer2Before + 125);
  projector.emit(EVENTS.advanceRound);

  console.log('\n== Round 3: reconnect + skipped quiz ==');
  await waitState(projector, (state) => state.phase === 'drawing' && state.round === 3 && state.subPhase === 'choosing');
  const drawer3 = drawerClient();
  previousDrawerId = drawer3.id;
  const choices3 = drawer3.state.wordChoices;
  drawer3.emit(EVENTS.chooseWord, { index: 2 });
  const chosenWord3 = choices3[2];
  await waitState(projector, (state) => state.subPhase === 'drawing');

  drawer3.emit(EVENTS.strokeChunk, { id: 'persist-line', points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }], color: '#242323', width: 5 });
  drawer3.emit(EVENTS.strokeChunk, { id: 'persist-line', points: [{ x: 0.3, y: 0.3 }], color: '#242323', width: 5 });
  drawer3.emit(EVENTS.strokeChunk, { id: 'persist-fill', points: [{ x: 0.4, y: 0.4 }], color: '#1769e8', width: 1, tool: 'fill' });
  drawer3.emit(EVENTS.strokeChunk, { id: 'persist-erase', points: [{ x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }], color: '#ffffff', width: 28, tool: 'erase' });
  await sleep(80);

  const victim = guesserClients()[0];
  const victimId = victim.id;
  const victimToken = victim.token;
  const victimScore = playerIn(projector.state, victimId).score;
  await victim.disconnect();
  await waitState(projector, (state) => !playerIn(state, victimId).connected);
  check('disconnect marks player offline', playerIn(projector.state, victimId).connected === false);

  const reconnected = new Client(`${victim.label}-re`);
  await reconnected.open;
  reconnected.emit(EVENTS.joinRoom, { name: victim.label, playerId: victimId, token: victimToken });
  await waitState(projector, (state) => playerIn(state, victimId)?.connected === true);
  check('reconnect reattaches same identity', reconnected.id === victimId && reconnected.token === victimToken);
  const persistedIds = reconnected.state.strokes.map((stroke) => stroke.id);
  check(
    'reconnect restores strokes, fill, and eraser in drawing order',
    persistedIds.indexOf('persist-line') < persistedIds.indexOf('persist-fill') && persistedIds.indexOf('persist-fill') < persistedIds.indexOf('persist-erase'),
  );
  check(
    'reconnect restores all points across stroke chunks',
    reconnected.state.strokes.find((stroke) => stroke.id === 'persist-line')?.points.length === 3,
  );
  check('reconnect preserves score', playerIn(projector.state, victimId).score === victimScore);
  check('reconnect does not duplicate player entry', projector.state.players.length === 5);
  check('reconnect welcomed back', reconnected.toasts.some((message) => message.includes('Kết nối lại thành công')));
  players[players.indexOf(victim)] = reconnected;

  const r3Guesser = guesserClients().find((client) => !client.state.you?.hasGuessed);
  const r3Before = playerIn(projector.state, r3Guesser.id).score;
  r3Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord3) });
  await waitForQuiz(r3Guesser);
  const r3FirstGuesserId = projector.state.firstGuesserId;
  const r3Success = r3Guesser.successes.find((payload) => payload.playerId === r3Guesser.id);
  check('round 3 quiz underway', Boolean(r3Success) && playerIn(projector.state, r3FirstGuesserId).score === r3Before + r3Success.points);
  r3Guesser.emit(EVENTS.revealQuiz);
  await sleep(300);
  check('non-projector cannot open the answer', projector.state.phase === 'quiz' && projector.state.quizAnswered !== true);
  projector.emit(EVENTS.revealQuiz);
  await waitState(projector, (state) => state.phase === 'reveal' && state.reveal?.quizResult === 'not_asked');
  check('skipped quiz reveals not_asked with no penalty', Boolean(r3Success) && playerIn(projector.state, r3FirstGuesserId).score === r3Before + r3Success.points);
  projector.emit(EVENTS.advanceRound);

  console.log('\n== Round 4: drawer disconnect + replacement + auto-pick ==');
  await waitState(projector, (state) => state.phase === 'drawing' && state.round === 4 && state.subPhase === 'choosing');
  const abandonedDrawer = drawerClient();
  const abandonedDrawerId = abandonedDrawer.id;
  await abandonedDrawer.disconnect();
  const replaced = await waitState(
    projector,
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
  await waitState(projector, (state) => state.subPhase === 'drawing');

  const r4Guesser = guesserClients().find((client) => !client.state.you?.hasGuessed);
  r4Guesser.emit(EVENTS.submitGuess, { guess: aliasFor(autoPickState.privateWord) });
  await waitForQuiz(r4Guesser);
  const r4Answerer = players.find((client) => client.id === projector.state.firstGuesserId);
  quizIndices.push(r4Answerer.state.quiz.correctIndex);
  r4Answerer.emit(EVENTS.submitQuiz, { answer: r4Answerer.state.quiz.correctIndex });
  await waitFor(() => projector.state.quizAnswered === true);
  check('round 4 answer locked in', projector.state.phase === 'quiz' && projector.state.quizAnswered === true);
  projector.emit(EVENTS.revealQuiz);
  await waitState(projector, (state) => state.phase === 'reveal');
  projector.emit(EVENTS.advanceRound);

  console.log('\n== Rounds 5-10: finish the game ==');
  for (const roundNumber of [5, 6, 7, 8, 9, 10]) {
    await waitState(projector, (state) => state.phase === 'drawing' && state.round === roundNumber && state.subPhase === 'choosing');
    const roundDrawer = drawerClient();
    if (roundNumber === 10) {
      check('final round offers three words from the larger bank', roundDrawer.state.wordChoices?.length === 3);
    }
    const roundChoices = roundDrawer.state.wordChoices;
    roundDrawer.emit(EVENTS.chooseWord, { index: 0 });
    const chosenWord = roundChoices[0];
    await waitState(projector, (state) => state.subPhase === 'drawing');
    if (roundNumber === 5) {
      const idleDrawerId = projector.state.drawerId;
      const idleDrawerBefore = playerIn(projector.state, idleDrawerId).score;
      await waitState(projector, (state) => state.phase === 'reveal', gameMs(DRAW_SECONDS) + 8000);
      check('timeout reveal when nobody guesses', projector.state.reveal?.quizResult === 'not_asked');
      check('drawer scores nothing when nobody guesses', playerIn(projector.state, idleDrawerId).score === idleDrawerBefore);
      projector.emit(EVENTS.advanceRound);
      continue;
    }
    const answerer = guesserClients().find((client) => !client.state.you?.hasGuessed);
    answerer.emit(EVENTS.submitGuess, { guess: aliasFor(chosenWord) });
    await waitForQuiz(answerer);
    quizIndices.push(answerer.state.quiz.correctIndex);
    answerer.emit(EVENTS.submitQuiz, { answer: answerer.state.quiz.correctIndex });
    await waitFor(() => projector.state.quizAnswered === true);
    projector.emit(EVENTS.revealQuiz);
    await waitState(projector, (state) => state.phase === 'reveal');
    projector.emit(EVENTS.advanceRound);
    if (roundNumber === 10) {
      await waitState(projector, (state) => state.phase === 'finished', 9000);
    }
  }

  check('game finished after 10 rounds', projector.state.phase === 'finished');
  check('summary contains all 10 rounds', projector.state.summary?.length === 10);
  const summaryWords = projector.state.summary.map((item) => item.word);
  check('no repeated words across the game', new Set(summaryWords).size === 10);
  check('quiz answer positions are shuffled', new Set(quizIndices).size >= 2);
  const livePlayer = players.find((client) => client.live);
  await waitState(livePlayer, (state) => state.phase === 'finished', 6000);
  check('summary visible to regular players after finish', livePlayer.state.summary?.length === 10);
  check('someone has a positive score', projector.state.players.some((player) => player.score > 0));

  console.log('\n== Restart: play again ==');
  projector.emit(EVENTS.nextRound);
  await waitState(projector, (state) => state.phase === 'lobby');
  check('next_round returns room to lobby', projector.state.phase === 'lobby');
  check('scores reset for new game', projector.state.players.every((player) => player.score === 0));
  check('summary cleared', projector.state.summary?.length === 0);

  projector.emit(EVENTS.startGame);
  const restarted = await waitState(projector, (state) => state.phase === 'drawing' && state.round === 1 && state.subPhase === 'choosing');
  check('second game starts from round 1', Boolean(restarted));
  const restartDrawer = drawerClient();
  check('word pool refilled after restart', restartDrawer.state.wordChoices?.length === 3);

  console.log('\n== Cleanup ==');
  for (const client of [projector, ...players]) await client.disconnect();
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
