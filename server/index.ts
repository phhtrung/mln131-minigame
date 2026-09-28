import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { EVENTS, PROJECTOR_PASSWORD_QUERY, PROJECTOR_REJECTED_ERROR } from '../shared/events.js';
import { PROJECTOR_PASSWORD } from '../shared/projector.js';
import { MAX_POINTS_PER_STROKE } from '../shared/drawing.js';
import { ROUND_CONTENT, type RoundContent } from '../shared/content.js';
import type {
  ClientState,
  ErasePayload,
  Phase,
  Player,
  Point,
  Quiz,
  QuizStage,
  Reveal,
  Stroke,
  SubPhase,
  SummaryItem,
} from '../shared/types.js';

const PORT = Number(process.env.PORT ?? 3000);
const TIMER_SCALE = Math.min(1, Math.max(0.02, Number(process.env.TIMER_SCALE ?? 1) || 1));
const ROOM_CODE = 'MLN131';
const TOTAL_ROUNDS = 10;
const WORD_CHOICE_SECONDS = 15;
const PRE_DRAW_SECONDS = 3;
const DRAW_SECONDS = 75;
const QUALIFIER_QUIZ_SECONDS = 15;
const QUALIFIER_CORRECT_POINTS = 50;
const FINALIST_CORRECT_POINTS = 150;
const FINALIST_WRONG_POINTS = 50;
const FASTEST_TIE_WINDOW_MS = 250;
const DRAWER_GRACE_MS = Math.round(3000 * TIMER_SCALE);
const GUESS_COOLDOWN_MS = 400;
const ERASE_COOLDOWN_MS = 40;
const WARN_COOLDOWN_MS = 3000;

type ClientSocket = Socket;

type PlayerEntry = Player & { socketId?: string };

type RateState = { guess?: number; erase?: number; warn?: number };

type QuizSubmission = { answer: number; submittedAt: number };

type Room = {
  phase: Phase;
  subPhase: SubPhase;
  round: number;
  secondsLeft: number;
  players: Map<string, PlayerEntry>;
  tokens: Map<string, string>;
  drawerHistory: string[];
  drawerId?: string;
  currentContent?: RoundContent;
  wordChoices?: string[];
  wordSelected: boolean;
  usedWords: string[];
  strokes: Stroke[];
  guessedPlayerIds: string[];
  firstGuesserId?: string;
  quiz?: Quiz;
  quizStage?: QuizStage;
  quizEligiblePlayerIds: string[];
  quizSubmissions: Map<string, QuizSubmission>;
  quizFinalistId?: string;
  qualifierAnswer?: string;
  quizAnswer?: number;
  reveal?: Reveal;
  summary: SummaryItem[];
  timer?: ReturnType<typeof setInterval>;
  drawerGraceTimer?: ReturnType<typeof setTimeout>;
};

const room: Room = {
  phase: 'lobby',
  subPhase: 'choosing',
  round: 0,
  secondsLeft: 0,
  players: new Map(),
  tokens: new Map(),
  drawerHistory: [],
  wordSelected: false,
  usedWords: [],
  strokes: [],
  guessedPlayerIds: [],
  quizEligiblePlayerIds: [],
  quizSubmissions: new Map(),
  summary: [],
};

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  const wantsProjector = socket.handshake.query.projector === '1';
  const password = socket.handshake.query[PROJECTOR_PASSWORD_QUERY];
  const given = Array.isArray(password) ? password[0] : password;
  if (wantsProjector && given !== PROJECTOR_PASSWORD) return next(new Error(PROJECTOR_REJECTED_ERROR));
  socket.data.isProjector = wantsProjector;
  next();
});

app.get('/healthz', (_request, response) => {
  const connected = [...room.players.values()].filter((player) => player.connected).length;
  response.json({
    ok: true,
    service: 'mln131-family-sketch',
    phase: room.phase,
    subPhase: room.subPhase,
    round: room.round,
    players: room.players.size,
    connected,
  });
});

const clientDist = path.resolve(process.cwd(), 'dist');
app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

