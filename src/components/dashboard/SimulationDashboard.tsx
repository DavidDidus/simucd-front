import BarChart from "../charts/BarChart";
import Timeline from "../Timeline";
import Tabs from "../layout/Tabs";
import type { TabId } from "../layout/Tabs";
import { getFormattedActiveTime } from "../../utils/dataUtils";
import WaitBarChart from "../charts/WaitTimeBarChart";
import { buildWaitTimeChartData } from "../../utils/time";

interface DashboardProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  chartData: {
    title: string;
    labels: string[];
    values: number[];
    utilization: number[];
  };
  waitChartData: any;
  kpis: {
    iceo: string | number;
    endTime: string;
  };
  timelineData: any[];
  timelineLabel: string;
  norm: any;
}

export function SimulationDashboard({
  activeTab,
  onTabChange,
  chartData,
  waitChartData,
  kpis,
  timelineData,
  timelineLabel,
  norm,
}: DashboardProps) {
  
  return (
    <div
      className="dash-card card-with-tabs"
      id={`panel-${activeTab}`}
      role="tabpanel"
      aria-labelledby={`tab-${activeTab}`}
    >
      <Tabs
        tabs={[
          { id: "noche", label: "Noche" },
          { id: "diaA", label: "Día — Turno A" },
          { id: "diaB", label: "Día — Turno B" },
        ]}
        active={activeTab}
        onChange={onTabChange}
        className="tabs-in-card"
      />

      <div className="dashboard-grid in-card">
        <BarChart
          title={chartData.title}
          labels={chartData.labels}
          values={chartData.values}
          utilization={chartData.utilization}
          className="subcard grid-chart"
        />

        {activeTab === "noche" && (
          <WaitBarChart
            data={waitChartData}
            title="Espera promedio por recurso"
            className="grid-wait-chart"
            unit="min"
          />
        )}

        <div className="subcard kpi-card grid-kpis">
          <div className="card-title">KPIs clave</div>
          <div className="kpi-grid">
            {activeTab === "noche" && (
            <>
              <div className="kpi">
                <div className="kpi-label">ICEO</div>
                <div className="kpi-value">{kpis.iceo}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Hora de término</div>
                <div className="kpi-value">{kpis.endTime}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Ocupacion Pick.</div>
                <div className="kpi-value">
                  {getFormattedActiveTime("pickers", activeTab, norm)}
                </div>
              </div>
            </>
            )}

            <div className="kpi">
              <div className="kpi-label">Ocupacion Cheq.</div>
              <div className="kpi-value">
                {getFormattedActiveTime("chequeadores", activeTab, norm)}
              </div>
            </div>
            
            <div className="kpi">
              <div className="kpi-label">Ocupacion Gru.</div>
              <div className="kpi-value">
                {getFormattedActiveTime("grueros", activeTab, norm)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Ocupacion Cons.</div>
              <div className="kpi-value">
                {getFormattedActiveTime("parrilleros", activeTab, norm)}
              </div>
            </div>
          </div>
        </div>
        
        {activeTab === "noche" &&
        <Timeline
          timePoints={timelineData}
          label={timelineLabel}
          className="subcard grid-timeline"
        />
        }
      </div>
    </div>
  );
}