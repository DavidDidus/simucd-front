import { ParamCard } from "./ParamCard";
import QuadCarousel from "./CardCarousel";
import type { ShiftId } from "./ShiftInputTabs";

import pickerImg from "../assets/resources/Picker.png";
import grueroImg from "../assets/resources/Gruero.png";
import consolidadorImg from "../assets/resources/Consolidador_de_carga .png";
import chequeadorImg from "../assets/resources/Chequeador.png";
import camionImg from "../assets/resources/Camion.png";

import personal_subestandar from "../assets/subestandar/Operario_Subestandar.png";
import entrada_subestandar from "../assets/subestandar/Entrada_subestandar.png";

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
  if ( shiftInput === "Subestandar") {
    return (
      <div className={`day-cards-container ${editing ? "hide-on-expand" : ""}`}>
        <ParamCard
          label="Personal subestandar"
          value={currentParams.personal_subestandar}
          onChange={(v) => onUpdate("personal_subestandar", v)}
          imgSrc={personal_subestandar}
        />
        <ParamCard
          label="Puntos de entrada subestandar"
          value={currentParams.entrada_subestandar}
          onChange={(v) => onUpdate("entrada_subestandar", v)}
          imgSrc={entrada_subestandar}
        />
      </div>

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