const nameSchema = z.string().trim().min(1).max(24);
const wordIndexSchema = z.number().int().min(0).max(2);
const guessSchema = z.string().trim().min(1).max(80);
const reactionSchema = z.enum(['😭', '🥀', '❓', '💀', '😮‍💨', '🙏', '🥶', '😓']);
const answerSchema = z.number().int().min(0).max(3);
const pointSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const strokeIdSchema = z.string().trim().min(1).max(64);
const strokeChunkSchema = z.object({
  id: strokeIdSchema,
  points: z.array(pointSchema).min(1).max(64),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/),
  width: z.number().min(1).max(64),
  tool: z.enum(['fill', 'erase']).optional(),
});
const eraseSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  radius: z.number().min(0.005).max(0.5),
  aspect: z.number().min(0.1).max(10),
});

function segmentHitsEraser(a: Point, b: Point, payload: ErasePayload) {
  const ax = a.x;
  const ay = a.y * payload.aspect;
  const bx = b.x;
  const by = b.y * payload.aspect;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : ((payload.x - ax) * dx + (payload.y - ay) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, projection));
  const nearestX = ax + dx * t;
  const nearestY = ay + dy * t;
  const offsetX = nearestX - payload.x;
  const offsetY = nearestY - payload.y;
  return offsetX * offsetX + offsetY * offsetY <= payload.radius * payload.radius;
}

function eraseStroke(stroke: Stroke, payload: ErasePayload): Stroke[] | null {
  if (stroke.points.length === 0) return null;
  const pieces: Point[][] = [];
  let current: Point[] = [];
  let touched = false;
  for (const point of stroke.points) {
    const offsetX = point.x - payload.x;
    const offsetY = (point.y - payload.y) * payload.aspect;
    const inside = offsetX * offsetX + offsetY * offsetY <= payload.radius * payload.radius;
    const previous = current[current.length - 1];
    if (inside) {
      touched = true;
      if (current.length) pieces.push(current);
      current = [];
      continue;
    }
    if (previous && segmentHitsEraser(previous, point, payload)) {
      touched = true;
      if (current.length) pieces.push(current);
      current = [point];
      continue;
    }
    current.push(point);
  }
  if (current.length) pieces.push(current);
  if (!touched) return null;
  return pieces.map((points, index) => ({ ...stroke, id: index === 0 ? stroke.id : randomUUID(), points }));
}

function eraseStrokes(list: Stroke[], payload: ErasePayload): Stroke[] | null {
  const next: Stroke[] = [];
  let changed = false;
  for (const stroke of list) {
    const pieces = eraseStroke(stroke, payload);
    if (!pieces) {
      next.push(stroke);
      continue;
    }
    changed = true;
    next.push(...pieces);
  }
  return changed ? next : null;
}

