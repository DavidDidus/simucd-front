import React from "react";

export type BarChartProps = {
  labels: string[];
  values: number[]; // cantidad de recursos (solo para mostrar arriba de la barra)
  /** porcentajes de utilización (0-100) */
  utilization?: number[];
  title?: string;
  className?: string;
  height?: number;
  showValues?: boolean;
  showUtilization?: boolean;
};

const BarChart: React.FC<BarChartProps> = ({
  labels,
  values,
  utilization,
  title,
  className,
  height = 260,
  showValues = true,
  showUtilization = true,
}) => {
  const width = 600;
  const margin = { top: 28, right: 20, bottom: 38, left: 40 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;

  const step = iw / Math.max(1, labels.length);
  const barW = step * 0.56;

  // Función para obtener color según el porcentaje de utilización
  const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return "#9b1c1c"; // Rojo - sobreutilizado
    if (percent >= 70) return "#f59e0b"; // Amarillo - alta utilización
    return "#56963a"; // Verde - utilización normal
  };

  return (
    <div className={className}>
      {title && <div className="card-title">{title}</div>}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height }}
        role="img"
        aria-label={title}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* eje X */}
          <line x1="0" y1={ih} x2={iw} y2={ih} stroke="#6aa86b" strokeWidth="2" />
          {/* eje Y */}
          <line x1="0" y1="0" x2="0" y2={ih} stroke="#6aa86b" strokeWidth="2" />

          {/* grid horizontal */}
          {[0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = ih - p * (ih - 10);
            return (
              <line
                key={idx}
                x1="0"
                x2={iw}
                y1={y}
                y2={y}
                stroke="#cfe5cc"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* barras */}
          {labels.map((_, i) => {
            const util = utilization?.[i] ?? 0;
            const h = (util / 100) * (ih - 10); // altura proporcional al % de ocupación
            const x = i * step + (step - barW) / 2;
            const y = ih - h;
            const barColor = getUtilizationColor(util);

            return (
              <g key={i}>
                {/* Barra con color según utilización */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx="6"
                  fill={barColor}
                  opacity="0.9"
                />

                {/* etiqueta X (recurso) */}
                <text
                  x={x + barW / 2}
                  y={ih + 18}
                  fontSize="11"
                  textAnchor="middle"
                  fill="#2b5d15"
                  fontWeight="600"
                >
                  {labels[i]}
                </text>

                {/* Valor (cantidad de recursos) */}
                {showValues && (
                  <text
                    x={x + barW / 2}
                    y={y - 20}
                    fontSize="13"
                    textAnchor="middle"
                    fill="#264831"
                    fontWeight="700"
                  >
                    {Number.isFinite(values[i]) ? values[i] : "-"}
                  </text>
                )}

                {/* Porcentaje de utilización */}
                {showUtilization && (
                  <text
                    x={x + barW / 2}
                    y={y - 6}
                    fontSize="11"
                    textAnchor="middle"
                    fill={barColor}
                    fontWeight="600"
                  >
                    {util.toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default BarChart;