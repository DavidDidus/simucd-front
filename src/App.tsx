import { useState, useEffect } from "react";
import type { Params } from "./types";
import ShiftInputTabs from "./components/ShiftInputTabs";
import type { ShiftId } from "./components/ShiftInputTabs";
import type { TabId } from "./components/layout/Tabs";
import { BigCard } from "./components/layout/BigCard";
import { StaffCards } from "./components/StaffCards";
import { SimulationDashboard } from "./components/dashboard/SimulationDashboard";
import  SubestandarDashboard  from "./components/dashboard/SubestandarDashboard";
import { useSimulation } from "./hooks/useSimulation";
import { useCardAnimation } from "./hooks/useCardAnimation";
import { useShiftParams } from "./hooks/useShiftParams";
import { buildUtilization, buildTimeline, getStaffValues } from "./utils/dataUtils";
import Simulation2D from "./components/simulation/Simulation2D";
import ProgressBar from "./components/charts/ProgressBar";
import SimulationHistory from "./components/simulation/SimulationHistory";
import ReempaqueDashboard from "./components/dashboard/ReempaqueDashboard";
import html2canvas from 'html2canvas';
import { InfoModal } from "./components/InfoModal";

const LS_KEY = "simucd-params";
const HISTORY_KEY = "simucd-history";

const initial: Params = {
  pickers: 8,
  grueros: 4,
  consolidadores: 2,
  chequeadores: 2,
  cajasFacturadas: 0,
  cajasPiqueadas: 0,
  camiones: 20,
  personal_subestandar: 1,
  entrada_subestandar: 1,
  personal_clasificacion: 1,
  entrada_clasificacion: 1,
  entrada_estandarizacion: 1,
  personal_reempaque: 1,
  entrada_reempaque: 1,
  entrada_sin_recurso: 1,
  prv_danado: 1,
  saca_carton: 1,
  saca_film: 1,
  saca_pet: 1,
  retorno_pallets: false,
  
};

