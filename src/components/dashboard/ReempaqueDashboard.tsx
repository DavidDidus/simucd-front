import BarChart from "../charts/BarChart";

type ReempaqueResult = {
  resumen: {
    hora_termino: string;
    dia_siguiente: boolean;
    minutos_totales: number;
    estado_turno: string; // e.g. "HORAS EXTRA"
    horas_extra_minutos: number;
    cajas_procesadas: number;
    total_objetivo: number;
  };
  salidas: {
    total_picking: number;
    almacenar_stgo: number;
    maquila_simple: number;
    maquila_doble: number;
    merma: number;
    pendientes_maquila: number;
  };
  estadisticas_tarea: Record<
    string,
    {
      tareas_completadas: number;
      tiempo_promedio_proceso: number;
      tiempo_promedio_espera: number;
      tiempo_total_proceso: number;
      tiempo_total_espera: number;
    }
  >;
  uso_operarios: Array<{
    operario_id: number;
    puede_maquilar: boolean;
    tareas_realizadas: number;
    tiempo_trabajado: number; // (min) según tus datos
    distribucion_tareas: Record<string, number>;
  }>;
  estado_colas: Record<
    string,
    { entradas: number; salidas: number; pendientes: number }
  >;
};

function mins(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n)} min`;
}
function hrsFromMin(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return `${h}h ${m}m`;
}
function pct(n?: number) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}
function safeNumber(n?: number) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export default function ReempaqueDashboard({ result }: { result: ReempaqueResult }) {
  const r = result;

  if (!r) {
    return (
      <div className="dash-card">
        <div className="subcard">
          <div className="card-title">Reempaque</div>
          <div style={{ color: "#64748b" }}>No hay datos para mostrar.</div>
        </div>
      </div>
    );
  }

  const avancePct =
    r.resumen.total_objetivo > 0
      ? (r.resumen.cajas_procesadas / r.resumen.total_objetivo) * 100
      : 0;

  // ---- Charts data ----

  const salidasChart = {
    title: "Salidas — Reempaque",
    labels: [
      "Picking",
      "Almacenar STGO",
      "Maquila simple",
      "Maquila doble",
      "Merma",
      "Pend. maquila",
    ],
    values: [
      safeNumber(r.salidas.total_picking),
      safeNumber(r.salidas.almacenar_stgo),
      safeNumber(r.salidas.maquila_simple),
      safeNumber(r.salidas.maquila_doble),
      safeNumber(r.salidas.merma),
      safeNumber(r.salidas.pendientes_maquila),
    ],
    utilization: [
      avancePct,
      avancePct,
      avancePct,
      avancePct,
      avancePct,
      avancePct,
    ],
  };

  const cajasChart = {
    title: "Cajas — Procesadas vs Objetivo",
    labels: ["Procesadas", "Objetivo"],
    values: [safeNumber(r.resumen.cajas_procesadas), safeNumber(r.resumen.total_objetivo)],
    utilization: [avancePct, 100],
  };

  const colasKeys = Object.keys(r.estado_colas ?? {});
  const pendientesChart = {
    title: "Pendientes por cola",
    labels: colasKeys.length ? colasKeys : ["—"],
    values: colasKeys.length ? colasKeys.map((k) => safeNumber(r.estado_colas[k]?.pendientes)) : [0],
    utilization: colasKeys.length ? colasKeys.map(() => avancePct) : [0],
  };

  return (
    <div className="dash-card card-with-tabs">
      <div className="dashboard-grid in-card reempaque-grid">
        {/* KPIs */}
        <div className="subcard kpi-card grid-kpis">
          <div className="card-title">KPIs clave — Reempaque</div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-label">Estado turno</div>
              <div className="kpi-value">{r.resumen.estado_turno ?? "—"}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Hora término</div>
              <div className="kpi-value">
                {r.resumen.hora_termino ?? "—"}
                {r.resumen.dia_siguiente ? " (+1)" : ""}
              </div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Minutos totales</div>
              <div className="kpi-value">{mins(r.resumen.minutos_totales)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Horas extra</div>
              <div className="kpi-value">{hrsFromMin(r.resumen.horas_extra_minutos)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Cajas procesadas</div>
              <div className="kpi-value">{r.resumen.cajas_procesadas}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Objetivo</div>
              <div className="kpi-value">{r.resumen.total_objetivo}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Avance</div>
              <div className="kpi-value">{pct(avancePct)}</div>
            </div>

            <div className="kpi">
              <div className="kpi-label">Pendientes maquila</div>
              <div className="kpi-value">{r.salidas.pendientes_maquila}</div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <BarChart
          title={cajasChart.title}
          labels={cajasChart.labels}
          values={cajasChart.values}
          utilization={cajasChart.utilization}
          showColors={false}
          className="subcard grid-chart-a"
        />

        <BarChart
          title={salidasChart.title}
          labels={salidasChart.labels}
          values={salidasChart.values}
          utilization={salidasChart.utilization}
          showColors={false}
          className="subcard grid-chart-b"
        />

        <BarChart
          title={pendientesChart.title}
          labels={pendientesChart.labels}
          values={pendientesChart.values}
          utilization={pendientesChart.utilization}
          showColors={false}
          className="subcard grid-chart-c"
        />

        {/* Tabla Operarios */}
        <div className="subcard grid-ops">
          <div className="card-title">Operarios</div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th>Puede maquilar</th>
                  <th>Tareas</th>
                  <th>Tiempo trabajado</th>
                </tr>
              </thead>
              <tbody>
                {r.uso_operarios.map((o) => (
                  <tr key={o.operario_id}>
                    <td className="mono">Op {o.operario_id}</td>
                    <td>{o.puede_maquilar ? "Sí" : "No"}</td>
                    <td className="mono">{o.tareas_realizadas}</td>
                    <td>{mins(o.tiempo_trabajado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Distribución por operario */}
        <div className="subcard grid-dist">
          <div className="card-title">Distribución de tareas</div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Operario</th>
                  <th>Estand.</th>
                  <th>Pistoleo</th>
                  <th>Limpieza</th>
                  <th>Completar</th>
                  <th>Maquila</th>
                </tr>
              </thead>
              <tbody>
                {r.uso_operarios.map((o) => (
                  <tr key={o.operario_id}>
                    <td className="mono">Op {o.operario_id}</td>
                    <td className="mono">{o.distribucion_tareas?.Estandarizacion ?? 0}</td>
                    <td className="mono">{o.distribucion_tareas?.Pistoleo ?? 0}</td>
                    <td className="mono">{o.distribucion_tareas?.Limpieza ?? 0}</td>
                    <td className="mono">{o.distribucion_tareas?.Completar ?? 0}</td>
                    <td className="mono">{o.distribucion_tareas?.Maquila ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estado colas detalle */}
        <div className="subcard grid-colas">
          <div className="card-title">Estado de colas</div>
          {colasKeys.length === 0 ? (
            <div style={{ color: "#64748b" }}>—</div>
          ) : (
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Cola</th>
                    <th>Entradas</th>
                    <th>Salidas</th>
                    <th>Pendientes</th>
                  </tr>
                </thead>
                <tbody>
                  {colasKeys.map((k) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="mono">{r.estado_colas[k]?.entradas ?? 0}</td>
                      <td className="mono">{r.estado_colas[k]?.salidas ?? 0}</td>
                      <td className="mono">{r.estado_colas[k]?.pendientes ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
