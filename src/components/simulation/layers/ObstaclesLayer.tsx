import React from 'react';
import { Layer, Line, Circle, Text } from 'react-konva';
import type { Point } from '../../../types';
import type { PredefinedObstacle } from '../../../types/obstacles';

type Props = {
  w: number;
  h: number;
  obstacles: PredefinedObstacle[];
  editingObstacle?: Point[];
  editing: boolean;
  canEdit: boolean;
  setObstacle?: (obstacle: Point[] | ((prev: Point[]) => Point[])) => void;
  showObstacles?: boolean; // 🆕 Para controlar visibilidad
};

export default function ObstaclesLayer({ 
  w, 
  h, 
  obstacles, 
  editingObstacle = [], 
  editing, 
  canEdit, 
  setObstacle,
  showObstacles = false // 🆕 Por defecto invisible
}: Props) {

  // 🆕 Solo renderizar obstáculos predefinidos si showObstacles es true
  const renderPredefinedObstacles = () => {
    if (!showObstacles) return null;
    
    return obstacles.map((obstacle) => {
      if (obstacle.points.length < 3) return null;

      const points = obstacle.points.flatMap(p => [p.x * w, p.y * h]);
      
      return (
        <React.Fragment key={obstacle.id}>
          {/* Área del obstáculo con muy baja opacidad */}
          <Line
            points={points}
            fill={obstacle.color || '#FF6B6B'}
            fillOpacity={0.1} // 🆕 Muy sutil
            stroke={obstacle.color || '#FF6B6B'}
            strokeWidth={1}
            strokeOpacity={0.3} // 🆕 Borde muy sutil
            closed={true}
            listening={false}
            dash={[2, 2]} // 🆕 Línea punteada para indicar que es invisible
          />
          
          {/* Nombre del obstáculo solo durante edición */}
          {editing && obstacle.points.length > 0 && (
            <Text
              x={obstacle.points[0].x * w}
              y={obstacle.points[0].y * h - 20}
              text={`${obstacle.name} (invisible)`}
              fontSize={10}
              fill="#666"
              opacity={0.7}
              listening={false}
            />
          )}
        </React.Fragment>
      );
    });
  };

  // Renderizar obstáculo en edición (siempre visible durante edición)
  const renderEditingObstacle = () => {
    if (!editing || editingObstacle.length === 0) return null;

    return (
      <React.Fragment>
        {/* Puntos del obstáculo en edición */}
        {editingObstacle.map((point, i) => (
          <Circle
            key={i}
            x={point.x * w}
            y={point.y * h}
            radius={6}
            fill="#FF6B6B"
            stroke="#FFFFFF"
            strokeWidth={2}
            listening={canEdit}
            draggable={canEdit}
            onDragMove={(e) => {
              if (setObstacle) {
                const newX = e.target.x() / w;
                const newY = e.target.y() / h;
                setObstacle(prev => {
                  const updated = [...prev];
                  updated[i] = { x: newX, y: newY };
                  return updated;
                });
              }
            }}
          />
        ))}

        {/* Líneas conectando los puntos */}
        {editingObstacle.length > 1 && (
          <Line
            points={editingObstacle.flatMap(p => [p.x * w, p.y * h])}
            stroke="#FF6B6B"
            strokeWidth={3}
            dash={[5, 5]}
            listening={false}
          />
        )}

        {/* Cerrar el polígono si hay más de 2 puntos */}
        {editingObstacle.length > 2 && (
          <Line
            points={[
              editingObstacle[editingObstacle.length - 1].x * w,
              editingObstacle[editingObstacle.length - 1].y * h,
              editingObstacle[0].x * w,
              editingObstacle[0].y * h
            ]}
            stroke="#FF6B6B"
            strokeWidth={3}
            dash={[5, 5]}
            listening={false}
          />
        )}

        {/* Área sombreada si hay suficientes puntos */}
        {editingObstacle.length >= 3 && (
          <Line
            points={editingObstacle.flatMap(p => [p.x * w, p.y * h])}
            fill="#FF6B6B"
            fillOpacity={0.2}
            closed={true}
            listening={false}
          />
        )}

        {/* Texto indicativo */}
        <Text
          x={10}
          y={h - 30}
          text="Obstáculo en edición - Será invisible en simulación"
          fontSize={12}
          fill="#FF6B6B"
          listening={false}
        />
      </React.Fragment>
    );
  };

  return (
    <Layer>
      {renderPredefinedObstacles()}
      {renderEditingObstacle()}
    </Layer>
  );
}