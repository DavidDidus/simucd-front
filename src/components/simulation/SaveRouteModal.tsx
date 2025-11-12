import { useState } from "react";
import type { Point } from "../../types";
import { generateRouteJSON, formatForRoutesFile } from "../../utils/routes/routes";

interface SaveRouteModalProps {
  points: Point[];
  onClose: () => void;
}

export default function SaveRouteModal({ points, onClose }: SaveRouteModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [priority, setPriority] = useState<number>(1);
  const [copied, setCopied] = useState(false);
  const [generatedJSON, setGeneratedJSON] = useState<string>("");

  const handleGenerate = () => {
    if (!name.trim()) {
      alert("Por favor ingresa un nombre para la ruta");
      return;
    }

    const json = generateRouteJSON(name, description, points, {
      eventTypes: eventTypes.length > 0 ? eventTypes : undefined,
      shifts: shifts.length > 0 ? shifts : undefined,
      priority,
    });

    const formatted = formatForRoutesFile(json);
    setGeneratedJSON(formatted);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedJSON);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("Error al copiar. Selecciona y copia manualmente.");
    }
  };

  const toggleEventType = (type: string) => {
    setEventTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleShift = (shift: string) => {
    setShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, color: "#2b5d15" }}>
          💾 Guardar Ruta ({points.length} puntos)
        </h2>

        {!generatedJSON ? (
          // Formulario
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong>Nombre de la ruta *</strong>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Ruta bodega norte"
                  style={{
                    padding: 8,
                    border: "2px solid #d9ead7",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                  autoFocus
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong>Descripción</strong>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe el propósito de esta ruta..."
                  rows={3}
                  style={{
                    padding: 8,
                    border: "2px solid #d9ead7",
                    borderRadius: 6,
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
              </label>

              <div>
                <strong style={{ display: "block", marginBottom: 8 }}>
                  Tipos de eventos (opcional)
                </strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["pickup", "delivery", "restock"].map((type) => (
                    <label
                      key={type}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={eventTypes.includes(type)}
                        onChange={() => toggleEventType(type)}
                      />
                      <span style={{ fontSize: 14 }}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <strong style={{ display: "block", marginBottom: 8 }}>
                  Turnos (opcional)
                </strong>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["noche", "turnoA", "turnoB"].map((shift) => (
                    <label
                      key={shift}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={shifts.includes(shift)}
                        onChange={() => toggleShift(shift)}
                      />
                      <span style={{ fontSize: 14 }}>{shift}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong>Prioridad (menor = mayor prioridad)</strong>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={0}
                  style={{
                    padding: 8,
                    border: "2px solid #d9ead7",
                    borderRadius: 6,
                    fontSize: 14,
                    width: 100,
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                marginTop: 24,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  border: "2px solid #ddd",
                  borderRadius: 8,
                  background: "white",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                className="run-btn"
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                }}
              >
                Generar JSON
              </button>
            </div>
          </>
        ) : (
          // Resultado
          <>
            <div
              style={{
                background: "#f5f5f5",
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
                position: "relative",
              }}
            >
              <pre
                style={{
                  fontSize: 12,
                  overflow: "auto",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {generatedJSON}
              </pre>
            </div>

            <div style={{ marginBottom: 16, padding: 12, background: "#fff3cd", borderRadius: 8 }}>
              <strong>📋 Instrucciones:</strong>
              <ol style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 14 }}>
                <li>Copia el JSON generado</li>
                <li>Abre el archivo <code>src/data/routes.json</code></li>
                <li>Agrégalo al array "routes"</li>
                <li>Guarda el archivo</li>
                <li>Recarga la aplicación</li>
              </ol>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={onClose}
                style={{
                  padding: "10px 20px",
                  border: "2px solid #ddd",
                  borderRadius: 8,
                  background: "white",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cerrar
              </button>
              <button
                onClick={handleCopy}
                className="run-btn"
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                }}
              >
                {copied ? "✓ Copiado!" : "📋 Copiar al portapapeles"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}