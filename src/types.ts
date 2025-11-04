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
