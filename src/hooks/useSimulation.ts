import { useState, useMemo } from "react";
import axios from "axios";

type ScenarioKey = "optimista" | "realista" | "pesimista";

type MonteCarloScenario = {
  turno_fin_real?: string;
  resultado?: {
    turno_noche?: any;
    turno_dia?: any;
    [k: string]: any;
  };
  [k: string]: any;
};

type MonteCarloResult = {
  n_iter?: number;
  metric?: string;
  optimista?: MonteCarloScenario;
  realista?: MonteCarloScenario;
  pesimista?: MonteCarloScenario;
};

export function useSimulation() {
  const [baseResult, setBaseResult] = useState<any>(null);                 // simulación rápida (1 corrida)
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null); // resultado Monte Carlo
  const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("realista");

  const [error, setError] = useState<string | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);      // cargando simulación rápida
  const [loadingMC, setLoadingMC] = useState(false);          // cargando Monte Carlo
  const [showDashboard, setShowDashboard] = useState(false);

  const isMonteCarlo = useMemo(() => !!mcResult, [mcResult]);

  // -------- Normalizador general (endpoint "simple") --------
  function normalizeApiResult(raw: any): { noche: any | null; dia: any | null } {
    if (!raw) return { noche: null, dia: null };
    const data = raw?.data ?? raw;

    if (data?.turno_noche || data?.turno_dia) {
      return { noche: data.turno_noche ?? null, dia: data.turno_dia ?? null };
    }

    if (raw?.turno_noche || raw?.turno_dia) {
      return { noche: raw.turno_noche ?? null, dia: raw.turno_dia ?? null };
    }

    if (data?.ocupacion_recursos || data?.timeline || data?.turno_fin_real) {
      return { noche: data, dia: null };
    }

    if (raw?.ocupacion_recursos || raw?.timeline || raw?.turno_fin_real) {
      return { noche: raw, dia: null };
    }

    return { noche: null, dia: null };
  }

  // -------- Normalizador de un ESCENARIO Monte Carlo --------
  // Estructura esperada: { turno_fin_real, resultado: { turno_noche, turno_dia, ... } }
  function normalizeMonteCarloScenario(s: MonteCarloScenario | undefined | null): {
    noche: any | null;
    dia: any | null;
  } {
    if (!s) return { noche: null, dia: null };

    const resultado = s.resultado ?? s; // por si en algún momento se usa sin "resultado"

    const noche = resultado.turno_noche ?? null;
    const dia = resultado.turno_dia ?? null;

    return { noche, dia };
  }

  // -------- Resultado actual elegido (optimista/realista/pesimista) --------
  const selectedResult = useMemo(() => {
    if (!mcResult) {
      // mientras no haya Monte Carlo, se usa lo de la simulación rápida
      return baseResult;
    }

    const rawScenario = (mcResult as any)[selectedScenario] as MonteCarloScenario;
    const norm = normalizeMonteCarloScenario(rawScenario);

    // Lo devolvemos con la misma forma que el endpoint normal
    return {
      turno_noche: norm.noche,
      turno_dia: norm.dia,
    };
  }, [mcResult, selectedScenario, baseResult]);

  // -------- Normalizado final que consume el Dashboard --------
  const normalized = useMemo(
    () => normalizeApiResult(selectedResult),
    [selectedResult]
  );

  // -------- Info pequeña para el carrusel (horas de término) --------
  const scenariosInfo = useMemo(() => {
    if (!mcResult) return null;

    const mkInfo = (s: MonteCarloScenario | undefined | null) => {
      if (!s) return { endTimeNoche: null, endTimeDia: null };

      // Usamos el detalle por turno desde resultado.turno_noche/turno_dia
      const norm = normalizeMonteCarloScenario(s);
      const noche = norm.noche;
      const dia = norm.dia;

      return {
        endTimeNoche: noche?.turno_fin_real ?? null,
        endTimeDia: dia?.turno_fin_real ?? null,
      };
    };

    return {
      optimista: mkInfo(mcResult.optimista),
      realista: mkInfo(mcResult.realista),
      pesimista: mkInfo(mcResult.pesimista),
    };
  }, [mcResult]);

  // -------- Payload para ambos endpoints --------
  function buildPayload(params: any, night: any, dayA: any, dayB: any) {
    return {
      "Cajas facturadas": params.cajasFacturadas,
      "Cajas piqueadas": params.cajasPiqueadas,
      "Pickers": night.pickers,
      "Grueros": night.grueros,
      "Chequeadores": night.chequeadores,
      "Parrilleros": night.consolidadores,
      "Camiones": night.camiones,
      "shifts_day": {
        "turno_A": {
          "Pickers": dayA.pickers,
          "Grueros": dayA.grueros,
          "Chequeadores": dayA.chequeadores,
          "Parrilleros": dayA.consolidadores,
        },
        "turno_B": {
          "Pickers": dayB.pickers,
          "Grueros": dayB.grueros,
          "Chequeadores": dayB.chequeadores,
          "Parrilleros": dayB.consolidadores,
        }
      }
    };
  }

  // ----------- Monte Carlo (segunda llamada, en background) -----------
  async function runMonteCarlo(params: any, night: any, dayA: any, dayB: any) {
    try {
      setLoadingMC(true);
      setShowDashboard(false);

      const payload = buildPayload(params, night, dayA, dayB);

      const response = await axios.post(
        "http://localhost:8000/simulate-montecarlo",
        payload
      );

      // Backend: { success, data: { metric, n_iter, optimista, realista, pesimista }, message }
      const data: MonteCarloResult = (response.data as any)?.data ?? response.data;

      setMcResult(data);
      setSelectedScenario("realista");
      setShowDashboard(true);
      console.log("Monte Carlo result:", data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as any)?.detail;
        setError(
          detail ||
          (err.response?.data as any)?.message ||
          err.message ||
          "Error al ejecutar simulación Monte Carlo"
        );
      } else {
        setError("Error al ejecutar simulación Monte Carlo");
      }
      console.error("Error Monte Carlo:", err);
    } finally {
      setLoadingMC(false);
    }
  }

  // ----------- Simulación rápida (primera llamada) -----------
  async function runSimulation(params: any, night: any, dayA: any, dayB: any) {
    if (params.cajasPiqueadas > params.cajasFacturadas) {
      setError("Las cajas piqueadas no pueden ser mayores que las facturadas.");
      return;
    }

    setError(null);
    setLoadingBase(true);
    setMcResult(null);
    setShowDashboard(false);

    try {
      const payload = buildPayload(params, night, dayA, dayB);

      const response = await axios.post(
        "http://localhost:8000/simulate",
        payload
      );

      // también puede venir { success, data, message }
      const data = (response.data as any)?.data ?? response.data;

      setBaseResult(data);
      console.log("Base simulation result:", data);

      // Disparar Monte Carlo en segundo plano
      //void runMonteCarlo(params, night, dayA, dayB);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = (err.response?.data as any)?.detail;
        setError(
          detail ||
          (err.response?.data as any)?.message ||
          err.message ||
          "Error al ejecutar simulación"
        );
      } else {
        setError("Error al ejecutar simulación");
      }
      console.error("Error:", err);
    } finally {
      setLoadingBase(false);
    }
  }

  return {
    // resultado rápido para Simulation2D
    baseResult,

    // resultado normalizado del escenario seleccionado (para Dashboard)
    normalized,
    selectedResult,

    // info Monte Carlo y selector
    isMonteCarlo,
    mcResult,
    selectedScenario,
    setSelectedScenario,
    scenariosInfo,

    // estados
    error,
    loadingBase,
    loadingMC,
    showDashboard,

    // acciones
    runSimulation,
  };
}