// Diacritics are part of the answer: never strip them. Case and spacing are not.
function normalized(value: string) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Loose comparison used only to tell players their answer was right but unaccented.
function folded(value: string) {
  return normalized(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function scoreForGuess(secondsLeft: number, position: number) {
  const safeSeconds = Math.min(DRAW_SECONDS, Math.max(0, secondsLeft));
  const timePoints = Math.round((safeSeconds / DRAW_SECONDS) * 350);
  const orderBonus = position === 0 ? 50 : position === 1 ? 35 : position === 2 ? 15 : 0;
  return 50 + timePoints + orderBonus;
}

function effectiveSecondsLeft() {
  return room.phase === 'drawing' ? room.secondsLeft : 0;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function contentForWord(word: string) {
  return ROUND_CONTENT.find((content) => content.word === word) ?? ROUND_CONTENT[0];
}

function chooseWordChoices(): string[] {
  const unused = ROUND_CONTENT.filter((content) => !room.usedWords.includes(content.word));
  const source = unused.length > 0 ? unused : ROUND_CONTENT;
  return shuffle(source).slice(0, Math.min(3, source.length)).map((content) => content.word);
}

function buildShuffledQuiz(content: RoundContent): Quiz {
  const options = content.quiz.options.map((text, index) => ({ text, correct: index === content.quiz.correctIndex }));
  const shuffled = shuffle(options);
  return {
    prompt: content.quiz.prompt,
    options: shuffled.map((option) => option.text),
    correctIndex: shuffled.findIndex((option) => option.correct),
  };
}

function buildFinalistQuiz(content: RoundContent): Quiz {
  const distractors = shuffle(ROUND_CONTENT.filter((item) => item.word !== content.word)).slice(0, 3);
  const options = shuffle([
    { text: content.word, correct: true },
    ...distractors.map((item) => ({ text: item.word, correct: false })),
  ]);
  return {
    prompt: 'Ý chính này thuộc chủ đề nào?',
    context: content.takeaway,
    options: options.map((option) => option.text),
    correctIndex: options.findIndex((option) => option.correct),
  };
}

function maskedWordFor(word: string): string {
  return [...word]
    .map((character) => {
      if (/\s/.test(character)) return ' ';
      return '•';
    })
    .join('');
}

function currentMaskedWord(): string | undefined {
  if (!room.currentContent || !room.wordSelected) return undefined;
  if (room.phase !== 'drawing' && room.phase !== 'quiz') return undefined;
  return maskedWordFor(room.currentContent.word);
}

function toPublicPlayer(player: PlayerEntry): Player {
  return {
    id: player.id,
    name: player.name,
    score: player.score,
    quizCorrect: player.quizCorrect,
    firstGuesses: player.firstGuesses,
    connected: player.connected,
    isDrawer: player.id === room.drawerId,
  };
}

function connectedPlayers(): PlayerEntry[] {
  return [...room.players.values()].filter((player) => player.connected);
}

function allConnectedGuessersAnswered() {
  const guessers = connectedPlayers().filter((player) => player.id !== room.drawerId);
  return guessers.length > 0 && guessers.every((player) => room.guessedPlayerIds.includes(player.id));
}

function publicState(socket: ClientSocket): ClientState {
  const isProjector = socket.data.isProjector === true;
  const playerId = socket.data.playerId as string | undefined;
  const player = playerId ? room.players.get(playerId) : undefined;
  const isDrawer = Boolean(playerId && playerId === room.drawerId);
  const state: ClientState = {
    code: ROOM_CODE,
    phase: room.phase,
    subPhase: room.subPhase,
    round: room.round,
    totalRounds: TOTAL_ROUNDS,
    secondsLeft: room.secondsLeft,
    players: [...room.players.values()].map(toPublicPlayer),
    drawerId: room.drawerId,
    strokes: room.strokes,
    guessedPlayerIds: room.guessedPlayerIds,
    firstGuesserId: room.firstGuesserId,
    quizStage: room.quizStage,
    quizFinalistId: room.quizFinalistId,
    quizEligibleCount: room.quizEligiblePlayerIds.length,
    quizAnsweredCount: room.quizSubmissions.size,
  };

  if (player) {
    state.you = {
      id: player.id,
      token: room.tokens.get(player.id) ?? '',
      isDrawer,
      hasGuessed: room.guessedPlayerIds.includes(player.id),
    };
    if (isDrawer && room.currentContent && room.wordSelected) state.privateWord = room.currentContent.word;
  }
  if ((isDrawer || isProjector) && room.wordChoices && room.phase === 'drawing' && room.subPhase === 'choosing' && !room.wordSelected) {
    state.wordChoices = room.wordChoices;
  }
  if (!isDrawer) {
    const masked = currentMaskedWord();
    if (masked) state.maskedWord = masked;
  }
  const isQualifierPlayer = Boolean(playerId && room.quizEligiblePlayerIds.includes(playerId));
  const isFinalist = Boolean(playerId && playerId === room.quizFinalistId);
  const canSeeQuiz = isProjector
    || (room.quizStage === 'qualifier' && isQualifierPlayer)
    || (room.quizStage === 'finalist' && isFinalist);
  if (canSeeQuiz && room.quiz) state.quiz = room.quiz;
  if (room.phase === 'quiz' && room.quiz) {
    state.quizAnswered = room.quizStage === 'qualifier'
      ? Boolean(playerId && room.quizSubmissions.has(playerId))
      : room.quizAnswer !== undefined;
  }
  if ((isProjector || isFinalist) && room.quizStage === 'finalist' && room.quizAnswer !== undefined) state.quizAnswer = room.quizAnswer;
  if (isProjector || room.phase === 'reveal' || room.phase === 'finished') state.reveal = room.reveal;
  if (isProjector || room.phase === 'finished') state.summary = room.summary;

  if (room.phase === 'lobby') state.message = 'Đợi cả lớp vào phòng rồi bắt đầu.';
  if (room.phase === 'drawing' && room.subPhase === 'choosing' && isDrawer) state.message = 'Chọn một từ để bắt đầu vẽ.';
  if (room.phase === 'drawing' && room.subPhase === 'choosing' && !isDrawer) state.message = 'Họa sĩ đang chọn từ khóa…';
  if (room.phase === 'drawing' && room.subPhase === 'countdown') state.message = 'Sẵn sàng…';
  if (room.phase === 'drawing' && room.subPhase === 'drawing' && !isDrawer) state.message = 'Đoán thật nhanh — câu trả lời được gửi riêng.';
  if (room.phase === 'quiz' && room.quizStage === 'qualifier' && !isQualifierPlayer) {
    state.message = 'Những bạn đoán đúng đang làm câu hỏi nhanh 15 giây.';
  }
  if (room.phase === 'quiz' && room.quizStage === 'finalist' && !isFinalist) {
    const finalist = room.players.get(room.quizFinalistId ?? '');
    state.message = `${finalist?.name ?? 'Bạn nhanh nhất'} đang trả lời câu hỏi quyết định.`;
  }
  return state;
}

function broadcastState() {
  for (const socket of io.sockets.sockets.values()) socket.emit(EVENTS.roomState, publicState(socket));
}

function broadcastTick() {
  io.emit(EVENTS.tick, {
    phase: room.phase,
    subPhase: room.subPhase,
    secondsLeft: room.secondsLeft,
    quizStage: room.quizStage,
    maskedWord: currentMaskedWord(),
  });
}

function toast(message: string, target?: ClientSocket) {
  if (target) target.emit(EVENTS.toast, message);
  else io.emit(EVENTS.toast, message);
}

function clearTimers() {
  if (room.timer) clearInterval(room.timer);
  if (room.drawerGraceTimer) clearTimeout(room.drawerGraceTimer);
  room.timer = undefined;
  room.drawerGraceTimer = undefined;
}

function startCountdown(seconds: number, onComplete: () => void) {
  clearTimers();
  room.secondsLeft = seconds;
  broadcastState();
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    broadcastTick();
    if (room.secondsLeft <= 0) {
      if (room.timer) clearInterval(room.timer);
      room.timer = undefined;
      onComplete();
    }
  }, Math.round(1000 * TIMER_SCALE));
}

function awardDrawer() {
  if (!room.drawerId) return;
  const drawer = room.players.get(room.drawerId);
  if (!drawer) return;
  const guessedCount = room.guessedPlayerIds.length;
  const totalGuessers = connectedPlayers().filter((player) => player.id !== room.drawerId).length;
  if (guessedCount === 0 || totalGuessers === 0) return;
  drawer.score += Math.round(Math.min(1, guessedCount / totalGuessers) * 500);
}

function pickDrawerFrom(pool: PlayerEntry[]): PlayerEntry | undefined {
  if (pool.length === 0) return undefined;
  const available = pool.filter((player) => !room.drawerHistory.includes(player.id));
  const source = available.length > 0 ? available : pool;
  if (available.length === 0) room.drawerHistory = [];
  const drawer = source[Math.floor(Math.random() * source.length)];
  room.drawerHistory.push(drawer.id);
  return drawer;
}

function resetRoundState() {
  room.currentContent = undefined;
  room.wordChoices = undefined;
  room.wordSelected = false;
  room.strokes = [];
  room.guessedPlayerIds = [];
  room.firstGuesserId = undefined;
  room.quiz = undefined;
  room.quizStage = undefined;
  room.quizEligiblePlayerIds = [];
  room.quizSubmissions.clear();
  room.quizFinalistId = undefined;
  room.qualifierAnswer = undefined;
  room.quizAnswer = undefined;
  room.reveal = undefined;
}

function resetForNewGame() {
  clearTimers();
  room.phase = 'lobby';
  room.subPhase = 'choosing';
  room.round = 0;
  room.secondsLeft = 0;
  room.drawerHistory = [];
  room.drawerId = undefined;
  room.usedWords = [];
  room.summary = [];
  resetRoundState();
  for (const player of room.players.values()) {
    player.score = 0;
    player.quizCorrect = 0;
    player.firstGuesses = 0;
    player.isDrawer = false;
  }
}

function bailToLobby(reason: string) {
  clearTimers();
  room.phase = 'lobby';
  room.subPhase = 'choosing';
  room.secondsLeft = 0;
  room.drawerId = undefined;
  room.wordChoices = undefined;
  toast(`${reason} Máy chiếu bấm Bắt đầu khi đã đủ người.`);
  broadcastState();
}

function selectWord(index: number) {
  const word = room.wordChoices?.[index] ?? ROUND_CONTENT[0].word;
  room.currentContent = contentForWord(word);
  room.wordSelected = true;
  if (!room.usedWords.includes(word)) room.usedWords.push(word);
  room.subPhase = 'countdown';
  startCountdown(PRE_DRAW_SECONDS, () => {
    room.subPhase = 'drawing';
    startCountdown(DRAW_SECONDS, onDrawingTimeUp);
  });
}

function beginRound() {
  clearTimers();
  if (room.round >= TOTAL_ROUNDS) return finishGame();
  const connected = connectedPlayers();
  if (connected.length < 2) {
    bailToLobby('Không đủ người chơi trực tuyến để tiếp tục — ván chơi tạm dừng.');
    return;
  }
  room.round += 1;
  const drawer = pickDrawerFrom(connected);
  if (!drawer) {
    bailToLobby('Không tìm được họa sĩ — ván chơi tạm dừng.');
    return;
  }
  room.drawerId = drawer.id;
  resetRoundState();
  room.wordChoices = chooseWordChoices();
  room.subPhase = 'choosing';
  room.phase = 'drawing';
  startCountdown(WORD_CHOICE_SECONDS, () => {
    if (room.phase === 'drawing' && room.subPhase === 'choosing' && !room.wordSelected) selectWord(0);
  });
}

function finishRound(result: Reveal['quizResult']) {
  if (room.phase === 'reveal' || room.phase === 'finished') return;
  clearTimers();
  awardDrawer();
  const content = room.currentContent;
  room.summary.push({
    round: room.round,
    word: content?.word ?? '—',
    explanation: content?.explanation ?? '',
    takeaway: content?.takeaway ?? '',
    drawerName: room.players.get(room.drawerId ?? '')?.name ?? '—',
    guessedCount: room.guessedPlayerIds.length,
  });
  room.phase = 'reveal';
  room.reveal = {
    word: content?.word ?? 'Chủ đề gia đình',
    explanation: content?.explanation ?? '',
    takeaway: content?.takeaway ?? '',
    quizResult: result,
    qualifierAnswer: room.qualifierAnswer,
    qualifierWinnerName: room.players.get(room.quizFinalistId ?? '')?.name,
  };
  if (room.quizStage === 'finalist' && room.quiz) {
    room.reveal.answer = room.quiz.options[room.quiz.correctIndex];
    if (room.quizAnswer !== undefined) room.reveal.chosenAnswer = room.quiz.options[room.quizAnswer];
  }
  room.secondsLeft = 0;
  broadcastState();
}

function startQualifierQuiz() {
  const content = room.currentContent;
  if (!content) return;
  const eligible = room.guessedPlayerIds.filter((playerId) => room.players.get(playerId)?.connected);
  if (eligible.length === 0) return finishRound('not_asked');
  clearTimers();
  room.phase = 'quiz';
  room.quizStage = 'qualifier';
  room.quizEligiblePlayerIds = eligible;
  room.quizSubmissions.clear();
  room.quizFinalistId = undefined;
  room.quiz = buildShuffledQuiz(content);
  room.qualifierAnswer = room.quiz.options[room.quiz.correctIndex];
  room.quizAnswer = undefined;
  startCountdown(QUALIFIER_QUIZ_SECONDS, finishQualifierQuiz);
}

function allEligiblePlayersAnswered() {
  const activeEligible = room.quizEligiblePlayerIds.filter((playerId) => room.players.get(playerId)?.connected);
  return activeEligible.length > 0 && activeEligible.every((playerId) => room.quizSubmissions.has(playerId));
}

function finishQualifierQuiz() {
  if (room.phase !== 'quiz' || room.quizStage !== 'qualifier' || !room.quiz || !room.currentContent) return;
  clearTimers();
  const correct = [...room.quizSubmissions.entries()]
    .filter(([, submission]) => submission.answer === room.quiz?.correctIndex)
    .sort((a, b) => a[1].submittedAt - b[1].submittedAt);
  if (correct.length === 0) {
    toast('Chưa có đáp án đúng ở câu hỏi nhanh — cùng xem lại kiến thức nhé!');
    finishRound('not_asked');
    return;
  }
  const fastestAt = correct[0][1].submittedAt;
  const tiedFastest = correct.filter(([, submission]) => submission.submittedAt - fastestAt <= FASTEST_TIE_WINDOW_MS);
  const finalistEntry = tiedFastest[Math.floor(Math.random() * tiedFastest.length)];
  const finalistId = finalistEntry[0];
  room.quizStage = 'finalist';
  room.quizFinalistId = finalistId;
  room.quiz = buildFinalistQuiz(room.currentContent);
  room.quizAnswer = undefined;
  room.secondsLeft = 0;
  const finalist = room.players.get(finalistId);
  toast(`${finalist?.name ?? 'Bạn nhanh nhất'} vào câu hỏi quyết định!`);
  broadcastState();
}

function onDrawingTimeUp() {
  if (room.guessedPlayerIds.length > 0) startQualifierQuiz();
  else finishRound('not_asked');
}

function finishGame() {
  clearTimers();
  room.phase = 'finished';
  room.subPhase = 'choosing';
  room.secondsLeft = 0;
  room.drawerId = undefined;
  room.wordChoices = undefined;
  toast('Ván chơi kết thúc — cảm ơn cả lớp đã cùng chơi!');
  broadcastState();
}

function scheduleDrawerReplacement(leavingDrawerId: string) {
  if (room.drawerGraceTimer) clearTimeout(room.drawerGraceTimer);
  room.drawerGraceTimer = setTimeout(() => {
    room.drawerGraceTimer = undefined;
    const player = room.players.get(leavingDrawerId);
    if (room.phase !== 'drawing' || room.drawerId !== leavingDrawerId || (player && player.connected)) return;
    if (!replaceDrawer()) bailToLobby('Họa sĩ rời phòng và không đủ người thay thế — ván chơi tạm dừng.');
  }, DRAWER_GRACE_MS);
}

function replaceDrawer(): boolean {
  const connected = connectedPlayers();
  if (connected.length < 2) return false;
  const nextDrawer = pickDrawerFrom(connected);
  if (!nextDrawer) return false;
  const oldName = room.players.get(room.drawerId ?? '')?.name ?? 'Họa sĩ';
  room.drawerId = nextDrawer.id;
  resetRoundState();
  room.wordChoices = chooseWordChoices();
  room.subPhase = 'choosing';
  room.phase = 'drawing';
  toast(`${oldName} rời phòng — ${nextDrawer.name} sẽ vẽ thay.`);
  startCountdown(WORD_CHOICE_SECONDS, () => {
    if (room.phase === 'drawing' && room.subPhase === 'choosing' && !room.wordSelected) selectWord(0);
  });
  return true;
}

function joinPlayer(socket: ClientSocket, payload: { name?: unknown; playerId?: unknown; token?: unknown }) {
  const parsedName = nameSchema.safeParse(payload?.name);
  if (!parsedName.success) return toast('Tên cần từ 1 đến 24 ký tự.', socket);
  const playerId = typeof payload?.playerId === 'string' ? payload.playerId : undefined;
  const token = typeof payload?.token === 'string' ? payload.token : undefined;

  if (playerId && token && room.tokens.get(playerId) === token) {
    const existing = room.players.get(playerId);
    if (existing) {
      existing.connected = true;
      existing.name = parsedName.data;
      existing.socketId = socket.id;
      socket.data.playerId = playerId;
      socket.data.rate = {};
      if (room.drawerGraceTimer && room.drawerId === playerId) {
        clearTimeout(room.drawerGraceTimer);
        room.drawerGraceTimer = undefined;
      }
      toast(`Kết nối lại thành công — chào mừng trở lại, ${parsedName.data}!`, socket);
      broadcastState();
      return;
    }
  }

  if (room.phase !== 'lobby') return toast('Ván chơi đang diễn ra; hãy tham gia ở ván sau.', socket);
  const id = randomUUID();
  socket.data.playerId = id;
  socket.data.rate = {};
  room.tokens.set(id, randomUUID());
  room.players.set(id, {
    id,
    name: parsedName.data,
    score: 0,
    quizCorrect: 0,
    firstGuesses: 0,
    connected: true,
    isDrawer: false,
    socketId: socket.id,
  });
  toast(`Chào mừng ${parsedName.data}!`, socket);
  broadcastState();
}

io.on('connection', (socket: ClientSocket) => {
  socket.data.rate = {};
  socket.emit(EVENTS.roomState, publicState(socket));

  socket.on(EVENTS.joinRoom, (payload: { name?: unknown; playerId?: unknown; token?: unknown }) => joinPlayer(socket, payload ?? {}));

  socket.on(EVENTS.startGame, () => {
    if (!socket.data.isProjector) return toast('Chỉ máy chiếu mới có thể bắt đầu.', socket);
    if (room.phase !== 'lobby') return;
    if (connectedPlayers().length < 2) return toast('Cần ít nhất 2 người chơi trực tuyến để bắt đầu.', socket);
    resetForNewGame();
    beginRound();
  });

  socket.on(EVENTS.nextRound, () => {
    if (!socket.data.isProjector) return toast('Chỉ máy chiếu mới có thể bắt đầu ván mới.', socket);
    if (room.phase !== 'finished') return;
    resetForNewGame();
    toast('Đã thiết lập lại phòng — máy chiếu bấm Bắt đầu để chơi ván mới.');
    broadcastState();
  });

  socket.on(EVENTS.chooseWord, (payload: { index?: unknown }) => {
    if (room.phase !== 'drawing' || room.subPhase !== 'choosing' || room.wordSelected) return;
    if (socket.data.playerId !== room.drawerId) return;
    const parsed = wordIndexSchema.safeParse(payload?.index);
    if (!parsed.success || !room.wordChoices?.[parsed.data]) return;
    selectWord(parsed.data);
    toast('Từ khóa đã được chọn — bắt đầu vẽ!', socket);
  });

  socket.on(EVENTS.strokeChunk, (payload: unknown) => {
    if (room.phase !== 'drawing' || room.subPhase !== 'drawing' || socket.data.playerId !== room.drawerId) return;
    const parsed = strokeChunkSchema.safeParse(payload);
    if (!parsed.success) return;
    const chunk = parsed.data;
    let stroke = [...room.strokes].reverse().find((item) => item.id === chunk.id);
    if (!stroke) {
      stroke = { id: chunk.id, points: [], color: chunk.color, width: chunk.width, tool: chunk.tool };
      room.strokes.push(stroke);
    }
    if (stroke.points.length + chunk.points.length > MAX_POINTS_PER_STROKE) return;
    stroke.points.push(...chunk.points);
    socket.broadcast.emit(EVENTS.strokeChunk, chunk);
  });

  socket.on(EVENTS.erase, (payload: unknown) => {
    if (room.phase !== 'drawing' || room.subPhase !== 'drawing' || socket.data.playerId !== room.drawerId) return;
    const rate = socket.data.rate as RateState;
    const now = Date.now();
    if (rate.erase && now - rate.erase < ERASE_COOLDOWN_MS) return;
    rate.erase = now;
    const parsed = eraseSchema.safeParse(payload);
    if (!parsed.success) return;
    const next = eraseStrokes(room.strokes, parsed.data);
    if (!next) return;
    room.strokes = next;
    io.emit(EVENTS.erase, { strokes: next });
  });

  socket.on(EVENTS.undo, () => {
    if (room.phase !== 'drawing' || room.subPhase !== 'drawing' || socket.data.playerId !== room.drawerId) return;
    const removed = room.strokes.pop();
    if (!removed) return;
    io.emit(EVENTS.undo, { id: removed.id });
  });

  socket.on(EVENTS.clearCanvas, () => {
    if (room.phase !== 'drawing' || room.subPhase !== 'drawing' || socket.data.playerId !== room.drawerId) return;
    room.strokes = [];
    io.emit(EVENTS.clearCanvas);
  });

  socket.on(EVENTS.submitGuess, (payload: { guess?: unknown }) => {
    const canGuess = room.phase === 'drawing' && room.wordSelected && room.subPhase === 'drawing';
    if (!canGuess) return;
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId) return toast('Hãy vào phòng trước khi đoán.', socket);
    if (playerId === room.drawerId || room.guessedPlayerIds.includes(playerId)) return;
    const rate = socket.data.rate as RateState;
    const now = Date.now();
    if (rate.guess && now - rate.guess < GUESS_COOLDOWN_MS) {
      if (!rate.warn || now - rate.warn > WARN_COOLDOWN_MS) {
        rate.warn = now;
        toast('Chậm lại một chút nhé!', socket);
      }
      return;
    }
    rate.guess = now;
    const parsed = guessSchema.safeParse(payload?.guess);
    if (!parsed.success || !room.currentContent) return;
    const guess = normalized(parsed.data);
    const answers = [room.currentContent.word, ...room.currentContent.aliases];
    const correct = answers.some((answer) => normalized(answer) === guess);
    if (!correct) {
      const missingDiacritics = answers.some((answer) => folded(answer) === folded(parsed.data));
      return toast(missingDiacritics ? 'Đúng nội dung rồi, nhưng thiếu dấu — hãy gõ kèm dấu nhé.' : 'Chưa đúng — thử một ý khác nhé.', socket);
    }
    const position = room.guessedPlayerIds.length;
    room.guessedPlayerIds.push(playerId);
    const secondsLeft = effectiveSecondsLeft();
    const points = scoreForGuess(secondsLeft, position);
    const player = room.players.get(playerId);
    if (player) {
      player.score += points;
      if (position === 0) player.firstGuesses += 1;
    }
    io.emit(EVENTS.guessSuccess, { playerId, name: player?.name ?? 'Một bạn', points, position });
    if (position === 0) room.firstGuesserId = playerId;
    if (room.firstGuesserId && allConnectedGuessersAnswered()) startQualifierQuiz();
    else broadcastState();
  });

  socket.on(EVENTS.submitQuiz, (payload: { answer?: unknown }) => {
    if (room.phase !== 'quiz' || !room.quiz) return;
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId) return;
    const parsed = answerSchema.safeParse(payload?.answer);
    if (!parsed.success) return;
    if (room.quizStage === 'qualifier') {
      if (!room.quizEligiblePlayerIds.includes(playerId) || room.quizSubmissions.has(playerId)) return;
      const submission = { answer: parsed.data, submittedAt: Date.now() };
      room.quizSubmissions.set(playerId, submission);
      const player = room.players.get(playerId);
      if (player && submission.answer === room.quiz.correctIndex) {
        player.score += QUALIFIER_CORRECT_POINTS;
        player.quizCorrect += 1;
      }
      toast('Đã chốt đáp án câu hỏi nhanh.', socket);
      if (allEligiblePlayersAnswered()) finishQualifierQuiz();
      else broadcastState();
      return;
    }
    if (room.quizStage !== 'finalist' || playerId !== room.quizFinalistId || room.quizAnswer !== undefined) return;
    room.quizAnswer = parsed.data;
    toast('Đã chốt đáp án — chờ máy chiếu mở đáp án.');
    broadcastState();
  });

  socket.on(EVENTS.revealQuiz, () => {
    if (!socket.data.isProjector) return toast('Chỉ máy chiếu mới có thể mở đáp án.', socket);
    if (room.phase !== 'quiz' || room.quizStage !== 'finalist' || !room.quiz) return;
    const decided = room.quizAnswer;
    if (decided === undefined) {
      finishRound('not_asked');
      return;
    }
    const player = room.players.get(room.quizFinalistId ?? '');
    const correct = decided === room.quiz.correctIndex;
    if (player) {
      if (correct) {
        player.score += FINALIST_CORRECT_POINTS;
        player.quizCorrect += 1;
        toast(`${player.name} trả lời đúng câu hỏi quyết định!`, undefined);
      } else {
        player.score -= FINALIST_WRONG_POINTS;
        toast(`${player.name} chưa chọn đúng — kiến thức sẽ được giải thích ngay.`, undefined);
      }
    }
    finishRound(correct ? 'correct' : 'incorrect');
  });

  socket.on(EVENTS.advanceRound, () => {
    if (!socket.data.isProjector) return toast('Chỉ máy chiếu mới có thể chuyển vòng.', socket);
    if (room.phase !== 'reveal') return;
    beginRound();
  });

  socket.on(EVENTS.reaction, (rawReaction: unknown) => {
    const parsed = reactionSchema.safeParse(rawReaction);
    if (!parsed.success) return;
    const player = room.players.get(socket.data.playerId as string);
    io.emit(EVENTS.reaction, { id: randomUUID(), name: player?.name ?? 'Bạn', reaction: parsed.data });
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId) return;
    const player = room.players.get(playerId);
    if (!player || player.socketId !== socket.id) return;
    player.connected = false;
    player.socketId = undefined;
    if (room.phase === 'quiz' && room.quizStage === 'qualifier' && allEligiblePlayersAnswered()) {
      finishQualifierQuiz();
      return;
    }
    if (room.phase === 'drawing' && playerId === room.drawerId) {
      scheduleDrawerReplacement(playerId);
      broadcastState();
      return;
    }
    broadcastState();
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MLN131 Family Sketch listening on 0.0.0.0:${PORT}`);
});
