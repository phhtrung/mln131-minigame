import type { GuessSuccessPayload } from '../shared/types';

export function burstConfetti(count = 60) {
  if (typeof document === 'undefined') return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 940)}px`);
    piece.style.setProperty('--dy', `${Math.round(-Math.random() * 520 - 120)}px`);
    piece.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    piece.style.setProperty('--hue', `${Math.floor(Math.random() * 360)}`);
    piece.style.animationDelay = `${Math.round(Math.random() * 180)}ms`;
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 2100);
}

export function GuessBanner({ banner }: { banner: GuessSuccessPayload | null }) {
  if (!banner) return null;
  return (
    <div className="guess-banner" role="status">
      <span aria-hidden="true">🎉</span>
      <strong>{banner.name}</strong>
      <span>đã đoán đúng</span>
      <span className="guess-banner-points">+{banner.points}</span>
    </div>
  );
}

export function PreDrawCountdown({
  phase,
  subPhase,
  secondsLeft,
  flashDraw,
}: {
  phase: string;
  subPhase: string;
  secondsLeft: number;
  flashDraw: boolean;
}) {
  if (phase === 'drawing' && subPhase === 'countdown') {
    return (
      <div className="countdown-overlay">
        <span key={secondsLeft} className="countdown-number">{Math.max(1, secondsLeft)}</span>
        <span className="countdown-hint">chuẩn bị vẽ</span>
      </div>
    );
  }
  if (flashDraw) {
    return (
      <div className="countdown-overlay">
        <span className="countdown-number draw-flash">VẼ!</span>
      </div>
    );
  }
  return null;
}

export function RoundIntro({ show, round, totalRounds }: { show: boolean; round: number; totalRounds: number }) {
  if (!show || round < 1) return null;
  return (
    <div className="round-intro" aria-hidden="true">
      <div>
        <span>VÒNG</span> {String(round).padStart(2, '0')}
        <span>/{String(totalRounds).padStart(2, '0')}</span>
      </div>
    </div>
  );
}
