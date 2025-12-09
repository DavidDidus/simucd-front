export type Params = {
  pickers: number;
  grueros: number;
  consolidadores: number;
  chequeadores: number;
  cajasFacturadas: number;
  cajasPiqueadas: number;
  camiones: number;
  personal_subestandar: number;
  entrada_subestandar: number;
  prv_danado: number;
  saca_carton: number;
  saca_film: number;
  saca_pet: number;
  personal_clasificacion: number;
  entrada_clasificacion: number;
  entrada_estandarizacion: number;
  personal_reempaque: number;
  entrada_reempaque: number;
  entrada_sin_recurso: number;

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




