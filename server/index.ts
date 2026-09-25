import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { EVENTS } from '../shared/events.js';
import { ROUND_CONTENT, type RoundContent } from '../shared/content.js';
import type { ClientState, Player, Reveal, RoomState, Stroke } from '../shared/types.js';

const PORT = Number(process.env.PORT ?? 3000);
const ROOM_CODE = 'MLN131';
const TOTAL_ROUNDS = 7;
const DRAW_SECONDS = 45;
const QUIZ_SECONDS = 20;
const REVEAL_SECONDS = 9;

type ClientSocket = Socket;

type Room = {
  phase: RoomState['phase'];
  round: number;
  secondsLeft: number;
  players: Map<string, Player>;
  order: string[];
  drawerHistory: string[];
  drawerId?: string;
  currentContent?: RoundContent;
  wordChoices?: string[];
  wordSelected: boolean;
  strokes: Stroke[];
  guessedPlayerIds: string[];
  firstGuesserId?: string;
  quiz?: RoomState['quiz'];
  reveal?: Reveal;
  recentReactions: RoomState['recentReactions'];
  timer?: ReturnType<typeof setInterval>;
  transitionTimer?: ReturnType<typeof setTimeout>;
};

const room: Room = {
  phase: 'lobby',
  round: 0,
  secondsLeft: 0,
  players: new Map(),
  order: [],
  drawerHistory: [],
  wordSelected: false,
  strokes: [],
  guessedPlayerIds: [],
  recentReactions: [],
};

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
});

app.get('/healthz', (_request, response) => {
  response.json({ ok: true, service: 'mln131-family-sketch', phase: room.phase, players: room.players.size });
});

const clientDist = path.resolve(process.cwd(), 'dist');
app.use(express.static(clientDist));
app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(clientDist, 'index.html'));
});

const nameSchema = z.string().trim().min(1).max(24);
const wordIndexSchema = z.number().int().min(0).max(2);
const guessSchema = z.string().trim().min(1).max(80);
const reactionSchema = z.string().trim().min(1).max(8);
const answerSchema = z.number().int().min(0).max(3);

