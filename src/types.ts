export type Params = {
  pickers: number;
  grueros: number;
  consolidadores: number;
  chequeadores: number;
  cajasFacturadas: number;
  cajasPiqueadas: number;
  camiones: number;
};

export type SimResult = {
  capacidadPorHora: number;
  pendientes: number;
  horasParaTerminar: string;
  cuelloBotella: string;
};

export type Shift = 'noche' | 'turnoA' | 'turnoB';
export type ShiftResources = { noche: number; turnoA: number; turnoB: number };
export type Point = { x: number; y: number }; // coordenadas normalizadas 0..1
