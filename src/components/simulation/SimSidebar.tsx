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
  max = 30,
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

      {/* Recursos activos */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#2b5d15' }}>
          🚛 Recursos Activos
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Noche:</span>
            <strong>{resources.noche}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Turno A:</span>
            <strong>{resources.turnoA}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Turno B:</span>
            <strong>{resources.turnoB}</strong>
          </div>
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: 13,
              paddingTop: 6,
              borderTop: '1px solid #e5e7eb',
              fontWeight: 600,
              color: '#2b5d15',
            }}
          >
            <span>Actualmente:</span>
            <span>{resources[currentShift]}</span>
          </div>
        </div>
      </div>

      {/* Control de velocidad */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#2b5d15' }}>
          ⚡ Velocidad de Simulación
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

      {/* Visor de rutas */}
      <div>
        <button
          onClick={() => setShowRoutes(!showRoutes)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: '#e8f1eb',
            border: '2px solid #d9ead7',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: '#2b5d15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>📍 Rutas Guardadas ({PREDEFINED_ROUTES.length})</span>
          <span style={{ fontSize: 12 }}>{showRoutes ? '▲' : '▼'}</span>
        </button>

        {showRoutes && (
          <div
            style={{
              marginTop: 8,
              maxHeight: 300,
              overflowY: 'auto',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              background: '#fafafa',
            }}
          >
            {PREDEFINED_ROUTES.map((route) => (
              <div
                key={route.id}
                style={{
                  padding: 10,
                  borderBottom: '1px solid #e5e7eb',
                  cursor: onRouteSelect ? 'pointer' : 'default',
                  background: selectedRouteId === route.id ? '#e8f1eb' : 'transparent',
                  transition: 'background 0.2s',
                }}
                onClick={() => onRouteSelect?.(route.id)}
                onMouseEnter={(e) => {
                  if (onRouteSelect) {
                    e.currentTarget.style.background = '#f3f4f6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (onRouteSelect && selectedRouteId !== route.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1f2937', marginBottom: 4 }}>
                  {route.name}
                  {selectedRouteId === route.id && (
                    <span style={{ color: '#4a9d2d', marginLeft: 6 }}>✓</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
                  {route.description}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
                  <span style={{ 
                    background: '#dbeafe', 
                    color: '#1e40af',
                    padding: '2px 6px', 
                    borderRadius: 4 
                  }}>
                    {route.points.length} puntos
                  </span>
                  {route.priority !== undefined && (
                    <span style={{ 
                      background: '#fef3c7', 
                      color: '#92400e',
                      padding: '2px 6px', 
                      borderRadius: 4 
                    }}>
                      Prioridad: {route.priority}
                    </span>
                  )}
                </div>
                {(route.eventTypes || route.shifts) && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#6b7280' }}>
                    {route.eventTypes && (
                      <div>📦 {route.eventTypes.join(', ')}</div>
                    )}
                    {route.shifts && (
                      <div>🕐 {route.shifts.join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info adicional */}
      <div style={{ 
        fontSize: 11, 
        color: '#9ca3af', 
        paddingTop: 12,
        borderTop: '1px solid #e5e7eb',
      }}>
        <div>Total recursos: {resources.noche + resources.turnoA + resources.turnoB}</div>
        <div style={{ marginTop: 4 }}>
          Progreso: {((simTimeSec / (24 * 3600)) * 100).toFixed(1)}%
        </div>
      </div>
    </aside>
  );
}