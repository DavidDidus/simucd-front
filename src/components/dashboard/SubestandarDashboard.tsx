import BarChart from "../charts/BarChart";

type SubestandarApi = {
  
   
    data: {
      tiempos: {
        turno_fin_real: string;
        duracion_total_min: number;
        duracion_area_min: number;
        overrun_min: number;
      };
      ocupacion_recursos: {
        operarios_porcentaje: number;
        enfardadora_porcentaje: number;
      };
      segregacion_liquidos: {
        objetivo: number;
        completadas: number;
        pendientes: number;
        tasa_completitud: number;
      };
      enfardado: {
        fardos_completados: number;
        fardos_objetivo: number;
        tasa_completitud: number;
        por_material: Record<string, number>;
        unidades_procesadas: Record<string, number>;
      };
      materiales_pendientes: Record<
        string,
        {
          faltantes: number;
          nombre_unidad: string;
          progreso_total: number;
          unidades_por_fardo: number;
        }
      >;
      enfardadora_estado: {
        vacia: boolean;
        material_en_proceso: string | null;
        progreso_porcentaje: number;
        unidades_cargadas: number;
        unidades_faltantes: number;
      };
      metricas_fardos: {
        tiempo_promedio_fardo_min: number;
        tiempo_minimo_fardo_min: number;
        tiempo_maximo_fardo_min: number;
        fardos_incompletos: number;
      };
    };
  
};

function pct(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function mins(n: number) {
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)} min`;
}

function MaterialProgress({
  label,
  current,
  total,
  unit,
}: {
  label: string;
  current: number;
  total: number;
  unit: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const p = Math.max(0, Math.min(100, (current / safeTotal) * 100));

  return (
    <div className="mat-row">
      <div className="mat-left">
        <div className="mat-label">{label}</div>
        <div className="mat-meta">
          {current}/{total} {unit}
        </div>
      </div>

      <div className="mat-bar" aria-label={`${label} progreso`}>
        <div className="mat-fill" style={{ width: `${p}%` }} />
      </div>

      <div className="mat-right">
        <span className="mat-missing">Faltan {Math.max(0, total - current)}</span>
      </div>
    </div>
  );
}

export default function SubestandarDashboard({
  result,
}: {
  result: SubestandarApi;
}) {
  const payload = result?.data;
  if (!payload) {
    return (
      <div className="dash-card">
        <div className="subcard">
          <div className="card-title">Subestándar</div>
          <div style={{ color: "#64748b" }}>No hay datos para mostrar.</div>
        </div>
      </div>
    );
  }

  // Chart 1: Producción (liquidos + enfardos)
  const prodChart = {
    title: "Producción",
    labels: ["Segregación líquidos", "Enfardos"],
    values: [payload.segregacion_liquidos.completadas, payload.enfardado.fardos_completados],
    utilization: [payload.segregacion_liquidos.tasa_completitud, payload.enfardado.tasa_completitud],
  };

  // Chart 2: Utilización recursos
  const utilChart = {
    title: "Utilización de recursos",
    labels: ["Operarios", "Enfardadora"],
    values: [payload.ocupacion_recursos.operarios_porcentaje, payload.ocupacion_recursos.enfardadora_porcentaje],
    utilization: [payload.ocupacion_recursos.operarios_porcentaje, payload.ocupacion_recursos.enfardadora_porcentaje],
  };

  // Materiales pendientes: progreso_total vs unidades_por_fardo
  const mats = Object.entries(payload.materiales_pendientes ?? {}).map(([name, m]) => ({
    name,
    unit: m.nombre_unidad,
    total: m.unidades_por_fardo,
    current: Math.max(0, Math.min(m.progreso_total ?? 0, m.unidades_por_fardo)),
    faltantes: m.faltantes,
  }));

  return (
    <div className="dash-card card-with-tabs">
      <div className="dashboard-grid in-card subestandar-grid">
        {/* KPI card */}
        <div className="subcard kpi-card grid-kpis">
          <div className="card-title">KPIs clave — Subestándar</div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-label">Fin real</div>
              <div className="kpi-value">{payload.tiempos.turno_fin_real ?? "—"}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Duración área</div>
              <div className="kpi-value">{mins(payload.tiempos.duracion_area_min)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Overrun</div>
              <div className="kpi-value">{mins(payload.tiempos.overrun_min)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Segregación</div>
              <div className="kpi-value">
                {payload.segregacion_liquidos.completadas}/{payload.segregacion_liquidos.objetivo} ({pct(payload.segregacion_liquidos.tasa_completitud)})
              </div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Enfardado</div>
              <div className="kpi-value">
                {payload.enfardado.fardos_completados}/{payload.enfardado.fardos_objetivo} ({pct(payload.enfardado.tasa_completitud)})
              </div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Ocupación promedio</div>
              <div className="kpi-value">
                {pct((payload.ocupacion_recursos.operarios_porcentaje + payload.ocupacion_recursos.enfardadora_porcentaje) / 2)}
              </div>
            </div>
          </div>
        </div>

        {/* Producción */}
        <BarChart
          title={prodChart.title}
          labels={prodChart.labels}
          values={prodChart.values}
          utilization={prodChart.utilization}
          showColors={false}
          className="subcard grid-chart"
        />

        {/* Utilización */}
        <BarChart
          title={utilChart.title}
          labels={utilChart.labels}
          values={utilChart.values}
          utilization={utilChart.utilization}
          showColors={false}
          className="subcard grid-wait-chart"
        />

        {/* Estado enfardadora */}
        <div className="subcard grid-status">
          <div className="card-title">Enfardadora al cierre</div>

          <div className="status-row">
            <span className={`badge ${payload.enfardadora_estado.vacia ? "badge-ok" : "badge-warn"}`}>
              {payload.enfardadora_estado.vacia ? "Vacía ✓" : "En proceso"}
            </span>
          </div>

          {!payload.enfardadora_estado.vacia && (
            <div className="status-details">
              <div><b>Material:</b> {payload.enfardadora_estado.material_en_proceso ?? "—"}</div>
              <div><b>Progreso:</b> {pct(payload.enfardadora_estado.progreso_porcentaje)}</div>
              <div>
                <b>Cargadas:</b> {payload.enfardadora_estado.unidades_cargadas} | <b>Faltan:</b>{" "}
                {payload.enfardadora_estado.unidades_faltantes}
              </div>
            </div>
          )}

          <div className="status-metrics">
            <div className="mini">
              <div className="mini-label">Prom. min/fardo</div>
              <div className="mini-value">{mins(payload.metricas_fardos.tiempo_promedio_fardo_min)}</div>
            </div>
            <div className="mini">
              <div className="mini-label">Incompletos</div>
              <div className="mini-value">{payload.metricas_fardos.fardos_incompletos}</div>
            </div>
          </div>
        </div>

        {/* Materiales pendientes */}
        <div className="subcard grid-materials">
          <div className="card-title">Materiales pendientes para próximo fardo</div>
          <div className="mat-list">
            {mats.length === 0 ? (
              <div style={{ color: "#64748b" }}>—</div>
            ) : (
              mats.map((m) => (
                <MaterialProgress
                  key={m.name}
                  label={m.name}
                  current={m.current}
                  total={m.total}
                  unit={m.unit}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
