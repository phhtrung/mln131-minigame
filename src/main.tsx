import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { EVENTS } from '../shared/events';
import type { ClientState, Stroke } from '../shared/types';
import './styles.css';

/*
IMPECCABLE DIRECTION CONTRACT
WORLD — New Vietnam Poster Club: a contemporary Vietnamese cultural poster in motion, printed on warm gray paper with ink-black structure, blue action/time, and magenta registration accents.
FORM — Poster Stage, resolved from direction seed 9acf492d. The interface is one asymmetric printed sheet: monumental facts, a grid-breaking live canvas, and a narrow editorial colophon rather than a dashboard of cards.
FIRST VIEWPORT — The round and timer arrive at billboard scale; the live canvas owns most of the field; guessing, reactions, and standings read down the rail. On phones this becomes headline/time, canvas, primary action, reactions, then score.
BEHAVIOR — Phase changes cut decisively. Reactions pop once, urgent time visibly tightens, drawing remains immediate, and reduced-motion becomes instant. Real product state always outranks decoration.
FINISH — unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
*/

const REACTIONS = ['👏', '💡', '❤️', '🤔', '🎉'];

function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const isHost = params.get('host') === '1';
  const isProjector = params.get('projector') === '1';
  const linkedName = (params.get('name') ?? '').trim().slice(0, 24);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<ClientState | null>(null);
  const [joined, setJoined] = useState(isHost || isProjector || Boolean(linkedName));
  const [toastMessage, setToastMessage] = useState('');
  const [name, setName] = useState(() => linkedName || localStorage.getItem('mln131-name') || '');

  useEffect(() => {
    const nextSocket = io(window.location.origin, { query: { host: isHost ? '1' : '0' } });
    setSocket(nextSocket);
    if (linkedName) nextSocket.on('connect', () => nextSocket.emit(EVENTS.joinRoom, { name: linkedName }));
    nextSocket.on(EVENTS.roomState, (nextState: ClientState) => setState(nextState));
    nextSocket.on(EVENTS.stroke, (stroke: Stroke) => setState((current) => current ? { ...current, strokes: [...current.strokes, stroke] } : current));
    nextSocket.on(EVENTS.clearCanvas, () => setState((current) => current ? { ...current, strokes: [] } : current));
    nextSocket.on(EVENTS.toast, (message: string) => {
      setToastMessage(message);
      window.setTimeout(() => setToastMessage(''), 2600);
    });
    return () => { nextSocket.disconnect(); };
  }, [isHost, linkedName]);

  const join = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!socket || !trimmed) return;
    localStorage.setItem('mln131-name', trimmed);
    socket.emit(EVENTS.joinRoom, { name: trimmed });
    setJoined(true);
  };

  if (!state || !socket) return <><LoadingScreen /><Toast message={toastMessage} /></>;
  if (!joined && !isProjector) return <><JoinScreen name={name} setName={setName} onSubmit={join} /><Toast message={toastMessage} /></>;
  if (isProjector) return <><ProjectorScreen state={state} /><Toast message={toastMessage} /></>;
  if (state.phase === 'lobby') return <><LobbyScreen state={state} socket={socket} isHost={isHost} /><Toast message={toastMessage} /></>;
  return <><GameScreen state={state} socket={socket} isHost={isHost} /><Toast message={toastMessage} /></>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/">gia đình <span>↗</span></a>
        <span className="topbar-rule" aria-hidden="true" />
        <span className="course-mark">MLN131</span>
      </header>
      <span className="registration-mark registration-mark-left" aria-hidden="true" />
      <span className="registration-mark registration-mark-right" aria-hidden="true" />
      <span className="poster-fragment fragment-a" aria-hidden="true" />
      <span className="poster-fragment fragment-b" aria-hidden="true" />
      <span className="poster-fragment fragment-c" aria-hidden="true" />
      {children}
    </main>
  );
}

function LoadingScreen() {
  return <PageShell><section className="center-state"><span className="loader" />Đang kết nối phòng chơi…</section></PageShell>;
}

