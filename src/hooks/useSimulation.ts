import { useState, useMemo } from "react";
import axios from "axios";

export function useSimulation() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);


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

  const normalized = useMemo(() => normalizeApiResult(result), [result]);

  async function runSimulation(params: any, night: any, dayA: any, dayB: any) {
    if (params.cajasPiqueadas > params.cajasFacturadas) {
      setError("Las cajas piqueadas no pueden ser mayores que las facturadas.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await axios.post("/api/simulate", {
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
      });

      setResult(response.data);
      console.log("Simulation result:", response.data);
      setShowDashboard(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || err.message || "Error al ejecutar simulación");
      } else {
        setError("Error al ejecutar simulación");
      }
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    result,
    normalized,
    error,
    loading,
    showDashboard,
    runSimulation,
  };
}