import BarChart from "../charts/BarChart";

type ClasificacionResult = {

    resumen: {
      tiempo_simulado_min: number;
      hora_finalizacion: string;
      hora_finalizacion_real?: string;
      termino_antes_del_turno: boolean;
      pallets_iniciales: { CL: number; EST: number; total: number };
      pallets_procesados: { CL: number; EST: number; total: number };
      pallets_pendientes: number;
      eventos: Record<string, number>;
    };
    utilizacion_operarios: Array<{
      operario_id: number;
      tiempo_trabajo_min: number;
      tiempo_espera_min: number;
      pallets_procesados: number;
      utilizacion_pct: number;
    }>;
    analisis: {
      tiempo_promedio_pallet_min: number;
      tiempo_promedio_cl_min: number;
      tiempo_promedio_est_min: number;
      espera_promedio_cl_min: number;
      espera_promedio_est_min: number;
      horas_extra_necesarias: number;
      hora_finalizacion_estimada: string | null;
      eficiencia_procesamiento_pct: number;
    };
  
};

function mins(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} min`;
}
function pct(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default function ClasificacionDashboard({ result }: { result: ClasificacionResult }) {
  const r = result;
  if (!r) {
    return (
      <div className="dash-card">
        <div className="subcard">
          <div className="card-title">Clasificación</div>
          <div style={{ color: "#64748b" }}>No hay datos para mostrar.</div>
        </div>
      </div>
    );
  }

  const utilAvg = avg(r.utilizacion_operarios.map((x) => x.utilizacion_pct));

  const palletsChart = {
    title: "Pallets (Iniciales vs Procesados)",
    labels: ["CL inicial", "CL procesado", "EST inicial", "EST procesado"],
    values: [
      r.resumen.pallets_iniciales.CL,
      r.resumen.pallets_procesados.CL,
      r.resumen.pallets_iniciales.EST,
      r.resumen.pallets_procesados.EST,
    ],
    utilization: [
      r.resumen.pallets_iniciales.CL ? (r.resumen.pallets_procesados.CL / r.resumen.pallets_iniciales.CL) * 100 : 0,
      r.resumen.pallets_iniciales.CL ? (r.resumen.pallets_procesados.CL / r.resumen.pallets_iniciales.CL) * 100 : 0,
      r.resumen.pallets_iniciales.EST ? (r.resumen.pallets_procesados.EST / r.resumen.pallets_iniciales.EST) * 100 : 0,
      r.resumen.pallets_iniciales.EST ? (r.resumen.pallets_procesados.EST / r.resumen.pallets_iniciales.EST) * 100 : 0,
    ],
  };

  const utilChart = {
    title: "Utilización por operario",
    labels: r.utilizacion_operarios.map((o) => `Op ${o.operario_id}`),
    values: r.utilizacion_operarios.map((o) => o.utilizacion_pct),
    utilization: r.utilizacion_operarios.map((o) => o.utilizacion_pct),
  };
  return (
    <div className="dash-card card-with-tabs">
      <div className="dashboard-grid in-card clasif-grid">
        {/* KPIs */}
        <div className="subcard kpi-card grid-kpis">
          <div className="card-title">KPIs clave — Clasificación</div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-label">Hora finalización</div>
              <div className="kpi-value">{r.resumen.hora_finalizacion_real ?? r.resumen.hora_finalizacion ?? "—"}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Tiempo simulado</div>
              <div className="kpi-value">{mins(r.resumen.tiempo_simulado_min)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Pallets procesados</div>
              <div className="kpi-value">{r.resumen.pallets_procesados.total}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Pendientes</div>
              <div className="kpi-value">{r.resumen.pallets_pendientes}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Eficiencia</div>
              <div className="kpi-value">{pct(r.analisis.eficiencia_procesamiento_pct)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Utilización prom.</div>
              <div className="kpi-value">{pct(utilAvg)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Término antes del turno</div>
              <div className="kpi-value">{r.resumen.termino_antes_del_turno ? "Sí" : "No"}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Horas extra necesarias</div>
              <div className="kpi-value">{r.analisis.horas_extra_necesarias}</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <BarChart
          title={palletsChart.title}
          labels={palletsChart.labels}
          values={palletsChart.values}
          utilization={palletsChart.utilization}
          showColors={false}
          className="subcard grid-chart"
        />

        <BarChart
          title={utilChart.title}
          labels={utilChart.labels}
          values={utilChart.values}
          utilization={utilChart.utilization}
          showColors={false}
          className="subcard grid-util"
        />

        {/* Análisis */}
        <div className="subcard grid-analysis">
          <div className="card-title">Análisis</div>
          <div className="mini-grid">
            <div className="mini">
              <div className="mini-label">Prom. min/pallet</div>
              <div className="mini-value">{mins(r.analisis.tiempo_promedio_pallet_min)}</div>
            </div>
            <div className="mini">
              <div className="mini-label">Prom. CL</div>
              <div className="mini-value">{mins(r.analisis.tiempo_promedio_cl_min)}</div>
            </div>
            <div className="mini">
              <div className="mini-label">Prom. EST</div>
              <div className="mini-value">{mins(r.analisis.tiempo_promedio_est_min)}</div>
            </div>
            <div className="mini">
              <div className="mini-label">Fin estimado</div>
              <div className="mini-value">{r.analisis.hora_finalizacion_estimada ?? "—"}</div>
            </div>
          </div>
        </div>

        {/* Eventos */}
        <div className="subcard grid-events">
          <div className="card-title">Eventos</div>
          {Object.keys(r.resumen.eventos ?? {}).length === 0 ? (
            <div style={{ color: "#64748b" }}>—</div>
          ) : (
            <div className="events-list">
              {Object.entries(r.resumen.eventos).map(([k, v]) => (
                <div key={k} className="event-row">
                  <span className="event-k">{k.replaceAll("_", " ")}</span>
                  <span className="event-v">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabla Operarios */}
        <div className="subcard grid-ops">
          <div className="card-title">Operarios</div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th>Utilización</th>
                  <th>Trabajo</th>
                  <th>Espera</th>
                  <th>Pallets</th>
                </tr>
              </thead>
              <tbody>
                {r.utilizacion_operarios.map((o) => (
                  <tr key={o.operario_id}>
                    <td className="mono">Op {o.operario_id}</td>
                    <td>{pct(o.utilizacion_pct)}</td>
                    <td>{mins(o.tiempo_trabajo_min)}</td>
                    <td>{mins(o.tiempo_espera_min)}</td>
                    <td className="mono">{o.pallets_procesados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
