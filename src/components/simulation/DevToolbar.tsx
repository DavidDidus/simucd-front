// src/components/simulation/DevToolbar.tsx
import type { ShiftResources } from '../../types';
import { CAN_EDIT } from '../../utils/env';

type EditMode = 'route' | 'obstacle';
type Props = {
  editing: boolean;
  setEditing: (v: any) => void;
  saveRoute: () => void;
  clearRoute: () => void;
  loadRoute: () => void;
  resources: ShiftResources;
  setResources: (updater: (r: ShiftResources) => ShiftResources) => void;
  resetClock: () => void;
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  saveObstacle: () => void;
  clearObstacle: () => void;
};

export default function DevToolbar({
  editing,
  setEditing,
  saveRoute,
  clearRoute,
  loadRoute,
  resources,
  setResources,
  resetClock,
  editMode,
  onEditModeChange,
  saveObstacle,
  clearObstacle,
}: Props) {
  if (!CAN_EDIT) return null;
  const clampInt = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
      <button onClick={() => setEditing((e: boolean) => !e)}>{editing ? 'Terminar edición' : 'Editar ruta'}</button>
      <button onClick={saveRoute} disabled={!editing}>Guardar</button>
      <button onClick={clearRoute} disabled={!editing}>Limpiar</button>
      <button onClick={loadRoute}>Cargar</button>
      <button onClick={resetClock}>Reiniciar reloj</button>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 12 }}>
        <small style={{ opacity: 0.7 }}>Recursos:</small>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <small>Noche</small>
          <input
            type="number"
            min={0}
            step={1}
            value={resources.noche}
            onChange={(e) => setResources((r) => ({ ...r, noche: clampInt(+e.target.value) }))}
            style={{ width: 64 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <small>A</small>
          <input
            type="number"
            min={0}
            step={1}
            value={resources.turnoA}
            onChange={(e) => setResources((r) => ({ ...r, turnoA: clampInt(+e.target.value) }))}
            style={{ width: 64 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <small>B</small>
          <input
            type="number"
            min={0}
            step={1}
            value={resources.turnoB}
            onChange={(e) => setResources((r) => ({ ...r, turnoB: clampInt(+e.target.value) }))}
            style={{ width: 64 }}
          />
        </label>
        {/* 🆕 Selector de modo de edición */}
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <label>Modo:</label>
        <select
          value={editMode}
          onChange={(e) => onEditModeChange(e.target.value as EditMode)}
          disabled={editing}
          style={{ padding: '4px' }}
        >
          <option value="route">Rutas</option>
          <option value="obstacle">Obstáculos</option>
        </select>
      </div>

      {/* Botones actualizados según el modo */}
      <button
        onClick={() => setEditing(!editing)}
        style={{
          padding: '8px 12px',
          backgroundColor: editing ? '#dc3545' : '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {editing 
          ? `Terminar edición ${editMode === 'route' ? 'ruta' : 'obstáculo'}` 
          : `Definir ${editMode === 'route' ? 'ruta' : 'obstáculo'}`
        }
      </button>

      {editing && (
        <>
          <button
            onClick={editMode === 'route' ? saveRoute : saveObstacle}
            style={{ /* existing styles */ }}
          >
            Guardar {editMode === 'route' ? 'Ruta' : 'Obstáculo'}
          </button>
          
          <button
            onClick={editMode === 'route' ? clearRoute : clearObstacle}
            style={{ /* existing styles */ }}
          >
            Limpiar {editMode === 'route' ? 'Ruta' : 'Obstáculo'}
          </button>
        </>
      )}

      </div>
    </div>
  );
}
