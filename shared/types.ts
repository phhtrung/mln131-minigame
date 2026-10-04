export type Phase = 'lobby' | 'drawing' | 'quiz' | 'reveal' | 'finished';

export type SubPhase = 'choosing' | 'countdown' | 'drawing';

export type QuizResult = 'correct' | 'incorrect' | 'not_asked';

export type Player = {
  id: string;
  name: string;
  score: number;
  quizCorrect: number;
  firstGuesses: number;
  connected: boolean;
  isDrawer: boolean;
};

export type Point = { x: number; y: number };

export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool?: 'fill' | 'erase';
};

export type Quiz = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type Reveal = {
  word: string;
  explanation: string;
  takeaway: string;
  quizResult?: QuizResult;
  answer?: string;
  chosenAnswer?: string;
};

export type SummaryItem = {
  round: number;
  word: string;
  explanation: string;
  takeaway: string;
  drawerName: string;
  guessedCount: number;
};

export type Reaction = { id: string; name: string; reaction: string };

export type RoomState = {
  code: string;
  maxPlayers: number;
  phase: Phase;
  subPhase: SubPhase;
  round: number;
  totalRounds: number;
  secondsLeft: number;
  players: Player[];
  drawerId?: string;
  strokes: Stroke[];
  guessedPlayerIds: string[];
  firstGuesserId?: string;
  wordChoices?: string[];
  maskedWord?: string;
  quiz?: Quiz;
  quizAnswered?: boolean;
  quizAnswer?: number;
  reveal?: Reveal;
  summary?: SummaryItem[];
  message?: string;
};

export type YouInfo = {
  id: string;
  token: string;
  isDrawer: boolean;
  hasGuessed: boolean;
};

export type ClientState = RoomState & {
  you?: YouInfo;
  privateWord?: string;
};

export type JoinPayload = {
  name: string;
  playerId?: string;
  token?: string;
};

export type StrokeChunk = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool?: 'fill' | 'erase';
};

export type ErasePayload = {
  x: number;
  y: number;
  radius: number;
  aspect: number;
};

export type TickPayload = {
  phase: Phase;
  subPhase: SubPhase;
  secondsLeft: number;
  maskedWord?: string;
};

export type GuessSuccessPayload = {
  playerId: string;
  name: string;
  points: number;
  position: number;
};