function JoinScreen({ name, setName, onSubmit }: { name: string; setName: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <PageShell>
      <section className="hero hero-join">
        <h1>Đoán nét,<br /><span>nhớ ý.</span></h1>
        <form className="join-form" onSubmit={onSubmit}>
          <label htmlFor="player-name">Tên hiển thị</label>
          <div className="input-row">
            <input id="player-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập tên" maxLength={24} />
            <button className="primary-button" type="submit">Vào phòng <span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </PageShell>
  );
}

function LobbyScreen({ state, socket, isHost }: { state: ClientState; socket: Socket; isHost: boolean }) {
  return (
    <PageShell><section className="lobby-layout">
      <div className="lobby-intro">
        <h1>Lớp mình<br /><span>chơi nhé.</span></h1>
        <p className="room-code">Phòng {state.code}</p>
        {isHost ? <button className="primary-button large" onClick={() => socket.emit(EVENTS.startGame)}>Bắt đầu trò chơi <span aria-hidden="true">→</span></button> : <div className="waiting-note"><span className="pulse-dot" /> Đang chờ host bắt đầu…</div>}
      </div>
      <div className="player-card surface-card">
        <div className="card-heading"><h2>{state.players.length} người chơi <span>/60</span></h2><span className="live-tag">LIVE</span></div>
        <div className="player-list">
          {state.players.length === 0 ? <p className="empty-copy">Bạn sẽ là người đầu tiên trong phòng.</p> : state.players.map((player, index) => <div className="player-row" key={player.id}><span className="avatar">{player.name.slice(0, 1).toUpperCase()}</span><span>{player.name}</span><span className="join-order">{String(index + 1).padStart(2, '0')}</span></div>)}
        </div>
      </div>
    </section></PageShell>
  );
}

function GameScreen({ state, socket, isHost }: { state: ClientState; socket: Socket; isHost: boolean }) {
  const isDrawer = state.drawerId === socket.id;
  const hasGuessed = state.guessedPlayerIds.includes(socket.id ?? '');
  return (
    <PageShell>
      <div className="game-header">
        <div className="game-title"><p className="round-mark">{state.phase === 'finished' ? 'KẾT QUẢ' : `VÒNG ${String(state.round).padStart(2, '0')}`}<span>{state.phase === 'finished' ? '' : ` / ${String(state.totalRounds).padStart(2, '0')}`}</span></p><h1 className={isDrawer ? 'drawer-word-title' : undefined}>{state.phase === 'finished' ? 'Những nét đáng nhớ.' : isDrawer ? state.privateWord ?? 'Chọn một từ.' : 'Bạn nhìn thấy gì?'}</h1></div>
        <div className="timer" aria-label={`${state.secondsLeft} giây`}><span className={state.secondsLeft <= 5 ? 'timer-number urgent' : 'timer-number'}>{state.secondsLeft}</span><span>GIÂY</span></div>
      </div>
      {state.phase === 'finished' ? <FinalRanking state={state} /> : <div className="game-grid">
        <section className="canvas-card surface-card"><div className="canvas-topline"><span className="canvas-label">{isDrawer ? 'BẢNG VẼ CỦA BẠN' : 'BẢNG VẼ TRỰC TIẾP'}</span><span className="canvas-status"><span className="live-dot" />{isDrawer ? 'đang vẽ' : 'theo dõi'}</span></div><DrawingBoard state={state} socket={socket} interactive={isDrawer && state.phase === 'drawing' && Boolean(state.privateWord)} /></section>
        <aside className="side-stack">
          <ActionPanel state={state} socket={socket} isDrawer={isDrawer} hasGuessed={hasGuessed} isHost={isHost} />
          <ReactionPanel state={state} socket={socket} />
          <Leaderboard players={state.players} meId={socket.id} compact />
        </aside>
      </div>}
    </PageShell>
  );
}