export default function App() {
  const [params, setParams] = useState<Params>(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? { ...initial, ...JSON.parse(saved) } : initial;
  });

  const [shiftInput, setShiftInput] = useState<ShiftId>("noche");
  const [activeTab, setActiveTab] = useState<TabId>("noche");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSim2D, setShowSim2D] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showInfo, setShowInfo] = useState(false);


  const { night, dayA, dayB, subestandar, reempaque,clasificacion ,getCurrentParams, updateShiftParam } = useShiftParams(params);
  const { editing, bigCardRef, openEditor, collapseEditor } = useCardAnimation();

  const {
    baseResult,
    normalized,
    error,
    loadingBase,
    loadingMC,
    showDashboard,
    runSimulation,
    isMonteCarlo,
    selectedScenario,
    setSelectedScenario,
    scenariosInfo,
    subestandarResult,
    showDashboardSubestandar,
    runSubestandarSimulation,
    clasificacionResult,
    showDashboardClasificacion,
    showDashboardReempaque,
    runReempaqueSimulation,
    reempaqueResult,
  } = useSimulation();

  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string>("");

  const currentParams = getCurrentParams(shiftInput);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(params));
  }, [params]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) {
        collapseEditor(true, setParams);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing]);

    useEffect(() => {
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    const TOTAL_MC_SECONDS = 360;  // 6 minutos
    const BASE_SECONDS = 5;        // simulación rápida
    const MC_START = 5;            // porcentaje exacto donde empieza MonteCarlo
    const MC_END = 100;

    const loading = loadingBase || loadingMC;

    if (loading) {
      if (!showProgress) {
        setShowProgress(true);
        setProgress(0);
        setProgressLabel("Preparando simulación...");
      }

      const startTime = Date.now();

      intervalId = window.setInterval(() => {
        const now = Date.now();
        const elapsed = (now - startTime) / 1000;

        setProgress((prev) => {
          // FASE 1 — Simulación rápida
          if (loadingBase) {
            const percent = Math.min( (elapsed / BASE_SECONDS) * MC_START , MC_START );
            setProgressLabel("Preparando simulación...");
            return percent;
          }

          // FASE 2 — Monte Carlo
          if (loadingMC) {
            const mcElapsed = elapsed; // elapsed solo desde que loadingMC=true
            const percent =
              MC_START + (mcElapsed / TOTAL_MC_SECONDS) * (MC_END - MC_START);

            setProgressLabel("Calculando escenarios (Monte Carlo)…");

            return Math.min(percent, MC_END - 1);
          }

          return prev;
        });
      }, 1000);
    } 
    else {
      // TERMINÓ TODO
      if (showProgress) {
        setProgress(100);
        setProgressLabel("Listo");
        timeoutId = window.setTimeout(() => {
          setShowProgress(false);
          setProgress(0);
          setProgressLabel("");
        }, 800);
      }
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loadingBase, loadingMC]);

  useEffect(() => {
  if (error) {
    console.error('[SIMUCD Error]', error);
    // Opcional: enviar a analytics/logging
  }
}, [error]);

 function appendHistoryRecord(
  kind: 'turnos' | 'reempaque' | 'subestandar',
  opts?: { includeClasificacion?: boolean }
) {
  try {
    const now = new Date();
    const base = {
      id: crypto.randomUUID?.() ?? `${now.getTime()}`,
      timestamp: now.toISOString(),
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      cajasFacturadas: params.cajasFacturadas,
      cajasPiqueadas: params.cajasPiqueadas,
    };

    let record: any = { ...base };

    if (kind === 'turnos') {
      record = {
        ...base,
        night,
        dayA,
        dayB,
      };

      if (opts?.includeClasificacion) {
        record.clasificacion = {
          personal_clasificacion: params.personal_clasificacion,
          entrada_clasificacion: params.entrada_clasificacion,
          entrada_estandarizacion: params.entrada_estandarizacion,
        };
      }
    } else if (kind === 'reempaque') {
      record = {
        ...base,
        reempaque: {
          personal_reempaque: params.personal_reempaque,
          entrada_reempaque: params.entrada_reempaque,
          entrada_sin_recurso: params.entrada_sin_recurso,
        },
      };
    } else if (kind === 'subestandar') {
      record = {
        ...base,
        subestandar: {
          personal_subestandar: params.personal_subestandar,
          entrada_subestandar: params.entrada_subestandar,
          prv_danado: params.prv_danado,
          saca_carton: params.saca_carton,
          saca_film: params.saca_film,
          saca_pet: params.saca_pet,
        },
      };
    }

    const raw = localStorage.getItem(HISTORY_KEY);
    const prev = raw ? JSON.parse(raw) : [];
    const next = [record, ...prev];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("No se pudo guardar historial:", e);
  }
}
  function set<K extends keyof Params>(key: K, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  const recDia = normalized.dia?.metricas_turnos ?? null;
  const recNoche = normalized.noche?.ocupacion_recursos ?? null;

  const chartData = {
    title:
      activeTab === "noche"
        ? "Ocupación (Noche)"
        : activeTab === "diaA"
        ? "Ocupación (Día - Turno A)"
        : "Ocupación (Día - Turno B)",
    labels:
      activeTab === "noche"
        ? ["Pickers", "Grueros", "Consol.", "Chequeadores"]
        : ["Grueros", "Consol.", "Chequeadores"],
    values: getStaffValues(activeTab, night, dayA, dayB),
    utilization: buildUtilization(activeTab, recDia, recNoche),
  };

  const waitChartData = normalized.noche?.tiempos_espera_promedio

  const kpis = {
    iceo:
      (activeTab === "noche"
        ? normalized.noche?.ice_mixto?.valor
        : normalized.dia?.ice_mixto?.valor
      )?.toLocaleString?.() ?? "N/A",
    endTime:
      activeTab === "noche"
        ? normalized.noche?.turno_fin_real ?? "Noche N/D"
        : normalized.dia?.turno_fin_real ?? "Día N/D",
  };

  const timelineData = buildTimeline(activeTab, normalized);
  const timelineLabel =
    activeTab === "noche"
      ? "Proyección (Noche)"
      : activeTab === "diaA"
      ? "Proyección (Turno A)"
      : "Proyección (Turno B)";

  function validateResources(): string | null {
    // Validar cajas
    if(activeTab === "noche" || activeTab === "diaA" || activeTab === "diaB") {
      if (params.cajasFacturadas < params.cajasPiqueadas) {
        return "Las cajas pickeadas no pueden ser mayores que las facturadas";
      }
      if (params.cajasFacturadas === 0) {
        return "Las cajas facturadas no pueden ser 0";
      }
      if (params.cajasPiqueadas === 0) {
        return "Las cajas pickeadas no pueden ser 0";
      }
      if (params.cajasPiqueadas > params.cajasFacturadas) {
        return "Las cajas pickeadas no pueden ser mayores que las facturadas";
      }

      // Validar recursos noche
      if (night.pickers === 0) return "Los Pickers (noche) no pueden ser 0";
      if (night.grueros === 0) return "Los Grueros (noche) no pueden ser 0";
      if (night.chequeadores === 0) return "Los Chequeadores (noche) no pueden ser 0";
      if (night.consolidadores === 0) return "Los Consolidadores (noche) no pueden ser 0";
      if (night.camiones === 0) return "Los Camiones (noche) no pueden ser 0";

      // Validar recursos día A
      if (dayA.pickers === 0) return "Los Pickers (Turno A) no pueden ser 0";
      if (dayA.grueros === 0) return "Los Grueros (Turno A) no pueden ser 0";
      if (dayA.chequeadores === 0) return "Los Chequeadores (Turno A) no pueden ser 0";
      if (dayA.consolidadores === 0) return "Los Consolidadores (Turno A) no pueden ser 0";

      // Validar recursos día B
      if (dayB.pickers === 0) return "Los Pickers (Turno B) no pueden ser 0";
      if (dayB.grueros === 0) return "Los Grueros (Turno B) no pueden ser 0";
      if (dayB.chequeadores === 0) return "Los Chequeadores (Turno B) no pueden ser 0";
      if (dayB.consolidadores === 0) return "Los Consolidadores (Turno B) no pueden ser 0";
    }

    return null;
  }
    const scenarioOrder = ["optimista", "realista", "pesimista"] as const;
  const scenarioLabel: Record<(typeof scenarioOrder)[number], string> = {
    optimista: "optimista",
    realista: "realista",
    pesimista: "pesimista",
  };

  function goToPrevScenario() {
    if (!isMonteCarlo) return;
    const idx = scenarioOrder.indexOf(selectedScenario as any);
    const prev =
      scenarioOrder[(idx - 1 + scenarioOrder.length) % scenarioOrder.length];
    setSelectedScenario(prev as any);
  }

  function goToNextScenario() {
    if (!isMonteCarlo) return;
    const idx = scenarioOrder.indexOf(selectedScenario as any);
    const next = scenarioOrder[(idx + 1) % scenarioOrder.length];
    setSelectedScenario(next as any);
  }


function handleRunSimulation() {
  if (pressed) // ← faltaba "return" o ";" aquí
  if (loadingBase || loadingMC) return;

  const validationMessage = validateResources();
  if (validationMessage) {
    setValidationError(validationMessage);
    return;
  }

  setValidationError(null);

  const is2DShift =
    shiftInput === "noche" ||
    shiftInput === "diaA" ||
    shiftInput === "diaB" ||
    shiftInput === "Clasificación";

  if (is2DShift) {
    // Decidir si clasificación se incluirá en historial
    const includeClasificacion =
      (clasificacion.personal_clasificacion ?? 0) > 0 ||
      (clasificacion.entrada_clasificacion ?? 0) > 0 ||
      (clasificacion.entrada_estandarizacion ?? 0) > 0;

    appendHistoryRecord('turnos', { includeClasificacion });

    // Siempre mostrar la simulación 2D al correr
    if (!showSim2D) setShowSim2D(true);
    setPressed(true);
    runSimulation(params, night, dayA, dayB, clasificacion);
    return;
  }

  // Otros módulos: no muestran la 2D
  setShowSim2D(false);
  setPressed(false);

  if (shiftInput === "Subestándar") {
    appendHistoryRecord('subestandar');
    runSubestandarSimulation(subestandar);
    return;
  }

  if (shiftInput === "Reempaque") {
    appendHistoryRecord('reempaque');
    runReempaqueSimulation(reempaque);
  }
}


async function downloadDashboardAsImage(elementId: string, filename: string) {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn('Elemento no encontrado');
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  } catch (err) {
    console.error('Error descargando dashboard:', err);
  }
}
  return (
    <div className="page">
      <div className="topbar">
        <div className="brand-container">
          <header className="brand">SIMUCD</header>
          <button
            className="info-btn"
            onClick={() => setShowInfo(s => !s)}
            title="Información sobre SIMUCD"
            aria-label="Información"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="11" x2="12" y2="16" />
              <circle cx="12" cy="8" r="1.5" />
            </svg>
          </button>
        </div>
      <button
        className="history-btn"
        onClick={() => setShowHistory(s => !s)}
        aria-label={showHistory ? "Volver a simulación" : "Abrir historial"}
      >
      {showHistory ? "Volver" : "Historial"}
      </button>
    </div>
    {showInfo && (
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    )}

          {showHistory ? (
      <SimulationHistory />
    ) : (
      <>
      <ShiftInputTabs value={shiftInput} onChange={setShiftInput} />

      <main className={`grid ${editing ? "editing" : ""}`}>
        {shiftInput === "noche" && (
          <BigCard
            bigCardRef={bigCardRef}
            editing={editing}
            params={params}
            onOpen={() => openEditor(params)}
            onSet={set}
            onAccept={() => collapseEditor(false, setParams)}
            onCancel={() => collapseEditor(true, setParams)}
          />
        )}

        <StaffCards
          shiftInput={shiftInput}
          editing={editing}
          currentParams={currentParams}
          onUpdate={(key, val) => updateShiftParam(shiftInput, key as any, val)}
        />
      </main>

      <section className={`panel ${editing ? "hide-on-expand" : ""}`}>
  <div className="buttons-container">
    <button
      className="run-btn"
      onClick={handleRunSimulation}
      disabled={loadingBase || loadingMC}
    >
      {loadingBase
        ? "Ejecutando simulación..."
        : loadingMC
        ? "Calculando escenarios..."
        : "Ejecutar simulación"}
    </button>
    
    <button 
      onClick={() => downloadDashboardAsImage('dashboard-container', 'resultado-simulacion')}
      className="download-btn"
      title="Descargar Dashboard"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    </button>
  </div>
  
  {showProgress && (
    <ProgressBar value={progress} label={progressLabel} />
  )}

  {validationError && <p className="error">{validationError}</p>}
  {error && (
  <p className="error">
    Ocurrió un problema al ejecutar la simulación. Por favor, intenta nuevamente.
  </p>
)}

  {showSim2D && (
    <div style={{ marginTop: 12 }}>
      <Simulation2D
        running
        resources={{ 
          noche: night.grueros,
          turnoA: dayA.grueros,
          turnoB: dayB.grueros,
        }}
        // simulación rápida (1 corrida)
        backendResponse={baseResult}
      />
    </div>
  )}
  <div id="dashboard-container">
    {/* resto del contenido */}
        <div id="dashboard-container">

        {/* Carrusel de escenario Monte Carlo */}
        {isMonteCarlo && scenariosInfo && (
        <div className="scenario-carousel">
          <button
            type="button"
            className="scenario-carousel-arrow left"
            onClick={goToPrevScenario}
            disabled={loadingMC}
          >
            ‹
          </button>

          <div className="scenario-carousel-center">
            <div className="scenario-carousel-title">
              {scenarioLabel[selectedScenario as "optimista" | "realista" | "pesimista"].charAt(0).toUpperCase() + scenarioLabel[selectedScenario as "optimista" | "realista" | "pesimista"].slice(1)}
            </div>
            <div className="scenario-carousel-subtitle">
              {(() => {
                const info = scenariosInfo[selectedScenario];
                const noche = info?.endTimeNoche ?? "N/D";
                const dia = info?.endTimeDia ?? null;
                return dia
                  ? `Noche: ${noche} `
                  : `Noche: ${noche}`;
              })()}
            </div>
          </div>

          <button
            type="button"
            className="scenario-carousel-arrow right"
            onClick={goToNextScenario}
            disabled={loadingMC}
          >
            ›
          </button>
        </div>
      )}

        {showDashboard && showDashboardClasificacion ? (
          <SimulationDashboard
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chartData={chartData}
            waitChartData={waitChartData}   
            kpis={kpis}
            timelineData={timelineData}
            timelineLabel={timelineLabel}
            norm={normalized}
            clasificacionResult={clasificacionResult}
          />
        ) : showDashboard && (
          <SimulationDashboard
            activeTab={activeTab}
            onTabChange={setActiveTab}
            chartData={chartData}
            waitChartData={waitChartData}
            kpis={kpis}
            timelineData={timelineData}
            timelineLabel={timelineLabel}
            norm={normalized}
            clasificacionResult={null}
          />
        )}

        {showDashboardSubestandar && subestandarResult && (
          <div className="subestandar-dashboard">
              <SubestandarDashboard
                result={subestandarResult}
              />
          </div>
        )}

        {showDashboardReempaque && reempaqueResult && (
          <div className="subestandar-dashboard">
              <ReempaqueDashboard
                result={reempaqueResult}
              />
          </div>
        )}
        </div>
        </div>
      </section>
  </>
)}
    </div>
  );
}
