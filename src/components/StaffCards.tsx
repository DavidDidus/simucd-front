import { ParamCard } from "./ParamCard";
import QuadCarousel from "./CardCarousel";
import type { ShiftId } from "./ShiftInputTabs";

import pickerImg from "../assets/Piqueador.png";
import grueroImg from "../assets/Gruero.png";
import consolidadorImg from "../assets/Consolidador de carga.png";
import chequeadorImg from "../assets/Chequeador.png";
import camionImg from "../assets/Camion.png";

interface StaffCardsProps {
  shiftInput: ShiftId;
  editing: boolean;
  currentParams: any;
  onUpdate: (key: string, value: number) => void;
}

export function StaffCards({
  shiftInput,
  editing,
  currentParams,
  onUpdate,
}: StaffCardsProps) {
  if (shiftInput === "noche") {
    return (
      <QuadCarousel className={editing ? "hide-on-expand" : ""}>
        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Pickers"
            value={currentParams.pickers}
            onChange={(v) => onUpdate("pickers", v)}
            imgSrc={pickerImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Gruero"
            value={currentParams.grueros}
            onChange={(v) => onUpdate("grueros", v)}
            imgSrc={grueroImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Camiones"
            value={currentParams.camiones}
            onChange={(v) => onUpdate("camiones", v)}
            imgSrc={camionImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Chequeador"
            value={currentParams.chequeadores}
            onChange={(v) => onUpdate("chequeadores", v)}
            imgSrc={chequeadorImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Consolidador de carga"
            value={currentParams.consolidadores}
            onChange={(v) => onUpdate("consolidadores", v)}
            imgSrc={consolidadorImg}
          />
        </div>
      </QuadCarousel>
    );
  }

  return (
    <div className={`day-cards-container ${editing ? "hide-on-expand" : ""}`}>
      <ParamCard
        label="Pickers"
        value={currentParams.pickers}
        onChange={(v) => onUpdate("pickers", v)}
        imgSrc={pickerImg}
      />

      <ParamCard
        label="Gruero"
        value={currentParams.grueros}
        onChange={(v) => onUpdate("grueros", v)}
        imgSrc={grueroImg}
      />

      <ParamCard
        label="Chequeador"
        value={currentParams.chequeadores}
        onChange={(v) => onUpdate("chequeadores", v)}
        imgSrc={chequeadorImg}
      />

      <ParamCard
        label="Consolidador de carga"
        value={currentParams.consolidadores}
        onChange={(v) => onUpdate("consolidadores", v)}
        imgSrc={consolidadorImg}
      />
    </div>
  );
}