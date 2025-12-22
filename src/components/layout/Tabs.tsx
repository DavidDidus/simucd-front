export type TabId = "noche" | "diaA" | "diaB" | "Clasificación";

export interface TabDef {
  id: TabId;
  label: string;
}

interface TabsProps {
  tabs: TabDef[];
  active: TabId;
  onChange: (id: TabId) => void;
  className?: string;
}

/**
 * Tabs accesibles con roles/aria, sin librerías externas.
 * Usa botones para las pestañas y deja que el contenedor padre
 * muestre el contenido de la pestaña activa.
 */
export default function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={className || ""}>
      <div role="tablist" aria-label="Resultados por turno" className="tabs">
        {tabs.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              className={`tab ${selected ? "active" : ""}`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
