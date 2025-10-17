import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import axios from "axios";
import { ParamCard } from "./components/ParamCard.tsx";
import { simulate } from "./simulation";
import type { Params } from "./types";

import pickerImg from "./assets/Piqueador.png";
import grueroImg from "./assets/Gruero.png";
import consolidadorImg from "./assets/Consolidador de carga.png";
import chequeadorImg from "./assets/Chequeador.png";
import latasCCUImg from "./assets/Latas ccu.png";

const LS_KEY = "simucd-params";

const initial: Params = {
  pickers: 8,
  grueros: 4,
  consolidadores: 1,
  chequeadores: 2,
  cajasFacturadas: 0,
  cajasPiqueadas: 0,
};

export default function App() {
  const [params, setParams] = useState<Params>(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? { ...initial, ...JSON.parse(saved) } : initial;
  });

  const [editing, setEditing] = useState(false);            // ¿tarjeta expandida?
  const [snapshot, setSnapshot] = useState<Params | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  let [result, setResult] = useState<any>(null);          // resultado de backend


  // refs para FLIP
  const bigCardRef = useRef<HTMLDivElement | null>(null);
  const firstRectRef = useRef<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(params));
  }, [params]);

  let localResult = useMemo(() => simulate(params), [params]);

  function set<K extends keyof Params>(key: K, value: number) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  // Animación FLIP: calculamos el delta y animamos con transform
  useLayoutEffect(() => {
    const el = bigCardRef.current;
    const first = firstRectRef.current;
    if (!animating || !el || !first) return;

    const last = el.getBoundingClientRect();
    const invertX = first.left - last.left;
    const invertY = first.top - last.top;
    const scaleX = first.width / last.width || 1;
    const scaleY = first.height / last.height || 1;

    el.style.willChange = "transform";
    el.style.transformOrigin = "left center"; // sensación izquierda→derecha
    el.style.transform = `translate(${invertX}px, ${invertY}px) scale(${scaleX}, ${scaleY})`;
    // forzar reflow
    el.getBoundingClientRect();
    // reproducir
    el.classList.add("animating");
    el.style.transform = "";

    const onEnd = () => {
      el.classList.remove("animating");
      el.style.willChange = "";
      el.removeEventListener("transitionend", onEnd);
      setAnimating(false);
      firstRectRef.current = null;
    };
    el.addEventListener("transitionend", onEnd);
  }, [animating, editing]);

  function openEditor() {
    if (!bigCardRef.current) return;
    firstRectRef.current = bigCardRef.current.getBoundingClientRect();
    setSnapshot(params);     // para Cancelar
    setEditing(true);        // cambia grid-area
    setAnimating(true);      // dispara FLIP en useLayoutEffect
  }

  function collapseEditor(restoreSnapshot: boolean) {
    if (!bigCardRef.current) return;
    if (restoreSnapshot && snapshot) setParams(snapshot);

    // Tomamos "first" siendo el estado expandido, luego ponemos editing=false
    firstRectRef.current = bigCardRef.current.getBoundingClientRect();
    setEditing(false);
    setAnimating(true);
    setSnapshot(null);
  }

  // ESC = cancelar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editing) collapseEditor(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, snapshot]);

  async function handleRun() {
    if (params.cajasPiqueadas > params.cajasFacturadas) {
      setError("Las cajas piqueadas no pueden ser mayores que las facturadas.");
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/simulate", {
        "Cajas facturadas": params.cajasFacturadas,
        "Cajas piqueadas": params.cajasPiqueadas,
        "Pickers": params.pickers,
        "Grueros": params.grueros,
        "Chequeadores": params.chequeadores,
        "parrilleros": params.consolidadores,
      });

      console.log("Resultado de simulación:", response.data);
      
      setResult(response.data);
      
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

  const displayResult = result || localResult;


  return (
    <div className="page">
      <header className="brand">SIMUCD</header>

      <main className={`grid ${editing ? "editing" : ""}`}>
        {/* Tarjeta de latas (misma tarjeta, expandible) */}
        <div
          ref={bigCardRef}
          className={`big-card ${editing ? "expanded" : ""}`}
          role={!editing ? "button" : undefined}
          tabIndex={!editing ? 0 : -1}
          onClick={!editing ? openEditor : undefined}
          onKeyDown={
            !editing
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEditor();
                  }
                }
              : undefined
          }
        >
          {!editing ? (
            <>
              <img src={latasCCUImg} alt="Cajas CCU" className="big-img" />
              <div className="big-title">Cajas facturadas y piqueadas</div>
              <div className="big-subtitle">
                {params.cajasFacturadas.toLocaleString()} facturadas ·{" "}
                {params.cajasPiqueadas.toLocaleString()} piqueadas
              </div>
            </>
          ) : (
            <div className="expand-two-col fade-in">
              <div className="modal-hero">
                <h2 className="modal-hero-title">Cajas facturadas y piqueadas</h2>
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
                    value={params.cajasFacturadas}
                    onChange={(e) =>
                      set("cajasFacturadas", Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>

                <label className="field">
                  <span>Cajas piqueadas</span>
                  <input
                    className="num-input wide"
                    type="number"
                    min={0}
                    step={1}
                    value={params.cajasPiqueadas}
                    onChange={(e) =>
                      set("cajasPiqueadas", Math.max(0, Number(e.target.value)))
                    }
                  />
                </label>

                <div className="modal-actions inline">
                  <button className="run-btn" onClick={() => collapseEditor(false)}>
                    Aceptar
                  </button>
                  <button className="run-btn" onClick={() => collapseEditor(true)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Otras tarjetas (se desvanecen cuando se edita) */}
        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Pickers"
            value={params.pickers}
            onChange={(v) => set("pickers", v)}
            imgSrc={pickerImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Gruero"
            value={params.grueros}
            onChange={(v) => set("grueros", v)}
            imgSrc={grueroImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Consolidador de carga"
            value={params.consolidadores}
            onChange={(v) => set("consolidadores", v)}
            imgSrc={consolidadorImg}
          />
        </div>

        <div className={editing ? "hide-on-expand" : ""}>
          <ParamCard
            label="Chequeador"
            value={params.chequeadores}
            onChange={(v) => set("chequeadores", v)}
            imgSrc={chequeadorImg}
          />
        </div>
      </main>

      <section className={`panel ${editing ? "hide-on-expand" : ""}`}>
        <button className="run-btn" onClick={handleRun}>
          Ejecutar simulación
        </button>
        {error && <p className="error">{error}</p>}
        <div className="results">
          <h3>Resultado</h3>
          <ul>
            <li><strong>Pendientes: </strong>{displayResult.pendientes?.toLocaleString() || 'N/A'} cajas</li>
              <li><strong>Capacidad (cuello de botella): </strong>{displayResult.capacidadPorHora?.toLocaleString() || 'N/A'} cajas/h</li>
              <li><strong>Cuello de botella: </strong>{displayResult.cuelloBotella || 'N/A'}</li>
              <li><strong>Hora de término: </strong>{displayResult.turno_fin_real || displayResult.data?.turno_fin_real || 'N/A'}</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
