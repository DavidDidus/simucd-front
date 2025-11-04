import type { TabId } from "../components/Tabs";

export function readOccupation(
  rec: any,
  key: "pickers" | "grueros" | "parrilleros" | "chequeadores",
  turnoIndex?: number
): number {
  const item = rec?.[key];
  if (!item) return 0;
  if (typeof turnoIndex === "number") {
    const arr = item?.por_turno_dia;
    const v = Array.isArray(arr) && arr[turnoIndex]?.porcentaje_ocupacion;
    return typeof v === "number" ? v : 0;
  }
  const v = item?.porcentaje_ocupacion;
  return typeof v === "number" ? v : 0;
}

export function buildUtilization(
  tab: TabId,
  recDia: any,
  recNoche: any
): number[] {
  if (tab === "noche" && recNoche) {
    return [
      readOccupation(recNoche, "pickers"),
      readOccupation(recNoche, "grueros"),
      readOccupation(recNoche, "parrilleros"),
      readOccupation(recNoche, "chequeadores"),
    ];
  }

  const idx = tab === "diaA" ? 0 : 1;
  if (recDia) {
    return [
      readOccupation(recDia, "pickers", idx),
      readOccupation(recDia, "grueros", idx),
      readOccupation(recDia, "parrilleros", idx),
      readOccupation(recDia, "chequeadores", idx),
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
      ? norm.noche?.ocupacion_recursos?.[recurso]?.tiempo_activo_total_min
      : norm.dia?.ocupacion_recursos?.[recurso]?.tiempo_activo;

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
  return [s.pickers, s.grueros, s.consolidadores, s.chequeadores];
}