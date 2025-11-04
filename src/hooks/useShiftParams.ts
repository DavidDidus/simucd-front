import { useState } from "react";
import type { ShiftId } from "../components/ShiftInputTabs";

type StaffKey = "pickers" | "grueros" | "consolidadores" | "chequeadores" | "camiones";

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

  function getCurrentParams(shiftInput: ShiftId) {
    return shiftInput === "noche" ? night : shiftInput === "diaA" ? dayA : dayB;
  }

  function updateShiftParam(shiftInput: ShiftId, key: StaffKey, value: number) {
    const setter = shiftInput === "noche" ? setNight : shiftInput === "diaA" ? setDayA : setDayB;
    setter((p: any) => ({ ...p, [key]: value }));
  }

  return {
    night,
    dayA,
    dayB,
    getCurrentParams,
    updateShiftParam,
  };
}