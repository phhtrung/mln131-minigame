import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { EVENTS } from '../shared/events';
import type { ClientState, GuessSuccessPayload, Reaction, Stroke, StrokeChunk, TickPayload } from '../shared/types';
import { isMuted, setMuted, sfx } from './audio';
import { burstConfetti } from './effects';
import { GameScreen, JoinScreen, LoadingScreen, LobbyScreen, ProjectorScreen, ReactionStorm, Toast, type FlyingReaction } from './screens';
import './styles.css';

/*
IMPECCABLE DIRECTION CONTRACT
WORLD — New Vietnam Poster Club: a contemporary Vietnamese cultural poster in motion, printed on warm gray paper with ink-black structure, blue action/time, and magenta registration accents.
FORM — Poster Stage, resolved from direction seed 9acf492d. The interface is one asymmetric printed sheet: monumental facts, a grid-breaking live canvas, and a narrow editorial colophon rather than a dashboard of cards.
FIRST VIEWPORT — The round and timer arrive at billboard scale; the live canvas owns most of the field; guessing, reactions, and standings read down the rail. On phones this becomes headline/time, canvas, primary action, reactions, then score.
BEHAVIOR — Phase changes cut decisively. Reactions pop once, urgent time visibly tightens, drawing remains immediate, and reduced-motion becomes instant. Real product state always outranks decoration.
FINISH — unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
*/