function ActionPanel({ state, socket, isDrawer, hasGuessed, isHost }: { state: ClientState; socket: Socket; isDrawer: boolean; hasGuessed: boolean; isHost: boolean }) {
  const [guess, setGuess] = useState('');
  const submitGuess = (event: FormEvent) => { event.preventDefault(); if (guess.trim()) { socket.emit(EVENTS.submitGuess, { guess }); setGuess(''); } };
  if (state.phase === 'reveal') return <RevealCard state={state} />;
  if (isDrawer && state.phase === 'drawing' && !state.privateWord && state.wordChoices) return <div className="action-card highlighted-card"><h2>Chọn từ</h2><div className="word-choice-list">{state.wordChoices.map((word, index) => <button className="choice-button" key={word} onClick={() => socket.emit(EVENTS.chooseWord, { index })}>{word}<span>0{index + 1}</span></button>)}</div></div>;
  if (isDrawer && state.phase === 'drawing') return <div className="action-card highlighted-card"><h2>{state.privateWord}</h2><button className="ghost-button" onClick={() => socket.emit(EVENTS.clearCanvas)}>Xóa bảng vẽ</button></div>;
  if (isHost) return null;
  if (state.phase === 'quiz' && state.quiz && state.firstGuesserId === socket.id) return <QuizCard state={state} socket={socket} />;
  if ((state.phase === 'drawing' || state.phase === 'quiz') && !isDrawer) return <div className="action-card"><h2>{hasGuessed ? 'Đã ghi nhận.' : 'Bạn đoán là gì?'}</h2><form onSubmit={submitGuess} className="guess-form"><input value={guess} onChange={(event) => setGuess(event.target.value)} disabled={hasGuessed} placeholder={hasGuessed ? 'Đã ghi nhận' : 'Nhập đáp án'} /><button className="primary-button" disabled={hasGuessed}>Gửi <span aria-hidden="true">→</span></button></form></div>;
  return <p className="inline-status">Vòng tiếp theo đang chuẩn bị…</p>;
}

function QuizCard({ state, socket }: { state: ClientState; socket: Socket }) {
  const [selected, setSelected] = useState<number | null>(null);
  const submit = () => { if (selected !== null) socket.emit(EVENTS.submitQuiz, { answer: selected }); };
  return <div className="action-card quiz-card"><h2>{state.quiz?.prompt}</h2><p className="score-risk">Đúng +400 · Sai −200</p><div className="quiz-options">{state.quiz?.options.map((option, index) => <button className={selected === index ? 'quiz-option selected' : 'quiz-option'} key={option} onClick={() => setSelected(index)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><button className="primary-button" disabled={selected === null} onClick={submit}>Chốt đáp án <span aria-hidden="true">→</span></button></div>;
}

function RevealCard({ state }: { state: ClientState }) {
  const resultLabel = state.reveal?.quizResult === 'correct' ? 'Trả lời đúng · +400' : state.reveal?.quizResult === 'incorrect' ? 'Chưa đúng · −200' : state.reveal?.quizResult === 'timeout' ? 'Hết giờ · −100' : 'Cùng xem lại ý chính';
  return <div className="action-card reveal-card"><h2>{state.reveal?.word}</h2><p className="result-line">{resultLabel}</p><p>{state.reveal?.explanation}</p><div className="takeaway"><span>Ý chính</span>{state.reveal?.takeaway}</div></div>;
}

function DrawingBoard({ state, socket, interactive }: { state: ClientState; socket: Socket; interactive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStroke = useRef<Stroke | null>(null);
  const [color, setColor] = useState('#37352f');
  const [width, setWidth] = useState(5);

  const drawStroke = (context: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points.length) return;
    const rect = context.canvas.getBoundingClientRect();
    context.beginPath();
    context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = stroke.color; context.lineWidth = stroke.width;
    context.moveTo(stroke.points[0].x * rect.width, stroke.points[0].y * rect.height);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * rect.width, point.y * rect.height);
    context.stroke();
  };
  const redraw = () => { const canvas = canvasRef.current; if (!canvas) return; const context = canvas.getContext('2d'); if (!context) return; const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, rect.width, rect.height); context.fillStyle = '#ffffff'; context.fillRect(0, 0, rect.width, rect.height); state.strokes.forEach((stroke) => drawStroke(context, stroke)); };
  useEffect(() => { const canvas = canvasRef.current; if (!canvas) return; const resize = () => { const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = rect.width * ratio; canvas.height = rect.height * ratio; redraw(); }; resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, [state.strokes]);
  useEffect(() => { redraw(); }, [state.strokes]);
  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; };
  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (!interactive) return; event.currentTarget.setPointerCapture(event.pointerId); currentStroke.current = { points: [pointFromEvent(event)], color, width }; };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => { if (!interactive || !currentStroke.current) return; const point = pointFromEvent(event); currentStroke.current.points.push(point); const context = canvasRef.current?.getContext('2d'); if (context) drawStroke(context, { ...currentStroke.current, points: currentStroke.current.points.slice(-2) }); };
  const pointerUp = () => { if (!currentStroke.current) return; socket.emit(EVENTS.stroke, currentStroke.current); currentStroke.current = null; };
  return <div className="board-wrap"><canvas ref={canvasRef} className={interactive ? 'drawing-canvas interactive' : 'drawing-canvas'} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Bảng vẽ trực tiếp" />{interactive && <div className="board-tools"><div className="swatches"><button className={color === '#37352f' ? 'swatch active' : 'swatch'} style={{ background: '#37352f' }} aria-label="Màu mực" onClick={() => setColor('#37352f')} /><button className={color === '#f81ce5' ? 'swatch active' : 'swatch'} style={{ background: '#f81ce5' }} aria-label="Màu hồng" onClick={() => setColor('#f81ce5')} /><button className={color === '#0070d7' ? 'swatch active' : 'swatch'} style={{ background: '#0070d7' }} aria-label="Màu xanh" onClick={() => setColor('#0070d7')} /></div><label className="brush-label">Nét <input type="range" min="2" max="14" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label></div>}</div>;
}

