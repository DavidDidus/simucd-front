import type { Shift } from '../types';

export const formatHM = (totalSec: number) => {
  const t = Math.max(0, Math.floor(totalSec) % 86400);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const shiftForSecond = (totalSec: number): Shift => {
  const h = Math.floor((Math.floor(totalSec) % 86400) / 3600);
  if (h < 8) return 'noche';
  if (h < 16) return 'turnoA';
  return 'turnoB';
};

export const shiftLabel = (s: Shift) =>
  s === 'noche' ? 'Noche' : s === 'turnoA' ? 'Turno A' : 'Turno B';
