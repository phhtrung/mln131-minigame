export const EVENTS = {
  roomState: 'room_state',
  joinRoom: 'join_room',
  kickPlayer: 'kick_player',
  startGame: 'start_game',
  chooseWord: 'choose_word',
  strokeChunk: 'stroke_chunk',
  erase: 'erase',
  undo: 'undo',
  clearCanvas: 'clear_canvas',
  submitGuess: 'submit_guess',
  submitQuiz: 'submit_quiz',
  revealQuiz: 'reveal_quiz',
  reaction: 'reaction',
  nextRound: 'next_round',
  advanceRound: 'advance_round',
  tick: 'tick',
  guessSuccess: 'guess_success',
  toast: 'toast',
} as const;

export const PROJECTOR_PASSWORD_AUTH = 'projectorPassword';

export const PROJECTOR_REJECTED_ERROR = 'projector_password_required';
