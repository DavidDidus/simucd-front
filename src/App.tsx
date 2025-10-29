import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import axios from "axios";
import { ParamCard } from "./components/ParamCard.tsx";
import type { Params } from "./types";
import BarChart from "./components/BarChart";
import Timeline from "./components/Timeline";
import Tabs from "./components/Tabs";
import type { TabId } from "./components/Tabs";

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
  const [showDashboard, setShowDashboard] = useState(false); // mostrar dashboard
  let [result, setResult] = useState<any>(null);          // resultado de backend
  const [activeTab, setActiveTab] = useState<TabId>("diaA");


  // refs para FLIP
  const bigCardRef = useRef<HTMLDivElement | null>(null);
  const firstRectRef = useRef<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(params));
  }, [params]);

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

  /** Normaliza la respuesta del backend para soportar:
 *  - ciclo completo: { data: { turno_noche: {...}, turno_dia: {...} } }
 *  - solo noche:     { data: { ocupacion_recursos, timeline, ... } }
 */
  function normalizeApiResult(raw: any): { noche: any | null; dia: any | null } {
    if (!raw) return { noche: null, dia: null };

    // A) Si viene con wrapper { success, data: {...} }
    const data = raw?.data ?? raw;

    // A1) Ciclo completo dentro de "data"
    if (data?.turno_noche || data?.turno_dia) {
      return { noche: data.turno_noche ?? null, dia: data.turno_dia ?? null };
    }

    // A2) Ciclo completo en raíz
    if (raw?.turno_noche || raw?.turno_dia) {
      return { noche: raw.turno_noche ?? null, dia: raw.turno_dia ?? null };
    }

    // B) Solo noche (payload histórico)
    if (data?.ocupacion_recursos || data?.timeline || data?.turno_fin_real) {
      return { noche: data, dia: null };
    }

    // C) Último intento: quizá ya estaba unwrappeado
    if (raw?.ocupacion_recursos || raw?.timeline || raw?.turno_fin_real) {
      return { noche: raw, dia: null };
    }

    return { noche: null, dia: null };
  }

  const api = result;                       // lo que guardas con setResult(response.data)
  const norm = useMemo(() => normalizeApiResult(api), [api]);

  /** Mapas de ocupación por pestaña (usa el normalizado) */
  function getRecMaps() {
    const recDia = norm.dia?.ocupacion_recursos ?? null;
    const recNoche = norm.noche?.ocupacion_recursos ?? null;
    return { recDia, recNoche };
  }

  function readOcc(
    rec: any,
    key: "pickers" | "grueros" | "parrilleros" | "chequeadores",
    turnoIndex?: number
  ): number {
    const item = rec?.[key];
    if (!item) return 0;
    if (typeof turnoIndex === "number") {
      const arr = item?.por_turno_dia;
      const v = Array.isArray(arr) && arr[turnoIndex]?.porcentaje_ocupacion;
      return typeof v === "number" ? v : 0;
    }
    const v = item?.porcentaje_ocupacion;
    return typeof v === "number" ? v : 0;
  }

  function buildUtilizationForTab(tab: TabId): number[] {
    const { recDia, recNoche } = getRecMaps();

    if (tab === "noche" && recNoche) {
      return [
        readOcc(recNoche, "pickers"),
        readOcc(recNoche, "grueros"),
        readOcc(recNoche, "parrilleros"),
        readOcc(recNoche, "chequeadores"),
      ];
    }

    // Día Turno A = índice 0, Día Turno B = índice 1
    const idx = tab === "diaA" ? 0 : 1;
    if (recDia) {
      return [
        readOcc(recDia, "pickers", idx),
        readOcc(recDia, "grueros", idx),
        readOcc(recDia, "parrilleros", idx),
        readOcc(recDia, "chequeadores", idx),
      ];
    }

    // Fallback: si no hay datos, 0s
    return [0, 0, 0, 0];
  }

  function buildTimelineForTab(tab: TabId) {
    const arr = tab === "noche" ? (norm.noche?.timeline ?? []) : (norm.dia?.timeline ?? []);
    // Adaptamos distintas formas: {hora/ time/ hhmm} + {descripcion/ label/ evento}
    return (arr || []).map((p: any) => ({
      time: p.hora ?? p.time ?? p.hhmm ?? p.t ?? "00:00",
      label: p.descripcion ?? p.label ?? p.evento ?? "",
      isEnd: p.isEnd ?? p.final ?? false,
    }));
  }


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
            {showDashboard && (
          <div
            className="dash-card card-with-tabs"
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            {/* Pestañas pegadas al card */}
            <Tabs
              tabs={[
                { id: "noche", label: "Noche" },
                { id: "diaA", label: "Día — Turno A" },
                { id: "diaB", label: "Día — Turno B" },
              ]}
              active={activeTab}
              onChange={setActiveTab}
              className="tabs-in-card"
            />

            {/* Contenido del card por pestaña */}
            <div className="dashboard-grid in-card">
              <BarChart
                title={
                  activeTab === "noche"
                    ? "Ocupación (Noche)"
                    : activeTab === "diaA"
                    ? "Ocupación (Día - Turno A)"
                    : "Ocupación (Día - Turno B)"
                }
                labels={["Pickers", "Grueros", "Consol.", "Chequeadores"]}
                values={[
                  params.pickers,
                  params.grueros,
                  params.consolidadores,
                  params.chequeadores,
                ]}
                utilization={buildUtilizationForTab(activeTab)}
                className="subcard grid-chart"
              />

              <div className="subcard kpi-card grid-kpis">
                <div className="card-title">KPIs clave</div>
                  <div className="kpi-grid">
                    <div className="kpi">
                      <div className="kpi-label">ICEO</div>
                      <div className="kpi-value">
                        {(
                          activeTab === "noche"
                            ? norm.noche?.ice_mixto?.valor
                            : norm.dia?.ice_mixto?.valor
                        )?.toLocaleString?.() ?? "N/A"}
                      </div>
                    </div>

                    <div className="kpi">
                      <div className="kpi-label">Hora de término</div>
                      <div className="kpi-value">
                        {activeTab === "noche"
                          ? (norm.noche?.turno_fin_real ?? "Noche N/D")
                          : (norm.dia?.turno_fin_real ?? "Día N/D")}
                      </div>
                    </div>
                  </div>
                </div>


                              <Timeline
                  timePoints={buildTimelineForTab(activeTab)}
                  label={
                    activeTab === "noche"
                      ? "Proyección (Noche)"
                      : activeTab === "diaA"
                      ? "Proyección (Turno A)"
                      : "Proyección (Turno B)"
                  }
                  className="subcard grid-timeline"
                />

            </div>
          </div>
        )}
      </section>
    </div>
  );
}
