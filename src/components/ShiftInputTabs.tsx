export type ShiftId = "noche" | "diaA" | "diaB";

interface Props {
  value: ShiftId;
  onChange: (s: ShiftId) => void;
  className?: string;
}

export default function ShiftInputTabs({ value, onChange, className }: Props) {
  const TabBtn = ({ id, label }: { id: ShiftId; label: string }) => (
    <button
      type="button"
      role="tab"
      aria-selected={value === id}
      className={`shiftseg-btn ${value === id ? "active" : ""}`}
      onClick={() => onChange(id)}
    >
      {label}
    </button>
  );

  return (
    <div className={className ?? ""} style={{ paddingBottom: "1rem" }}>
      <div className="shiftseg" role="tablist" aria-label="Selección de turno">
        <TabBtn id="noche" label="Noche" />
        <TabBtn id="diaA" label="Día — Turno A" />
        <TabBtn id="diaB" label="Día — Turno B" />
      </div>
    </div>
  );
}
