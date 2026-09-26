import type { Player } from '../shared/types';

function sortedPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || b.quizCorrect - a.quizCorrect || b.firstGuesses - a.firstGuesses);
}

export function leaderboardToText(players: Player[]): string {
  const sorted = sortedPlayers(players);
  const lines = [
    'Bảng xếp hạng — Gia đình Việt Nam · Đoán nét, nhớ ý',
    new Date().toLocaleString('vi-VN'),
    '',
    ...sorted.map((player, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} ${player.name} — ${player.score} điểm (quiz đúng: ${player.quizCorrect}, đoán đầu: ${player.firstGuesses})`;
    }),
  ];
  return lines.join('\n');
}

export async function copyLeaderboard(players: Player[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(leaderboardToText(players));
    return true;
  } catch {
    return false;
  }
}

export function downloadLeaderboardPng(players: Player[], code: string): void {
  const sorted = sortedPlayers(players);
  const width = 1000;
  const headerHeight = 200;
  const rowHeight = 58;
  const height = headerHeight + rowHeight * Math.max(sorted.length, 1) + 48;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;

  context.fillStyle = '#ebe8e2';
  context.fillRect(0, 0, width, height);

  context.textAlign = 'left';
  context.fillStyle = '#242323';
  context.font = '800 42px "IBM Plex Sans", Arial, sans-serif';
  context.fillText('GIA ĐÌNH VIỆT NAM · ĐOÁN NÉT, NHỚ Ý', 40, 74);
  context.fillStyle = '#746f69';
  context.font = '600 21px "IBM Plex Sans", Arial, sans-serif';
  context.fillText(`Bảng xếp hạng · Phòng ${code} · ${new Date().toLocaleString('vi-VN')}`, 40, 114);
  context.fillStyle = '#ec2ce2';
  context.fillRect(40, 136, 170, 8);

  const medalColors = ['#f5c518', '#b8b8b8', '#d29b6a'];
  sorted.forEach((player, index) => {
    const y = headerHeight + index * rowHeight;
    if (index < 3) {
      context.fillStyle = medalColors[index];
      context.fillRect(40, y + 8, 8, rowHeight - 28);
    }
    context.fillStyle = index === 0 ? '#1769e8' : '#242323';
    context.font = '800 28px "IBM Plex Sans", Arial, sans-serif';
    context.fillText(String(index + 1).padStart(2, '0'), 70, y + 36);
    context.fillStyle = '#242323';
    context.font = '700 26px "IBM Plex Sans", Arial, sans-serif';
    context.fillText(player.name.slice(0, 24), 136, y + 36);
    context.textAlign = 'right';
    context.font = '800 28px "IBM Plex Sans", Arial, sans-serif';
    context.fillText(String(player.score), width - 56, y + 36);
    context.textAlign = 'left';
  });

  const link = document.createElement('a');
  link.download = `xep-hang-mln131-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
