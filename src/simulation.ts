import type { Params, SimResult } from "./types";

// Tasas de proceso (cajas/hora) de ejemplo para ilustrar
const RATES = {
  picker: 110,
  grua: 260,
  consolidador: 520,
  chequeador: 190,
};

export function simulate(p: Params): SimResult {
  const capacidades = {
    Pickers: p.pickers * RATES.picker,
    Gruas: p.grueros * RATES.grua,
    "Consolidador de carga": p.consolidadores * RATES.consolidador,
    Chequeadores: p.chequeadores * RATES.chequeador,
  };

  // capacidad del sistema = el mínimo (cuello de botella)
  const entries = Object.entries(capacidades);
  const [cuello, cap] = entries.reduce(
    (min, cur) => (cur[1] < min[1] ? cur : min),
    entries[0]
  );

  const pendientes = Math.max(0, p.cajasFacturadas - p.cajasPiqueadas);
  const horas = pendientes === 0 ? 0 : +(pendientes / cap).toFixed(2);

  return {
    capacidadPorHora: Math.floor(cap),
    pendientes,
    horasParaTerminar: horas,
    cuelloBotella: cuello,
  };
}
