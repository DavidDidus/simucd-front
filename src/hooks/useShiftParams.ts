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
  });

  function getCurrentParams(shiftInput: ShiftId) {
    if (shiftInput === "Subestandar") {
      return subestandar;
    }
    return shiftInput === "noche" ? night : shiftInput === "diaA" ? dayA : dayB ;
  }

  function updateShiftParam(shiftInput: ShiftId, key: StaffKey, value: number) {
    if (shiftInput === "Subestandar") {
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