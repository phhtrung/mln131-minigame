export type Phase = 'lobby' | 'drawing' | 'quiz' | 'reveal' | 'finished';

export type Player = {
  id: string;
  name: string;
  score: number;
  quizCorrect: number;
  firstGuesses: number;
  connected: boolean;
  isDrawer: boolean;
};

export type Stroke = {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
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
  quizResult?: 'correct' | 'incorrect' | 'timeout' | 'not_asked';
};

export type RoomState = {
  code: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  secondsLeft: number;
  players: Player[];
  drawerId?: string;
  wordChoices?: string[];
  strokes: Stroke[];
  firstGuesserId?: string;
  guessedPlayerIds: string[];
  quiz?: Quiz;
  reveal?: Reveal;
  recentReactions: Array<{ id: string; name: string; reaction: string }>;
  message?: string;
};

export type ClientState = RoomState & {
  privateWord?: string;
  isHost?: boolean;
};