function ReactionPanel({ state, socket }: { state: ClientState; socket: Socket }) {
  return <div className="reaction-card surface-card"><div className="reaction-header"><span className="eyebrow">PHẢN ỨNG</span></div><div className="reaction-row">{REACTIONS.map((reaction) => <button key={reaction} className="reaction-button" aria-label={`Gửi phản ứng ${reaction}`} onClick={() => socket.emit(EVENTS.reaction, reaction)}>{reaction}</button>)}</div><div className="reaction-feed">{state.recentReactions.slice(-3).map((item) => <span key={item.id} title={item.name}>{item.reaction}</span>)}</div></div>;
}

function Leaderboard({ players, meId, compact = false }: { players: ClientState['players']; meId?: string; compact?: boolean }) {
  const ordered = [...players].sort((a, b) => b.score - a.score || b.quizCorrect - a.quizCorrect || b.firstGuesses - a.firstGuesses);
  return <div className={compact ? 'leaderboard surface-card compact' : 'leaderboard surface-card'}><div className="card-heading"><h2>{compact ? 'Top hiện tại' : 'Kết quả công bằng'}</h2><span className="quiet-label">điểm</span></div><div className="ranking-list">{ordered.slice(0, compact ? 5 : 60).map((player, index) => <div className={player.id === meId ? 'ranking-row me' : 'ranking-row'} key={player.id}><span className="rank">{String(index + 1).padStart(2, '0')}</span><span className="rank-name">{player.name}{player.id === meId && <small>bạn</small>}</span><strong>{player.score}</strong></div>)}</div></div>;
}

function FinalRanking({ state }: { state: ClientState }) {
  return <div className="final-layout"><div className="final-copy"><h2>Cảm ơn vì đã<br /><span>cùng xây dựng.</span></h2></div><Leaderboard players={state.players} /></div>;
}

function ProjectorScreen({ state }: { state: ClientState }) {
  return <PageShell><section className="projector-layout"><div className="projector-heading"><div><p className="eyebrow">{state.phase === 'finished' ? 'KẾT QUẢ CUỐI' : `VÒNG ${state.round}/${state.totalRounds}`}</p><h1>{state.phase === 'reveal' ? state.reveal?.word : state.phase === 'finished' ? 'Bảng vàng của lớp' : state.phase === 'drawing' ? 'Đang vẽ…' : 'Sẵn sàng!'}</h1></div><div className="projector-timer">{state.secondsLeft}<span>s</span></div></div>{state.phase !== 'finished' && <DrawingBoard state={state} socket={null as unknown as Socket} interactive={false} />}{state.phase === 'reveal' && state.reveal && <div className="projector-reveal"><p>{state.reveal.explanation}</p><strong>{state.reveal.takeaway}</strong></div>}<Leaderboard players={state.players} /></section></PageShell>;
}

function Toast({ message }: { message: string }) { return message ? <div className="toast" role="status">{message}</div> : null; }

createRoot(document.getElementById('root')!).render(<App />);
