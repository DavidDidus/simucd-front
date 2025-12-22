import React, { useEffect, useRef, useState } from "react";

interface WaitBarChartProps {
  data: Record<string, number> | null | undefined;
  title?: string;
  className?: string;
  unit?: string; // "min", "seg", etc.
}

const LABELS: Record<string, string> = {
  picker: "Pickers",
  grua: "Grueros",
  chequeador: "Chequeadores",
  parrillero: "Consol.",
};

export default function WaitBarChart({
  data,
  title = "Espera promedio por recurso",
  className = "",
  unit = "min",
}: WaitBarChartProps) {
  if (!data) {
    return (
      <div className={`subcard ${className}`}>
        <div className="card-title">{title}</div>
        <div className="empty-state">Sin datos de espera.</div>
      </div>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <div className={`subcard ${className}`}>
        <div className="card-title">{title}</div>
        <div className="empty-state">Sin datos de espera.</div>
      </div>
    );
  }

  const values = entries.map(([, v]) => v);
  const maxValue = Math.max(...values, 0.0001);

  const maxAxis = Math.ceil(maxValue);
  const numTicks = 4;
  const step = maxAxis / numTicks;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) =>
    +(i * step).toFixed(1)
  );

  // --- refs para alinear el eje con las barras ---
  const labelRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef<HTMLDivElement | null>(null);
  const [labelWidth, setLabelWidth] = useState(0);
  const [valueWidth, setValueWidth] = useState(0);

  useEffect(() => {
    const l = labelRef.current;
    const v = valueRef.current;
    if (!l && !v) return;

    const update = () => {
      if (l) setLabelWidth(l.offsetWidth);
      if (v) setValueWidth(v.offsetWidth);
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      if (l) ro.observe(l);
      if (v) ro.observe(v);
      return () => ro.disconnect();
    }
  }, []);

  return (
    <div className={`subcard wait-chart ${className}`}>
      <div className="card-title">
        {title} <span className="axis-unit">({unit})</span>
      </div>

      {/* Eje X alineado automáticamente con las barras */}
      <div
        className="wait-chart-axis"
        style={{
             // mismo “offset” que las etiquetas
          paddingRight: valueWidth,  // mismo espacio que la columna de valores
        }}
      >
        {ticks.map((t) => (
          <span key={t} className="wait-chart-tick">
            {t}
          </span>
        ))}
      </div>

      <div className="wait-chart-body">
        {entries.map(([key, value], index) => {
          const label = LABELS[key] ?? key;
          const widthPct = (value / maxAxis) * 100;
          const isFirst = index === 0;

          return (
            <div key={key} className="wait-row">
              <div
                className="wait-label"
                ref={isFirst ? labelRef : undefined}
              >
                {label}
              </div>
              <div className="wait-bar-wrapper">
                <div
                  className="wait-bar-fill"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div
                className="wait-value"
                ref={isFirst ? valueRef : undefined}
              >
                {value.toFixed(2)} {unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