function normalized(value: string) {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreForGuess(position: number) {
  return [500, 380, 320, 250, 170, 100, 60][position] ?? 40;
}

function chooseUniqueWords() {
  return [...ROUND_CONTENT]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((content) => content.word);
}

function contentForWord(word: string) {
  return ROUND_CONTENT.find((content) => content.word === word) ?? ROUND_CONTENT[0];
}

function playersForState() {
  return room.order.map((id) => room.players.get(id)).filter(Boolean) as Player[];
}

function publicState(socket: ClientSocket): ClientState {
  const isHost = socket.data.isHost === true;
  const playerId = socket.data.playerId as string | undefined;
  const isDrawer = Boolean(playerId && playerId === room.drawerId);
  const state: ClientState = {
    code: ROOM_CODE,
    phase: room.phase,
    round: room.round,
    totalRounds: TOTAL_ROUNDS,
    secondsLeft: room.secondsLeft,
    players: playersForState(),
    drawerId: room.drawerId,
    strokes: room.strokes,
    guessedPlayerIds: room.guessedPlayerIds,
    firstGuesserId: room.firstGuesserId,
    recentReactions: room.recentReactions,
    isHost,
  };

  if ((isDrawer || isHost) && room.wordChoices) state.wordChoices = room.wordChoices;
  if (isDrawer && room.currentContent && room.wordSelected) state.privateWord = room.currentContent.word;
  if ((isHost || playerId === room.firstGuesserId) && room.quiz) state.quiz = room.quiz;
  if (isHost || room.phase === 'reveal' || room.phase === 'finished') state.reveal = room.reveal;
  if (room.phase === 'lobby') state.message = 'Đợi cả lớp vào phòng rồi bắt đầu.';
  if (room.phase === 'drawing' && !room.wordSelected && isDrawer) state.message = 'Chọn một từ để bắt đầu vẽ.';
  if (room.phase === 'drawing' && room.wordSelected && playerId !== room.drawerId) state.message = 'Đoán thật nhanh — câu trả lời được gửi riêng.';
  if (room.phase === 'quiz' && playerId !== room.firstGuesserId) state.message = 'Bạn vẫn có thể đoán; người đầu tiên đang trả lời câu hỏi.';
  return state;
}

function broadcastState() {
  for (const socket of io.sockets.sockets.values()) socket.emit(EVENTS.roomState, publicState(socket));
}

function toast(message: string, target?: ClientSocket) {
  if (target) target.emit(EVENTS.toast, message);
  else io.emit(EVENTS.toast, message);
}

function clearTimers() {
  if (room.timer) clearInterval(room.timer);
  if (room.transitionTimer) clearTimeout(room.transitionTimer);
  room.timer = undefined;
  room.transitionTimer = undefined;
}

function startCountdown(seconds: number, onComplete: () => void) {
  if (room.timer) clearInterval(room.timer);
  room.secondsLeft = seconds;
  broadcastState();
  room.timer = setInterval(() => {
    room.secondsLeft -= 1;
    broadcastState();
    if (room.secondsLeft <= 0) {
      if (room.timer) clearInterval(room.timer);
      room.timer = undefined;
      onComplete();
    }
  }, 1000);
}

function awardDrawer() {
  if (!room.drawerId) return;
  const drawer = room.players.get(room.drawerId);
  if (!drawer) return;
  const guessedCount = room.guessedPlayerIds.length;
  const drawerPoints = Math.min(500, 150 + guessedCount * 75);
  drawer.score += drawerPoints;
}

function beginRound() {
  clearTimers();
  room.round += 1;
  if (room.round > TOTAL_ROUNDS || room.order.length === 0) {
    room.phase = 'finished';
    room.secondsLeft = 0;
    room.reveal = undefined;
    for (const player of room.players.values()) player.isDrawer = false;
    broadcastState();
    return;
  }

  const available = room.order.filter((id) => !room.drawerHistory.includes(id));
  if (available.length === 0) room.drawerHistory = [];
  const candidates = room.order.filter((id) => !room.drawerHistory.includes(id));
  room.drawerId = candidates[Math.floor(Math.random() * candidates.length)] ?? room.order[0];
  room.drawerHistory.push(room.drawerId);
  for (const player of room.players.values()) player.isDrawer = player.id === room.drawerId;
  room.currentContent = ROUND_CONTENT[(room.round - 1) % ROUND_CONTENT.length];
  room.wordChoices = chooseUniqueWords();
  room.wordSelected = false;
  room.strokes = [];
  room.guessedPlayerIds = [];
  room.firstGuesserId = undefined;
  room.quiz = undefined;
  room.reveal = undefined;
  room.phase = 'drawing';
  startCountdown(8, () => {
    if (room.phase === 'drawing' && !room.wordSelected) {
      room.wordSelected = true;
      room.currentContent = contentForWord(room.wordChoices?.[0] ?? ROUND_CONTENT[0].word);
      startDrawingTimer();
    }
  });
  broadcastState();
}

function startDrawingTimer() {
  startCountdown(DRAW_SECONDS, () => finishRound('timeout'));
}

function finishRound(result: Reveal['quizResult']) {
  if (room.phase === 'reveal' || room.phase === 'finished') return;
  clearTimers();
  awardDrawer();
  room.phase = 'reveal';
  room.reveal = {
    word: room.currentContent?.word ?? 'Chủ đề gia đình',
    explanation: room.currentContent?.explanation ?? '',
    takeaway: room.currentContent?.takeaway ?? '',
    quizResult: result,
  };
  room.secondsLeft = REVEAL_SECONDS;
  broadcastState();
  startCountdown(REVEAL_SECONDS, beginRound);
}

function startQuiz(firstGuesserId: string) {
  const content = room.currentContent;
  if (!content) return;
  room.phase = 'quiz';
  room.firstGuesserId = firstGuesserId;
  room.quiz = content.quiz;
  startCountdown(QUIZ_SECONDS, () => {
    const player = room.players.get(firstGuesserId);
    if (player) player.score -= 100;
    finishRound('timeout');
  });
}

function joinPlayer(socket: ClientSocket, rawName: unknown) {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) return toast('Tên cần từ 1 đến 24 ký tự.', socket);
  if (room.phase !== 'lobby') return toast('Ván chơi đã bắt đầu; hãy tham gia ở ván sau.', socket);
  const id = socket.data.playerId ?? socket.id;
  socket.data.playerId = id;
  const existing = room.players.get(id);
  if (existing) {
    existing.connected = true;
    existing.name = parsed.data;
  } else {
    room.players.set(id, { id, name: parsed.data, score: 0, quizCorrect: 0, firstGuesses: 0, connected: true, isDrawer: false });
    room.order.push(id);
  }
  toast(`Chào mừng ${parsed.data}!`, socket);
  broadcastState();
}

