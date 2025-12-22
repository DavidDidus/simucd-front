import { useState } from "react";
import type { ShiftId } from "../components/ShiftInputTabs";

type StaffKey = "pickers" | "grueros" | "consolidadores" | "chequeadores" | "camiones" | "personal_subestandar" | "entrada_subestandar";

export function useShiftParams(initialParams: any) {
  const [night, setNight] = useState({
    pickers: initialParams.pickers,
    grueros: initialParams.grueros,
    consolidadores: initialParams.consolidadores,
    chequeadores: initialParams.chequeadores,
    camiones: initialParams.camiones,
  });

  const [dayA, setDayA] = useState({ ...night });
  const [dayB, setDayB] = useState({ ...night });
  const [subestandar, setSubestandar] = useState({
    personal_subestandar: initialParams.personal_subestandar,
    entrada_subestandar: initialParams.entrada_subestandar,
    prv_danado: initialParams.prv_danado,
    saca_carton: initialParams.saca_carton,
    saca_film: initialParams.saca_film,
    saca_pet: initialParams.saca_pet,
    
  });
  const [clasificacion, setClasificacion] = useState({
    personal_clasificacion: initialParams.personal_clasificacion,
    entrada_clasificacion: initialParams.entrada_clasificacion,
    entrada_estandarizacion: initialParams.entrada_estandarizacion,
  });

  const [reempaque, setReempaque] = useState({
    personal_reempaque: initialParams.personal_reempaque,
    entrada_reempaque: initialParams.entrada_reempaque,
    entrada_sin_recurso: initialParams.entrada_sin_recurso,
  });

  function getCurrentParams(shiftInput: ShiftId) {
    if (shiftInput === "Clasificación") {
      return clasificacion;
    }
    if (shiftInput === "Reempaque") {
      return reempaque;
    }
    if (shiftInput === "Subestándar") {
      return subestandar;
    }
    return shiftInput === "noche" ? night : shiftInput === "diaA" ? dayA : dayB ;
  }

  function updateShiftParam(shiftInput: ShiftId, key: StaffKey, value: number) {
    if (shiftInput === "Clasificación") {
      setClasificacion((p: any) => ({ ...p, [key]: value }));
      return;
    }
    if (shiftInput === "Reempaque") {
      setReempaque((p: any) => ({ ...p, [key]: value }));
      return;
    }

    if (shiftInput === "Subestándar") {
      setSubestandar((p: any) => ({ ...p, [key]: value }));
      return;
    }
    const setter = shiftInput === "noche" ? setNight : shiftInput === "diaA" ? setDayA : setDayB;
    setter((p: any) => ({ ...p, [key]: value }));
  }

  return {
    night,
    dayA,
    dayB,
    subestandar,
    getCurrentParams,
    updateShiftParam,
  };
}