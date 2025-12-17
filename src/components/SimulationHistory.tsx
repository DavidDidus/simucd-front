import { useMemo } from "react";

type ShiftRes = {
  pickers?: number;
  grueros?: number;
  chequeadores?: number;
  consolidadores?: number;
  camiones?: number;
  [k: string]: number | undefined;
};

type AuxFlow = Record<string, number>;

type SimulationRecord = {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  cajasFacturadas: number;
  cajasPiqueadas: number;
  night: ShiftRes;
  dayA: ShiftRes;
  dayB: ShiftRes;
  subestandar?: AuxFlow;
  clasificacion?: AuxFlow;
  reempaque?: AuxFlow;
};

const HISTORY_KEY = "simucd-history";

function formatShiftLine(s?: ShiftRes) {
  if (!s) return "—";
  return `P:${s.pickers ?? 0} G:${s.grueros ?? 0} Ch:${s.chequeadores ?? 0} Co:${s.consolidadores ?? 0} Ca:${s.camiones ?? 0}`;
}

type AuxKey = { key: string; label: string };

function AuxLines({ flow, keys }: { flow?: AuxFlow; keys: AuxKey[] }) {
  if (!flow) return <div className="hv-muted">—</div>;

  return (
    <div className="hv-lines">
      {keys.map(({ key, label }) => (
        <div key={key} className="hv-line">
          <span className="hv-line-k">{label}</span>
          <span className="hv-line-v">{flow[key] ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="hv-block">
      <div className="hv-block-title">{title}</div>
      <div className="hv-block-body">{children}</div>
    </div>
  );
}

export default function SimulationHistory() {
  const items: SimulationRecord[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? (JSON.parse(raw) as SimulationRecord[]) : [];
      return [...arr].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return [];
    }
  }, []);

  const SUB_KEYS: AuxKey[] = [
    { key: "personal_subestandar", label: "Pers." },
    { key: "entrada_subestandar", label: "Entrada" },
    { key: "prv_danado", label: "PRV" },
    { key: "saca_carton", label: "Cartón" },
    { key: "saca_film", label: "Film" },
    { key: "saca_pet", label: "PET" },
  ];

  const CLA_KEYS: AuxKey[] = [
    { key: "personal_clasificacion", label: "Pers." },
    { key: "entrada_clasificacion", label: "Entrada" },
    { key: "entrada_estandarizacion", label: "Estand." },
  ];

  const REE_KEYS: AuxKey[] = [
    { key: "personal_reempaque", label: "Pers." },
    { key: "entrada_reempaque", label: "Entrada" },
    { key: "entrada_sin_recurso", label: "Sin rec." },
  ];

  return (
    <div className="hv">
      <div className="hv-header">
        <h2 className="hv-title">Historial de simulaciones</h2>
        <span className="hv-count">{items.length} registro(s)</span>
      </div>

      {items.length === 0 ? (
        <div className="hv-empty">Aún no hay simulaciones guardadas.</div>
      ) : (
        <div className="hv-list">
          {items.map((item) => (
            <div key={item.id} className="hv-card">
              <div className="hv-row">
                <Block title="Fecha">
                  <div className="hv-strong hv-mono">{item.date}</div>
                  <div className="hv-subtitle">Hora</div>
                  <div className="hv-strong hv-mono">{item.time}</div>
                </Block>

                <div className="hv-divider" />

                <Block title="Ventas">
                  <div className="hv-line">
                    <span className="hv-line-k">Facturadas</span>
                    <span className="hv-line-v hv-strong">{item.cajasFacturadas}</span>
                  </div>
                  <div className="hv-line">
                    <span className="hv-line-k">Piqueadas</span>
                    <span className="hv-line-v hv-strong">{item.cajasPiqueadas}</span>
                  </div>
                </Block>

                <div className="hv-divider" />

                <Block title="Turnos">
                  <div className="hv-shift">
                    <div className="hv-shift-k">Noche</div>
                    <div className="hv-shift-v hv-mono">{formatShiftLine(item.night)}</div>
                  </div>

                  <div className="hv-shift">
                    <div className="hv-shift-k">Día A</div>
                    <div className="hv-shift-v hv-mono">{formatShiftLine(item.dayA)}</div>
                  </div>

                  <div className="hv-shift">
                    <div className="hv-shift-k">Día B</div>
                    <div className="hv-shift-v hv-mono">{formatShiftLine(item.dayB)}</div>
                  </div>
                </Block>

                <div className="hv-divider" />

                <Block title="Clasificación">
                  <AuxLines flow={item.clasificacion} keys={CLA_KEYS} />
                </Block>

                <div className="hv-divider" />

                <Block title="Reempaque">
                  <AuxLines flow={item.reempaque} keys={REE_KEYS} />
                </Block>

                <div className="hv-divider" />

                <Block title="Subestándar">
                  <AuxLines flow={item.subestandar} keys={SUB_KEYS} />
                </Block>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
