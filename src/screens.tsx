import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { EVENTS } from '../shared/events';
import type { ClientState, GuessSuccessPayload, Player, SummaryItem } from '../shared/types';
import { DrawingBoard } from './board';
import { GuessBanner, PreDrawCountdown, RoundIntro, burstConfetti } from './effects';
import { sfx } from './audio';
import { copyLeaderboard, downloadLeaderboardPng } from './export';

const REACTIONS = ['👏', '💡', '❤️', '🤔', '🎉'];

function useGameEffects(state: ClientState, isProjector: boolean) {
  const prevRef = useRef<{ phase?: string; subPhase?: string }>({});
  const [roundIntro, setRoundIntro] = useState(false);
  const [flashDraw, setFlashDraw] = useState(false);
  useEffect(() => {
    const prev = prevRef.current;
    const current = { phase: state.phase, subPhase: state.subPhase };
    if (current.phase === 'drawing' && prev.phase !== 'drawing') {
      setRoundIntro(true);
      sfx.roundStart();
      window.setTimeout(() => setRoundIntro(false), 2100);
    }
    if (current.phase === 'drawing' && current.subPhase === 'drawing' && prev.phase === 'drawing' && prev.subPhase === 'countdown') {
      setFlashDraw(true);
      window.setTimeout(() => setFlashDraw(false), 800);
    }
    if (state.phase === 'reveal' && prev.phase !== 'reveal') {
      const result = state.reveal?.quizResult;
      if (result === 'correct') sfx.fanfare();
      else if (result === 'incorrect') sfx.wrong();
    }
    if (state.phase === 'finished' && prev.phase !== 'finished') {
      sfx.finish();
      burstConfetti(isProjector ? 150 : 90);
    }
    prevRef.current = current;
  }, [state.phase, state.subPhase, state.reveal?.quizResult, isProjector]);
  return { roundIntro, flashDraw };
}

export function PageShell({ muted, onToggleMuted, children }: { muted: boolean; onToggleMuted: () => void; children: ReactNode }) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/">gia đình <span>↗</span></a>
        <span className="topbar-rule" aria-hidden="true" />
        <button
          type="button"
          className="sound-toggle"
          onClick={onToggleMuted}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
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

export function LoadingScreen({ muted, onToggleMuted }: ShellProps) {
  return <PageShell muted={muted} onToggleMuted={onToggleMuted}><section className="center-state"><span className="loader" />Đang kết nối phòng chơi…</section></PageShell>;
}

type ShellProps = { muted: boolean; onToggleMuted: () => void };

