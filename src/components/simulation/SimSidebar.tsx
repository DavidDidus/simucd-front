import React, { useState } from 'react';
import type { ShiftResources, Shift } from '../../types';
import { PREDEFINED_ROUTES, type PredefinedRoute } from '../../utils/routes/routes';

export interface SimSidebarProps {
  simTimeSec: number;
  speedMult: number;
  onSpeedChange: (next: number) => void;
  resources: ShiftResources;
  currentShift: Shift;
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function SimSidebar({
  simTimeSec,
  speedMult,
  onSpeedChange,
  resources,
  currentShift,
  selectedRouteId,
  onRouteSelect,
  min = 1,
  max = 100,
  step = 1,
  className,
  style,
}: SimSidebarProps) {
  const [showRoutes, setShowRoutes] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSpeedChange(Number(e.target.value));
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getShiftLabel = (shift: Shift) => {
    const labels = {
      noche: 'Noche',
      turnoA: 'Turno A',
      turnoB: 'Turno B',
    };
    return labels[shift];
  };

  return (
    <aside
      className={className}
      style={{
        position: 'relative',
        top: 8,
        padding: 12,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...style,
      }}
    >
      {/* Información del reloj */}
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#2b5d15' }}>
          🕐 Reloj de Simulación
        </h3>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#1f2937' }}>
          {formatTime(simTimeSec)}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          {getShiftLabel(currentShift)}
        </div>
      </div>

      {/* Control de velocidad */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#2b5d15' }}>
          Velocidad de Simulación
        </h4>
        <label htmlFor="speedRange" style={{ display: 'block', fontWeight: 600, fontSize: 18 }}>
          x{speedMult}
        </label>

        <input
          id="speedRange"
          type="range"
          min={min}
          max={max}
          step={step}
          value={speedMult}
          onChange={handleChange}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={speedMult}
          aria-label="Velocidad de simulación"
          style={{ width: '100%', marginTop: 8 }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          <span>x{min}</span>
          <span>x{max}</span>
        </div>
      </div>
      {/* Info adicional */}
      <div style={{ 
        fontSize: 11, 
        color: '#9ca3af', 
        paddingTop: 12,
        borderTop: '1px solid #e5e7eb',
      }}>
        <div style={{ marginTop: 4 }}>
          Progreso: {((simTimeSec / (24 * 3600)) * 100).toFixed(1)}%
        </div>
      </div>
    </aside>
  );
}