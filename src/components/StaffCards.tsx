import { ParamCard } from "./ParamCard";
import QuadCarousel from "./layout/CardCarousel";
import type { ShiftId } from "./ShiftInputTabs";

import pickerImg from "../assets/resources/Picker.png";
import grueroImg from "../assets/resources/Gruero.png";
import consolidadorImg from "../assets/resources/Consolidador_de_carga .png";
import chequeadorImg from "../assets/resources/Chequeador.png";
import camionImg from "../assets/resources/Camion.png";
import camiont1Img from "../assets/resources/camion_retorno.png";
import personal_subestandar from "../assets/subestandar/Operario_subestandar.png";
import liquido_subestandar from "../assets/subestandar/Liquido.png";
import prv_danado from "../assets/subestandar/PRV_danado.png";
import saca_carton from "../assets/subestandar/Sacas_carton.png";
import saca_film from "../assets/subestandar/Sacas_film.png";
import saca_pet from "../assets/subestandar/Sacas_PET.png";

import personal_clasificacion from "../assets/clasificacion/Operario_clasificacion.png";
import entrada_clasificacion from "../assets/clasificacion/Entrada_clasificacion.png";
import entrada_estandarizacion from "../assets/clasificacion/Entrada_Estandarizacion.png";

import personal_reempaque from "../assets/reempaque/Operario_Reempaque.png";
import entrada_reempaque from "../assets/reempaque/Entrada_Reempaque.png";
import entrada_sin_recurso from "../assets/reempaque/Entrada_sin_recurso.png";
import { ParamCheckbox } from "./ParamCheckbox";

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
  if ( shiftInput === "Subestándar") {
    return (
      <div className={`day-cards-container subestandar ${editing ? "hide-on-expand" : ""}`}>
        <ParamCard
          label="Operarios"
          value={currentParams.personal_subestandar}
          onChange={(v) => onUpdate("personal_subestandar", v)}
          imgSrc={personal_subestandar}
        />
        <ParamCard
          label="Cajas de Liquidos"
          value={currentParams.entrada_subestandar}
          onChange={(v) => onUpdate("entrada_subestandar", v)}
          imgSrc={liquido_subestandar}
        />
        <ParamCard
          label="Pallets PRV Dañada"
          value={currentParams.prv_danado}
          onChange={(v) => onUpdate("prv_danado", v)}
          imgSrc={prv_danado}
        />
        <ParamCard
          label="Sacas Cartón"
          value={currentParams.saca_carton}
          onChange={(v) => onUpdate("saca_carton", v)}
          imgSrc={saca_carton}
        />
        <ParamCard
          label="Sacas Film"
          value={currentParams.saca_film}
          onChange={(v) => onUpdate("saca_film", v)}
          imgSrc={saca_film}
        />
        <ParamCard
          label="Sacas PET"
          value={currentParams.saca_pet}
          onChange={(v) => onUpdate("saca_pet", v)}
          imgSrc={saca_pet}
        />
        
      </div>

    );
  } else if (shiftInput === "Reempaque") {

    return (
      <div className={`day-cards-container ${editing ? "hide-on-expand" : ""}`}>
        <ParamCard
          label="Operarios"
          value={currentParams.personal_reempaque}
          onChange={(v) => onUpdate("personal_reempaque", v)}
          imgSrc={personal_reempaque}
        />
        <ParamCard
          label="Cajas a Procesar"
          value={currentParams.entrada_reempaque}
          onChange={(v) => onUpdate("entrada_reempaque", v)}
          imgSrc={entrada_reempaque}
        />
        <ParamCard
          label="Cajas Iniciales"
          value={currentParams.entrada_sin_recurso}
          onChange={(v) => onUpdate("entrada_sin_recurso", v)}
          imgSrc={entrada_sin_recurso}
        />
      </div>
    );
  } else if (shiftInput === "Clasificación") {
    return (
      <div className={`day-cards-container ${editing ? "hide-on-expand" : ""}`}>
        <ParamCard
          label="Operarios"
          value={currentParams.personal_clasificacion}
          onChange={(v) => onUpdate("personal_clasificacion", v)}
          imgSrc={personal_clasificacion}
        />
        <ParamCard
          label="Cajas a Clasificar"
          value={currentParams.entrada_clasificacion}
          onChange={(v) => onUpdate("entrada_clasificacion", v)}
          imgSrc={entrada_clasificacion}
        />
        <ParamCard
          label="Cajas a Estandarizar"
          value={currentParams.entrada_estandarizacion}
          onChange={(v) => onUpdate("entrada_estandarizacion", v)}
          imgSrc={entrada_estandarizacion}
        />
      </div>
    );
  }
    else if (shiftInput === "diaA" ) {
      return (
    <div className={`day-cards-container subestandar  ${editing ? "hide-on-expand" : ""}`}>
      <ParamCheckbox
        label="Retorno Pallets"
        value={currentParams.retorno_pallets}
        onChange={(v) => onUpdate("retorno_pallets", v)}
        imgSrc={camiont1Img}
      />
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