io.on('connection', (socket) => {
  socket.data.isHost = socket.handshake.query.host === '1';
  socket.emit(EVENTS.roomState, publicState(socket));

  socket.on(EVENTS.joinRoom, (payload: { name?: unknown }) => joinPlayer(socket, payload?.name));

  socket.on(EVENTS.startGame, () => {
    if (!socket.data.isHost) return toast('Chỉ host mới có thể bắt đầu.', socket);
    if (room.phase !== 'lobby') return;
    if (room.players.size === 0) return toast('Cần ít nhất một người chơi.', socket);
    beginRound();
  });

  socket.on(EVENTS.chooseWord, (payload: { index?: unknown }) => {
    if (room.phase !== 'drawing' || room.wordSelected || socket.data.playerId !== room.drawerId) return;
    const parsed = wordIndexSchema.safeParse(payload?.index);
    if (!parsed.success || !room.wordChoices?.[parsed.data]) return;
    room.currentContent = contentForWord(room.wordChoices[parsed.data]);
    room.wordSelected = true;
    startDrawingTimer();
    toast('Từ khóa đã được chọn — bắt đầu vẽ!', socket);
  });

  socket.on(EVENTS.stroke, (stroke: Stroke) => {
    if (room.phase !== 'drawing' || !room.wordSelected || socket.data.playerId !== room.drawerId) return;
    if (!stroke || !Array.isArray(stroke.points) || stroke.points.length > 1000) return;
    room.strokes.push(stroke);
    io.emit(EVENTS.stroke, stroke);
  });

  socket.on(EVENTS.clearCanvas, () => {
    if (room.phase === 'drawing' && socket.data.playerId === room.drawerId) {
      room.strokes = [];
      io.emit(EVENTS.clearCanvas);
      broadcastState();
    }
  });

  socket.on(EVENTS.submitGuess, (payload: { guess?: unknown }) => {
    if (room.phase !== 'drawing' && room.phase !== 'quiz') return;
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId || playerId === room.drawerId || room.guessedPlayerIds.includes(playerId)) return;
    const parsed = guessSchema.safeParse(payload?.guess);
    if (!parsed.success || !room.currentContent) return;
    const guess = normalized(parsed.data);
    const correct = [room.currentContent.word, ...room.currentContent.aliases].some((answer) => normalized(answer) === guess);
    if (!correct) return toast('Chưa đúng — thử một ý khác nhé.', socket);
    const position = room.guessedPlayerIds.length;
    room.guessedPlayerIds.push(playerId);
    const player = room.players.get(playerId);
    if (player) {
      player.score += scoreForGuess(position);
      if (position === 0) player.firstGuesses += 1;
    }
    toast(`${player?.name ?? 'Một bạn'} đã đoán đúng!`, undefined);
    if (position === 0) startQuiz(playerId);
    else broadcastState();
  });

  socket.on(EVENTS.submitQuiz, (payload: { answer?: unknown }) => {
    if (room.phase !== 'quiz' || socket.data.playerId !== room.firstGuesserId || !room.quiz) return;
    const parsed = answerSchema.safeParse(payload?.answer);
    if (!parsed.success) return;
    const player = room.players.get(socket.data.playerId);
    if (!player) return;
    const correct = parsed.data === room.quiz.correctIndex;
    if (correct) {
      player.score += 400;
      player.quizCorrect += 1;
      toast(`${player.name} trả lời đúng câu hỏi củng cố!`, undefined);
    } else {
      player.score -= 200;
      toast(`${player.name} chưa chọn đúng — kiến thức sẽ được giải thích ngay.`, undefined);
    }
    finishRound(correct ? 'correct' : 'incorrect');
  });

  socket.on(EVENTS.reaction, (rawReaction: unknown) => {
    const parsed = reactionSchema.safeParse(rawReaction);
    if (!parsed.success) return;
    const player = room.players.get(socket.data.playerId as string);
    room.recentReactions = [...room.recentReactions.slice(-11), { id: randomUUID(), name: player?.name ?? 'Bạn', reaction: parsed.data }];
    broadcastState();
  });

  socket.on('disconnect', () => {
    const playerId = socket.data.playerId as string | undefined;
    if (!playerId) return;
    const player = room.players.get(playerId);
    if (player) {
      player.connected = false;
      player.isDrawer = false;
      broadcastState();
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`MLN131 Family Sketch listening on 0.0.0.0:${PORT}`);
});
