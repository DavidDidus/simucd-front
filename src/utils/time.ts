import type { Shift } from '../types';

export const formatHM = (totalSec: number) => {
  const t = Math.max(0, Math.floor(totalSec) % 86400);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const parseHM = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return 0; // Valor por defecto si el formato es inválido
  }
  return h * 3600 + m * 60;
};

export const shiftForSecond = (totalSec: number): Shift => {
  const h = Math.floor((Math.floor(totalSec) % 86400) / 3600);
  if (h < 8) return 'noche';
  if (h < 16) return 'turnoA';
  return 'turnoB';
};

export const shiftLabel = (s: Shift) =>
  s === 'noche' ? 'Noche' : s === 'turnoA' ? 'Turno A' : 'Turno B';


export interface WaitTimePoint {
  recurso: string;
  esperaPromedio: number;
}

export function buildWaitTimeChartData(
  tiempos: Record<string, number>
): WaitTimePoint[] {
   if (!tiempos) {
    return [];
  }
  const labelMap: Record<string, string> = {
    picker: "Picker",
    grua: "Gruero",
    chequeador: "Chequeador",
    parrillero: "Parrillero",
  };

  return Object.entries(tiempos).map(([key, value]) => ({
    recurso: labelMap[key] ?? key,
    esperaPromedio: value,
  }));
}

