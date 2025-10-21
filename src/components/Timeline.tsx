import React from "react";

export type TimelineProps = {
  timePoints: Array<{ time: string; label: string; isEnd?: boolean }>;
  label?: string;
  className?: string;
  /** minutos entre ticks del eje (grid) */
  tickEvery?: number;
  /** minutos entre etiquetas de hora del eje (múltiplo de tickEvery). Ej: 60, 120… */
  axisLabelEvery?: number;
  /** altura mínima del SVG */
  height?: number;
  /** mostrar la hora junto a cada evento */
  showPointTime?: boolean;
  /** ocultar la hora del evento si cae en un tick del eje que ya está rotulado */
  dedupePointTimes?: boolean;
  /** 0 = sin jitter (alineado exacto con su guía). 1 = jitter suave anti-choque */
  labelJitter?: number;
};

const Timeline: React.FC<TimelineProps> = ({
  timePoints,
  label = "Línea de tiempo",
  className,
  tickEvery = 60,
  axisLabelEvery,
  height = 180,
  showPointTime = true,
  dedupePointTimes = true,
  labelJitter = 0,
}) => {
  const width = 900;
  const margin = { top: 24, right: 26, bottom: 26, left: 26 };

  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const hourLabel = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  if (!timePoints?.length) return <div className={className}>No hay datos para mostrar</div>;

  // --- Eje X ---
  const times = timePoints.map(p => toMin(p.time));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const start = Math.floor(minTime / tickEvery) * tickEvery;
  const end = Math.ceil(maxTime / tickEvery) * tickEvery;
  const total = Math.max(end - start, tickEvery);
  const iw = width - margin.left - margin.right;
  const xPos = (mins: number) => ((mins - start) / total) * iw;

  const labelEvery = Math.max(tickEvery, axisLabelEvery ?? tickEvery);
  const labelStep = Math.max(1, Math.round(labelEvery / tickEvery));
  const isOnAxisLabel = (mins: number) =>
    ((mins - start) % labelEvery + labelEvery) % labelEvery === 0;

  // --- Aproximación de ancho de texto ---
  const approxTextWidth = (text: string, fontSize = 11) => {
    const base = Math.max(text.length, 1) * fontSize * 0.56;
    const extra = (text.match(/\s/g)?.length || 0) * (fontSize * 0.1);
    return Math.min(Math.max(base + extra, 28), 420);
  };

  type Node = {
    time: string; label: string; isEnd?: boolean; mins: number; x: number; idx: number;
    band: number;    // -1,+1,-2,+2…
    width: number;   // ancho estimado de la etiqueta (incluye hora si aplica)
    hideTime: boolean;
  };

  const sorted: Node[] = timePoints
    .map((p, idx) => {
      const mins = toMin(p.time);
      const x = xPos(mins);
      const width = approxTextWidth(p.label) + (showPointTime ? 36 : 0);
      const hideTime = dedupePointTimes && isOnAxisLabel(mins);
      return { ...p, mins, x, idx, band: 0, width, hideTime };
    })
    .sort((a, b) => a.x - b.x);

  // --- Asignación de bandas anti-colisión ---
  const rangesByBand = new Map<number, Array<{ xStart: number; xEnd: number }>>();
  const overlaps = (band: number, xCenter: number, halfW: number) => {
    const rng = rangesByBand.get(band) || [];
    const xs = xCenter - halfW - 6, xe = xCenter + halfW + 6;
    return rng.some(r => xs < r.xEnd && xe > r.xStart);
  };
  const pushRange = (band: number, xCenter: number, halfW: number) => {
    const xs = xCenter - halfW - 6, xe = xCenter + halfW + 6;
    const arr = rangesByBand.get(band) || [];
    arr.push({ xStart: xs, xEnd: xe });
    rangesByBand.set(band, arr);
  };
  sorted.forEach(p => {
    let depth = 1, assigned: number | null = null;
    const halfW = p.width / 2;
    while (assigned === null) {
      for (const candidate of [-depth, +depth]) {
        if (!overlaps(candidate, p.x, halfW)) { assigned = candidate; break; }
      }
      if (assigned === null) depth++;
      if (depth > 12) assigned = +1;
    }
    p.band = assigned!;
    pushRange(assigned!, p.x, halfW);
  });

  const points = sorted.sort((a, b) => a.idx - b.idx);

  // --- Parámetros de layout ---
  const LEVEL_SPACING = 38;
  const BASE_OFFSET = 22;
  const LINE_CLEARANCE = 10;
  const LABEL_EXTRA = 16;
  const TICKS_SPACE = 22;

  const maxUp = Math.max(0, ...points.filter(p => p.band < 0).map(p => Math.abs(p.band)));
  const maxDown = Math.max(0, ...points.filter(p => p.band > 0).map(p => p.band));

  const topNeed = BASE_OFFSET + LINE_CLEARANCE + (maxUp > 0 ? (maxUp - 1) * LEVEL_SPACING : 0) + LABEL_EXTRA;
  const bottomNeed = BASE_OFFSET + LINE_CLEARANCE + (maxDown > 0 ? (maxDown - 1) * LEVEL_SPACING : 0) + LABEL_EXTRA + TICKS_SPACE;

  const effectiveHeight = Math.max(height, margin.top + topNeed + bottomNeed + margin.bottom);
  const ih = effectiveHeight - margin.top - margin.bottom;
  const baselineY = topNeed;

  const steps = Math.floor(total / tickEvery);

  // --- Cálculo final de posiciones / cajas de texto ---
  const LABEL_H = 12;
  const TIME_H = showPointTime ? 10 : 0;
  const TICK_HALF = 14;
  const TICK_PAD = 6;
  const jitterVal = (w: number, i: number) =>
    (i % 2 === 0 ? -1 : 1) * Math.min(8, w * 0.06) * labelJitter;

  type RenderPoint = {
    p: Node;
    depth: number; dir: -1 | 1;
    labelY: number; timeY: number; anchor: "start"|"middle"|"end"; x: number;
    boxLeft: number; boxRight: number; boxTop: number; boxBottom: number;
    connectorEndY: number;
  };

  const textAnchorData = (xCenter: number, width: number) => {
    const half = width / 2;
    if (xCenter - half < 0) return { anchor: "start" as const, x: Math.max(0, xCenter - half) + 2 };
    if (xCenter + half > iw) return { anchor: "end" as const, x: Math.min(iw, xCenter + half) - 2 };
    return { anchor: "middle" as const, x: xCenter };
  };

  const renderPoints: RenderPoint[] = points.map((p, i) => {
    const depth = Math.max(1, Math.abs(p.band));
    const dir = (p.band < 0 ? -1 : 1) as -1 | 1;
    const offset = BASE_OFFSET + LINE_CLEARANCE + (depth - 1) * LEVEL_SPACING;
    const labelY = baselineY + dir * offset;
    const timeY  = showPointTime && !p.hideTime ? (labelY + dir * 14) : labelY;
    const j = jitterVal(p.width, i);
    const { anchor, x } = textAnchorData(p.x + j, p.width);

    // Caja vertical que ocupa etiqueta+hora en el mismo lado
    const boxHalfLabel = LABEL_H / 2, boxHalfTime = TIME_H / 2;
    const boxTop = dir === -1
      ? (showPointTime && !p.hideTime ? timeY - boxHalfTime : labelY - boxHalfLabel) - TICK_PAD
      : (labelY - boxHalfLabel) - TICK_PAD;
    const boxBottom = dir === -1
      ? (labelY + boxHalfLabel) + TICK_PAD
      : (showPointTime && !p.hideTime ? timeY + boxHalfTime : labelY + boxHalfLabel) + TICK_PAD;

    const halfW = p.width / 2;
    const boxLeft = Math.max(0, (anchor === "start" ? x : (anchor === "end" ? x - p.width : x - halfW)) - 2);
    const boxRight = Math.min(iw, (anchor === "start" ? x + p.width : (anchor === "end" ? x : x + halfW)) + 2);

    // Punto final de la guía: se detiene antes de tocar el texto
    const connectorEndY =
      dir === -1
        ? Math.min(baselineY - 6, boxBottom - 6)
        : Math.max(baselineY + 6, boxTop + 6);

    return { p, depth, dir, labelY, timeY, anchor, x, boxLeft, boxRight, boxTop, boxBottom, connectorEndY };
  });

  return (
    <div className={className}>
      {label && <div className="card-title">{label}</div>}
      <svg
        viewBox={`0 0 ${width} ${effectiveHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%" }}
        role="img"
        aria-label={label}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Línea base */}
          <line x1="0" y1={baselineY} x2={iw} y2={baselineY} stroke="#6aa86b" strokeWidth="6" strokeLinecap="round" />
          {/* Flecha */}
          <polygon points={`${iw},${baselineY - 8} ${iw + 14},${baselineY} ${iw},${baselineY + 8}`} fill="#6aa86b" />

          {/* Ticks + horas del eje (no todos llevan hora) */}
          {Array.from({ length: steps + 1 }).map((_, i) => {
            const t = start + i * tickEvery;
            const x = xPos(t);

            let y1 = baselineY - TICK_HALF;
            let y2 = baselineY + TICK_HALF;

            // Recortar tick si hay etiquetas arriba/abajo
            for (const rp of renderPoints) {
              if (x >= rp.boxLeft && x <= rp.boxRight) {
                if (rp.dir === -1) y1 = Math.max(y1, rp.boxBottom);
                else y2 = Math.min(y2, rp.boxTop);
              }
            }
            if (y2 - y1 < 4) {
              const mid = baselineY;
              y1 = mid - 2; y2 = mid + 2;
            }

            const showAxisText = i % labelStep === 0 || i === 0 || i === steps;

            return (
              <g key={i}>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#2E6514" strokeWidth="4" />
                {showAxisText && (
                  <text x={x} y={ih - 6} fontSize="12" textAnchor="middle" fill="#2b5d15">
                    {hourLabel(t)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Puntos y etiquetas */}
          {renderPoints.map(({ p, depth, dir, labelY, timeY, anchor, x, connectorEndY }, i) => (
            <g key={p.idx}>
              <line
                x1={p.x} y1={baselineY} x2={p.x} y2={connectorEndY}
                stroke="#2E6514" strokeWidth="2" strokeDasharray={depth > 1 ? "3,3" : "0"} opacity="0.45"
              />
              {p.isEnd ? (
                <text x={p.x} y={labelY} textAnchor="middle" fontSize="22" fill="#2E6514">★</text>
              ) : (
                <circle cx={p.x} cy={baselineY} r="6" fill="#2E6514" />
              )}
              <text
                x={x} y={labelY} fontSize="11" textAnchor={anchor}
                fill="#264831" fontWeight="600" dominantBaseline="middle"
                style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.75)", strokeWidth: 2 }}
              >
                {p.label}
              </text>
              {showPointTime && !p.hideTime && (
                <text
                  x={x} y={timeY} fontSize="10" textAnchor={anchor}
                  fill="#2b5d15" dominantBaseline="middle"
                  style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.75)", strokeWidth: 2 }}
                >
                  {p.time}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default Timeline;
