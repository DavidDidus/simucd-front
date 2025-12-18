import type { TabId } from "../components/layout/Tabs";

export function readOccupation(
  rec: any,
  key: "pickers" | "grueros" | "parrilleros" | "chequeadores",
  tab: TabId,
): number {
  // Turno noche
  if (tab === "noche") {
    const ocupacion = rec?.[key]?.porcentaje_ocupacion;
    return typeof ocupacion === "number" ? ocupacion : 0;
  }
  
  // Turnos de día (A o B)
  const turno = tab === "diaA" ? "turno_A" : "turno_B";
  const ocupacion = rec?.[turno]?.[key]?.ocupacion;
  
  return typeof ocupacion === "number" ? ocupacion : 0;
}

export function buildUtilization(
  tab: TabId,
  recDia: any,
  recNoche: any
): number[] {
  if (tab === "noche" && recNoche) {
    return [
      readOccupation(recNoche, "pickers", tab),
      readOccupation(recNoche, "grueros", tab),
      readOccupation(recNoche, "parrilleros", tab),
      readOccupation(recNoche, "chequeadores", tab),
    ];
  }
  if (recDia) {
    return [
      readOccupation(recDia, "grueros", tab),
      readOccupation(recDia, "parrilleros", tab),
      readOccupation(recDia, "chequeadores", tab),
    ];
  }

  return [0, 0, 0, 0];
}

export function buildTimeline(tab: TabId, norm: any) {
  const arr = tab === "noche" ? (norm.noche?.timeline ?? []) : (norm.dia?.timeline ?? []);
  return (arr || []).map((p: any) => ({
    time: p.hora ?? p.time ?? p.hhmm ?? p.t ?? "00:00",
    label: p.descripcion ?? p.label ?? p.evento ?? "",
    isEnd: p.isEnd ?? p.final ?? false,
  }));
}

export function getFormattedActiveTime(
  recurso: "pickers" | "grueros" | "chequeadores" | "parrilleros",
  tab: TabId,
  norm: any
): string {
  const minutes =
  tab === "noche"
    ? norm.noche?.ocupacion_recursos?.[recurso]?.tiempo_activo_total_min  // Si es noche
    : tab === "diaA"
    ? norm.dia?.metricas_turnos?.turno_A?.[recurso]?.tiempo_activo_min  // Si es diaA
    : norm.dia?.metricas_turnos?.turno_B?.[recurso]?.tiempo_activo_min;  // Si es diaB

  if (minutes == null || Number.isNaN(Number(minutes))) return "N/A";

  const cantidadPersonal = norm.noche?.ocupacion_recursos?.[recurso]?.capacidad_recursos;
  const total = Math.round(Number(minutes) / (cantidadPersonal || 1));
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  const hhStr = hh.toString().padStart(2, "0");
  const mmStr = mm.toString().padStart(2, "0");

  return `${hhStr}:${mmStr} h`;
}

export function getStaffValues(tab: TabId, night: any, dayA: any, dayB: any): number[] {
  const s = tab === "noche" ? night : tab === "diaA" ? dayA : dayB;
  if(tab === "noche"){
    return [s.pickers, s.grueros, s.consolidadores, s.chequeadores];

  }else{
    return [s.grueros, s.consolidadores, s.chequeadores];
  }
}