export function JoinScreen({ name, setName, onSubmit, muted, onToggleMuted }: ShellProps & { name: string; setName: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  return (
    <PageShell muted={muted} onToggleMuted={onToggleMuted}>
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

export function LobbyScreen({ state, socket, isHost, muted, onToggleMuted }: ShellProps & { state: ClientState; socket: Socket; isHost: boolean }) {
  return (
    <PageShell muted={muted} onToggleMuted={onToggleMuted}>
      <section className="lobby-layout">
        <div className="lobby-intro">
          <h1>Lớp mình<br /><span>chơi nhé.</span></h1>
          <p className="room-code">Phòng {state.code}</p>
          <p className="lobby-note">{state.message ?? 'Đợi cả lớp vào phòng rồi bắt đầu.'}</p>
          {isHost ? (
            <button className="primary-button large" onClick={() => socket.emit(EVENTS.startGame)}>Bắt đầu trò chơi <span aria-hidden="true">→</span></button>
          ) : (
            <div className="waiting-note"><span className="pulse-dot" /> Đang chờ host bắt đầu…</div>
          )}
        </div>
        <div className="player-card surface-card">
          <div className="card-heading">
            <h2>{state.players.length} người chơi <span>/60</span></h2>
            <span className="live-tag">LIVE</span>
          </div>
          <div className="player-list">
            {state.players.length === 0
              ? <p className="empty-copy">Bạn sẽ là người đầu tiên trong phòng.</p>
              : state.players.map((player, index) => (
                <div className={player.connected ? 'player-row' : 'player-row offline'} key={player.id}>
                  <span className="avatar">{player.name.slice(0, 1).toUpperCase()}</span>
                  <span>{player.name}</span>
                  <span className={`connected-dot${player.connected ? '' : ' offline'}`} title={player.connected ? 'Đang trực tuyến' : 'Đã rời phòng'} />
                  <span className="join-order">{String(index + 1).padStart(2, '0')}</span>
                </div>
              ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

type GameScreenProps = ShellProps & {
  state: ClientState;
  socket: Socket;
  isHost: boolean;
  guessBanner: GuessSuccessPayload | null;
};

export function GameScreen({ state, socket, isHost, guessBanner, muted, onToggleMuted }: GameScreenProps) {
  const you = state.you;
  const isDrawer = Boolean(you?.isDrawer);
  const hasGuessed = Boolean(you?.hasGuessed);
  const { roundIntro, flashDraw } = useGameEffects(state, false);
  const canDraw = isDrawer && state.phase === 'drawing' && state.subPhase === 'drawing' && Boolean(state.privateWord);
  const canGuess = (state.phase === 'drawing' && state.subPhase === 'drawing') || state.phase === 'quiz';
  const overlay = (
    <>
      <PreDrawCountdown phase={state.phase} subPhase={state.subPhase} secondsLeft={state.secondsLeft} flashDraw={flashDraw} />
      <GuessBanner banner={guessBanner} />
    </>
  );
  return (
    <PageShell muted={muted} onToggleMuted={onToggleMuted}>
      <RoundIntro show={roundIntro} round={state.round} totalRounds={state.totalRounds} />
      {state.phase === 'finished' ? (
        <FinalRanking state={state} socket={socket} isHost={isHost} />
      ) : (
        <>
          <div className="game-header">
            <div className="game-title">
              <p className="round-mark">VÒNG {String(state.round).padStart(2, '0')}<span> / {String(state.totalRounds).padStart(2, '0')}</span></p>
              <h1 className={isDrawer ? 'drawer-word-title' : undefined}>
                {isDrawer ? state.privateWord ?? 'Chọn một từ.' : 'Bạn nhìn thấy gì?'}
              </h1>
            </div>
            <div className="timer" aria-label={`${state.secondsLeft} giây`}>
              <span className={state.secondsLeft <= 5 ? 'timer-number urgent' : 'timer-number'}>{state.secondsLeft}</span>
              <span>GIÂY</span>
            </div>
          </div>
          <div className="game-grid">
            <section className="canvas-card surface-card">
              <div className="canvas-topline">
                <span className="canvas-label">{isDrawer ? 'BẢNG VẼ CỦA BẠN' : 'BẢNG VẼ TRỰC TIẾP'}</span>
                <span className="canvas-status"><span className="live-dot" />{canDraw ? 'đang vẽ' : 'theo dõi'}</span>
              </div>
              <MaskedWord word={isDrawer ? undefined : state.maskedWord} />
              <DrawingBoard
                strokes={state.strokes}
                interactive={canDraw}
                showTools={canDraw}
                onChunk={(chunk) => socket.emit(EVENTS.strokeChunk, chunk)}
                onUndo={() => socket.emit(EVENTS.undo)}
                onClear={() => socket.emit(EVENTS.clearCanvas)}
                overlay={overlay}
              />
            </section>
            <aside className="side-stack">
              <ActionPanel state={state} socket={socket} isDrawer={isDrawer} hasGuessed={hasGuessed} canGuess={canGuess} isHost={isHost} />
              <ReactionPanel state={state} socket={socket} />
              <Leaderboard players={state.players} meId={you?.id} compact />
            </aside>
          </div>
        </>
      )}
    </PageShell>
  );
}

function ActionPanel({ state, socket, isDrawer, hasGuessed, canGuess, isHost }: { state: ClientState; socket: Socket; isDrawer: boolean; hasGuessed: boolean; canGuess: boolean; isHost: boolean }) {
  const [guess, setGuess] = useState('');
  const submitGuess = (event: FormEvent) => {
    event.preventDefault();
    if (guess.trim()) {
      socket.emit(EVENTS.submitGuess, { guess });
      setGuess('');
    }
  };
  if (state.phase === 'reveal') return <RevealCard state={state} />;
  if (state.phase === 'finished') return null;
  if (isDrawer && state.phase === 'drawing' && state.subPhase === 'choosing' && state.wordChoices) {
    return (
      <div className="action-card highlighted-card">
        <h2>Chọn từ</h2>
        <div className="word-choice-list">
          {state.wordChoices.map((word, index) => (
            <button className="choice-button" key={word} onClick={() => socket.emit(EVENTS.chooseWord, { index })}>{word}<span>0{index + 1}</span></button>
          ))}
        </div>
      </div>
    );
  }
  if (isDrawer && state.phase === 'drawing') {
    return (
      <div className="action-card highlighted-card">
        <h2>{state.privateWord}</h2>
        <p className="drawer-note">Bạn đang vẽ — dùng bảng màu và công cụ dưới bảng vẽ.</p>
      </div>
    );
  }
  if (state.phase === 'quiz' && state.quiz && state.you && state.firstGuesserId === state.you.id) {
    return <QuizCard state={state} socket={socket} />;
  }
  if (canGuess && state.you && !isDrawer) {
    return (
      <div className="action-card">
        <h2>{hasGuessed ? 'Đã ghi nhận.' : 'Bạn đoán là gì?'}</h2>
        <form onSubmit={submitGuess} className="guess-form">
          <input
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            disabled={hasGuessed}
            placeholder={hasGuessed ? 'Đã ghi nhận' : 'Nhập đáp án (không cần dấu)'}
            aria-label="Đáp án của bạn"
          />
          <button className="primary-button" disabled={hasGuessed}>Gửi <span aria-hidden="true">→</span></button>
        </form>
      </div>
    );
  }
  if (isHost) return null;
  return <p className="inline-status">{state.message ?? 'Vòng tiếp theo đang chuẩn bị…'}</p>;
}

function QuizCard({ state, socket }: { state: ClientState; socket: Socket }) {
  const [selected, setSelected] = useState<number | null>(null);
  const submit = () => {
    if (selected !== null) socket.emit(EVENTS.submitQuiz, { answer: selected });
  };
  return (
    <div className="action-card quiz-card" key={state.quiz?.prompt}>
      <h2>{state.quiz?.prompt}</h2>
      <p className="score-risk">Đúng +400 · Sai −200 · Hết giờ −100</p>
      <div className="quiz-options">
        {state.quiz?.options.map((option, index) => (
          <button className={selected === index ? 'quiz-option selected' : 'quiz-option'} key={option} onClick={() => setSelected(index)}>
            <span>{String.fromCharCode(65 + index)}</span>{option}
          </button>
        ))}
      </div>
      <button className="primary-button" disabled={selected === null} onClick={submit}>Chốt đáp án <span aria-hidden="true">→</span></button>
    </div>
  );
}

function RevealCard({ state }: { state: ClientState }) {
  const quizResult = state.reveal?.quizResult;
  const resultLabel = quizResult === 'correct'
    ? 'Trả lời đúng · +400'
    : quizResult === 'incorrect'
      ? 'Chưa đúng · −200'
      : quizResult === 'timeout'
        ? 'Hết giờ · −100'
        : 'Cùng xem lại ý chính';
  return (
    <div className="action-card reveal-card">
      <h2>{state.reveal?.word}</h2>
      <p className="result-line">{resultLabel}</p>
      <p>{state.reveal?.explanation}</p>
      <div className="takeaway"><span>Ý chính</span>{state.reveal?.takeaway}</div>
    </div>
  );
}

function MaskedWord({ word, projector = false }: { word?: string; projector?: boolean }) {
  if (!word) return null;
  return (
    <div className={projector ? 'masked-word projector' : 'masked-word'} aria-label="Từ khóa đang được che">
      {[...word].map((character, index) => {
        if (/\s/.test(character)) return <span key={index} className="masked-gap" />;
        if (character === '•') return <span key={index} className="masked-char" />;
        return <span key={index} className="masked-char revealed">{character}</span>;
      })}
    </div>
  );
}

function ReactionPanel({ state, socket }: { state: ClientState; socket: Socket }) {
  const [cooling, setCooling] = useState(false);
  const send = (reaction: string) => {
    if (cooling) return;
    socket.emit(EVENTS.reaction, reaction);
    sfx.pop();
    setCooling(true);
    window.setTimeout(() => setCooling(false), 2600);
  };
  return (
    <div className="reaction-card surface-card">
      <div className="reaction-header"><span className="eyebrow">PHẢN ỨNG</span></div>
      <div className="reaction-row">
        {REACTIONS.map((reaction) => (
          <button key={reaction} className="reaction-button" aria-label={`Gửi phản ứng ${reaction}`} disabled={cooling} onClick={() => send(reaction)}>{reaction}</button>
        ))}
      </div>
      <div className="reaction-feed">{state.recentReactions.slice(-3).map((item) => <span key={item.id} title={item.name}>{item.reaction}</span>)}</div>
    </div>
  );
}

function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => b.score - a.score || b.quizCorrect - a.quizCorrect || b.firstGuesses - a.firstGuesses);
}

function Leaderboard({ players, meId, compact = false }: { players: Player[]; meId?: string; compact?: boolean }) {
  const ordered = sortPlayers(players);
  return (
    <div className={compact ? 'leaderboard surface-card compact' : 'leaderboard surface-card'}>
      <div className="card-heading">
        <h2>{compact ? 'Top hiện tại' : 'Kết quả công bằng'}</h2>
        <span className="quiet-label">điểm</span>
      </div>
      <div className="ranking-list">
        {ordered.slice(0, compact ? 5 : 60).map((player, index) => (
          <div className={`${player.id === meId ? 'ranking-row me' : 'ranking-row'}${player.connected ? '' : ' offline'}`} key={player.id}>
            <span className="rank">{String(index + 1).padStart(2, '0')}</span>
            <span className="rank-name">{player.name}{player.id === meId && <small>bạn</small>}</span>
            <strong>{player.score}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Podium({ players }: { players: Player[] }) {
  const ordered = sortPlayers(players);
  const top = ordered.slice(0, 3);
  if (top.length === 0) return null;
  const slots = [
    { player: top[1], place: 'second', label: '2' },
    { player: top[0], place: 'first', label: '1' },
    { player: top[2], place: 'third', label: '3' },
  ].filter((slot) => slot.player);
  return (
    <div className="podium-row" aria-label="Ba người dẫn đầu">
      {slots.map(({ player, place, label }) => (
        <div key={player.id} className={`podium-slot ${place}`}>
          {place === 'first' && <span className="podium-crown" aria-hidden="true">👑</span>}
          <span className="avatar">{player.name.slice(0, 1).toUpperCase()}</span>
          <span className="podium-name">{player.name}</span>
          <strong className="podium-score">{player.score}</strong>
          <div className="podium-base">{label}</div>
        </div>
      ))}
    </div>
  );
}

function SummaryList({ items }: { items: SummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="summary-list">
      <h3 className="summary-heading">Tổng kết kiến thức · {items.length} chủ đề đã chơi</h3>
      {items.map((item) => (
        <article key={`${item.round}-${item.word}`} className="summary-item">
          <header>
            <span className="summary-round">{String(item.round).padStart(2, '0')}</span>
            <h3>{item.word}</h3>
          </header>
          <p>{item.explanation}</p>
          <div className="summary-takeaway"><span>Ý chính</span>{item.takeaway}</div>
          <span className="summary-meta">{item.drawerName} vẽ · {item.guessedCount} bạn đoán đúng</span>
        </article>
      ))}
    </div>
  );
}

function FinalRanking({ state, socket, isHost }: { state: ClientState; socket: Socket; isHost: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const ok = await copyLeaderboard(state.players);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div className="final-layout">
      <div className="final-copy">
        <h2>Cảm ơn vì đã<br /><span>cùng xây dựng.</span></h2>
        <div className="final-actions">
          <button className="ghost-button" onClick={() => downloadLeaderboardPng(state.players, state.code)}>⬇ Tải ảnh xếp hạng</button>
          <button className="ghost-button" onClick={copy}>{copied ? '✓ Đã sao chép' : '⧉ Sao chép bảng xếp hạng'}</button>
          {isHost && <button className="primary-button restart-button" onClick={() => socket.emit(EVENTS.nextRound)}>Chơi lại <span aria-hidden="true">→</span></button>}
        </div>
        {state.summary && <SummaryList items={state.summary} />}
      </div>
      <div>
        <Podium players={state.players} />
        <Leaderboard players={state.players} />
      </div>
    </div>
  );
}

export function ProjectorScreen({ state, guessBanner, muted, onToggleMuted }: ShellProps & { state: ClientState; guessBanner: GuessSuccessPayload | null }) {
  const { roundIntro, flashDraw } = useGameEffects(state, true);
  const overlay = (
    <>
      <PreDrawCountdown phase={state.phase} subPhase={state.subPhase} secondsLeft={state.secondsLeft} flashDraw={flashDraw} />
      <GuessBanner banner={guessBanner} />
    </>
  );
  return (
    <PageShell muted={muted} onToggleMuted={onToggleMuted}>
      <section className="projector-layout">
        <RoundIntro show={roundIntro} round={state.round} totalRounds={state.totalRounds} />
        <div className="projector-heading">
          <div>
            <p className="eyebrow">{state.phase === 'finished' ? 'KẾT QUẢ CUỐI' : `VÒNG ${state.round}/${state.totalRounds}`}</p>
            <h1>
              {state.phase === 'reveal' ? state.reveal?.word : state.phase === 'finished' ? 'Bảng vàng của lớp' : state.phase === 'drawing' ? 'Đang vẽ…' : 'Sẵn sàng!'}
            </h1>
          </div>
          <div className="projector-timer">{state.secondsLeft}<span>s</span></div>
        </div>
        {state.phase === 'finished' ? (
          <>
            <Podium players={state.players} />
            {state.summary && <SummaryList items={state.summary} />}
            <Leaderboard players={state.players} />
          </>
        ) : (
          <>
            <MaskedWord word={state.maskedWord} projector />
            <DrawingBoard strokes={state.strokes} interactive={false} overlay={overlay} />
            {state.phase === 'reveal' && state.reveal && (
              <div className="projector-reveal">
                <p>{state.reveal.explanation}</p>
                <strong>{state.reveal.takeaway}</strong>
              </div>
            )}
            <Leaderboard players={state.players} />
          </>
        )}
      </section>
    </PageShell>
  );
}

export function Toast({ message }: { message: string }) {
  return message ? <div className="toast" role="status">{message}</div> : null;
}