type StoredSession = { id: string; token: string };

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem('mln131-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && typeof parsed.id === 'string' && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const isHost = params.get('host') === '1';
  const isProjector = params.get('projector') === '1';
  const linkedName = (params.get('name') ?? '').trim().slice(0, 24);
  const sessionRef = useRef<StoredSession | null>(readSession());
  const youIdRef = useRef<string | undefined>(undefined);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [guessBanner, setGuessBanner] = useState<GuessSuccessPayload | null>(null);
  const [flying, setFlying] = useState<FlyingReaction[]>([]);
  const [muted, setMutedState] = useState(() => isMuted());
  const [name, setName] = useState(() => linkedName || localStorage.getItem('mln131-name') || '');
  const [joined, setJoined] = useState(() => isHost || isProjector || Boolean(linkedName) || Boolean(readSession() && (linkedName || localStorage.getItem('mln131-name'))));
  const joinedRef = useRef(Boolean(linkedName) || Boolean(sessionRef.current));

  useEffect(() => {
    const nextSocket = io(window.location.origin, { query: { host: isHost || isProjector ? '1' : '0' } });
    setSocket(nextSocket);

    nextSocket.on('connect', () => {
      const storedName = (linkedName || localStorage.getItem('mln131-name') || '').trim();
      if (!storedName || !joinedRef.current) return;
      const session = sessionRef.current;
      nextSocket.emit(EVENTS.joinRoom, { name: storedName, playerId: session?.id, token: session?.token });
    });

    nextSocket.on(EVENTS.roomState, (nextState: ClientState) => {
      setState(nextState);
      youIdRef.current = nextState.you?.id;
      if (nextState.you) {
        try {
          localStorage.setItem('mln131-session', JSON.stringify({ id: nextState.you.id, token: nextState.you.token }));
          sessionRef.current = { id: nextState.you.id, token: nextState.you.token };
        } catch {
          /* ignore */
        }
      }
    });

    nextSocket.on(EVENTS.tick, (tick: TickPayload) => {
      setState((current) => {
        if (!current || tick.phase !== current.phase) return current;
        return {
          ...current,
          secondsLeft: tick.secondsLeft,
          subPhase: tick.subPhase,
          maskedWord: tick.maskedWord ?? current.maskedWord,
        };
      });
      if (
        tick.secondsLeft > 0 &&
        tick.secondsLeft <= 5 &&
        tick.phase === 'drawing' &&
        tick.subPhase === 'drawing'
      ) {
        sfx.tick();
      }
    });

    nextSocket.on(EVENTS.strokeChunk, (chunk: StrokeChunk) => {
      setState((current) => {
        if (!current || !Array.isArray(chunk?.points) || chunk.points.length === 0) return current;
        const strokes = current.strokes;
        const lastIndex = strokes.length - 1;
        if (lastIndex >= 0 && strokes[lastIndex].id === chunk.id) {
          const next = strokes.slice();
          next[lastIndex] = { ...strokes[lastIndex], points: [...strokes[lastIndex].points, ...chunk.points] };
          return { ...current, strokes: next };
        }
        return {
          ...current,
          strokes: [...strokes, { id: chunk.id, points: [...chunk.points], color: chunk.color, width: chunk.width }],
        };
      });
    });

    nextSocket.on(EVENTS.erase, (payload: { strokes?: Stroke[] }) => {
      setState((current) => {
        if (!current || !Array.isArray(payload?.strokes)) return current;
        return { ...current, strokes: payload.strokes };
      });
    });

    nextSocket.on(EVENTS.undo, (payload: { id?: string }) => {
      setState((current) => {
        if (!current || typeof payload?.id !== 'string') return current;
        return { ...current, strokes: current.strokes.filter((stroke) => stroke.id !== payload.id) };
      });
    });

    nextSocket.on(EVENTS.clearCanvas, () => {
      setState((current) => (current ? { ...current, strokes: [] } : current));
    });

    nextSocket.on(EVENTS.guessSuccess, (payload: GuessSuccessPayload) => {
      setGuessBanner(payload);
      window.setTimeout(() => setGuessBanner((current) => (current === payload ? null : current)), 2600);
      sfx.correct();
      if (payload.playerId && payload.playerId === youIdRef.current) burstConfetti(60);
    });

    nextSocket.on(EVENTS.toast, (message: string) => {
      setToastMessage(message);
      window.setTimeout(() => setToastMessage(''), 2600);
    });

    nextSocket.on(EVENTS.reaction, (payload: Reaction) => {
      if (typeof payload?.reaction !== 'string' || !payload.reaction) return;
      const id = typeof payload.id === 'string' && payload.id ? payload.id : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: FlyingReaction = { id, reaction: payload.reaction, x: 4 + Math.random() * 88, drift: Math.round(Math.random() * 80 - 40) };
      setFlying((current) => [...current.slice(-39), item]);
      window.setTimeout(() => {
        setFlying((current) => current.filter((entry) => entry.id !== id));
      }, 3400);
    });

    return () => {
      nextSocket.disconnect();
    };
  }, [isHost, isProjector, linkedName]);

  const join = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!socket || !trimmed) return;
    try {
      localStorage.setItem('mln131-name', trimmed);
    } catch {
      /* ignore */
    }
    const session = sessionRef.current;
    joinedRef.current = true;
    socket.emit(EVENTS.joinRoom, { name: trimmed, playerId: session?.id, token: session?.token });
    setJoined(true);
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const shellProps = { muted, onToggleMuted: toggleMuted };

  if (!state || !socket) return <><LoadingScreen {...shellProps} /><ReactionStorm flying={flying} /><Toast message={toastMessage} /></>;
  if (isProjector) return <><ProjectorScreen state={state} socket={socket} guessBanner={guessBanner} {...shellProps} /><ReactionStorm flying={flying} /><Toast message={toastMessage} /></>;

  const inRoom = Boolean(state.you && state.players.some((player) => player.id === state.you?.id));
  if (!joined || (state.phase === 'lobby' && !inRoom && !isHost)) {
    return <><JoinScreen name={name} setName={setName} onSubmit={join} {...shellProps} /><ReactionStorm flying={flying} /><Toast message={toastMessage} /></>;
  }
  if (state.phase === 'lobby') return <><LobbyScreen state={state} socket={socket} isHost={isHost} {...shellProps} /><ReactionStorm flying={flying} /><Toast message={toastMessage} /></>;
  return <><GameScreen state={state} socket={socket} isHost={isHost} guessBanner={guessBanner} {...shellProps} /><ReactionStorm flying={flying} /><Toast message={toastMessage} /></>;
}

createRoot(document.getElementById('root')!).render(<App />);
