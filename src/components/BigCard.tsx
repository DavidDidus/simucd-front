import { useState } from "react";
import latasCCUImg from "../assets/Latas ccu.png";
import type { Params } from "../types";

interface BigCardProps {
  bigCardRef: React.RefObject<HTMLDivElement | null>  ;
  editing: boolean;
  params: Params;
  onOpen: () => void;
  onSet: <K extends keyof Params>(key: K, value: number) => void;
  onAccept: () => void;
  onCancel: () => void;
}

export function BigCard({
  bigCardRef,
  editing,
  params,
  onOpen,
  onSet,
  onAccept,
  onCancel,
}: BigCardProps) {
  const [cajasFacturadasInput, setCajasFacturadasInput] = useState<string>(
    params.cajasFacturadas.toString()
  );
  const [cajasPiqueadasInput, setCajasPiqueadasInput] = useState<string>(
    params.cajasPiqueadas.toString()
  );

  const handleFacturadasChange = (value: string) => {
    setCajasFacturadasInput(value);
    const num = Number(value);
    if (value !== "" && !isNaN(num)) {
      onSet("cajasFacturadas", Math.max(0, num));
    }
  };

  const handlePiqueadasChange = (value: string) => {
    setCajasPiqueadasInput(value);
    const num = Number(value);
    if (value !== "" && !isNaN(num)) {
      onSet("cajasPiqueadas", Math.max(0, num));
    }
  };

  const handleFacturadasBlur = () => {
    if (cajasFacturadasInput === "" || isNaN(Number(cajasFacturadasInput))) {
      setCajasFacturadasInput("0");
      onSet("cajasFacturadas", 0);
    }
  };

  const handlePiqueadasBlur = () => {
    if (cajasPiqueadasInput === "" || isNaN(Number(cajasPiqueadasInput))) {
      setCajasPiqueadasInput("0");
      onSet("cajasPiqueadas", 0);
    }
  };

  return (
    <div
      ref={bigCardRef}
      className={`big-card ${editing ? "expanded" : ""}`}
      role={!editing ? "button" : undefined}
      tabIndex={!editing ? 0 : -1}
      onClick={!editing ? onOpen : undefined}
      onKeyDown={
        !editing
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      {!editing ? (
        <>
          <img src={latasCCUImg} alt="Cajas CCU" className="big-img" />
          <div className="big-title">Cajas facturadas y pickeadas</div>
          <div className="big-subtitle">
            {params.cajasFacturadas.toLocaleString()} facturadas ·{" "}
            {params.cajasPiqueadas.toLocaleString()} pickeadas
          </div>
        </>
      ) : (
        <div className="expand-two-col fade-in">
          <div className="modal-hero">
            <h2 className="modal-hero-title">Cajas facturadas y pickeadas</h2>
            <img src={latasCCUImg} alt="" className="modal-hero-img" />
          </div>

          <div className="modal-form slide-in">
            <label className="field">
              <span>Cajas facturadas</span>
              <input
                className="num-input wide"
                type="number"
                min={0}
                step={1}
                value={cajasFacturadasInput}
                onChange={(e) => handleFacturadasChange(e.target.value)}
                onBlur={handleFacturadasBlur}
              />
            </label>

            <label className="field">
              <span>Cajas piqueadas</span>
              <input
                className="num-input wide"
                type="number"
                min={0}
                step={1}
                value={cajasPiqueadasInput}
                onChange={(e) => handlePiqueadasChange(e.target.value)}
                onBlur={handlePiqueadasBlur}
              />
            </label>

            <div className="modal-actions inline">
              <button className="run-btn" onClick={onAccept}>
                Aceptar
              </button>
              <button className="run-btn" onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}