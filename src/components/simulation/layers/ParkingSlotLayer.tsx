import React from 'react';
import { Layer, Circle, Text, Line } from 'react-konva';
import { PARKING_ZONES } from '../../../types/parkingSlot';

type Props = {
  stageWidth: number;
  stageHeight: number;
  showLabels?: boolean;
  showSlots?: boolean; // 🆕 Controla si mostrar todos los slots
};

export default function ParkingSlotsLayer({ stageWidth, stageHeight, showLabels = true, showSlots = true }: Props) {
  return (
    <Layer>
      {PARKING_ZONES.map(zone => (
        zone.slots.map(slot => {
          const x = slot.x * stageWidth;
          const y = slot.y * stageHeight;
          const isOccupied = slot.occupied;

          return (
            <React.Fragment key={slot.id}>
              {/* 🟢/🔴 Indicador de slot */}
              {showSlots && (
                <>
                  <Circle
                    x={x}
                    y={y}
                    radius={8}
                    fill={isOccupied ? 'red' : 'green'}
                    opacity={0.5}
                  />
                  
                  <Line
                    points={[
                      x,
                      y,
                      x + Math.cos((slot.rotation * Math.PI) / 180) * 30,
                      y + Math.sin((slot.rotation * Math.PI) / 180) * 30,
                    ]}
                    stroke={isOccupied ? 'red' : 'green'}
                    strokeWidth={2}
                    opacity={0.5}
                  />

                  {showLabels && (
                    <Text
                      x={x - 20}
                      y={y - 25}
                      text={slot.id}
                      fontSize={10}
                      fill="black"
                    />
                  )}
                </>
              )}
            </React.Fragment>
          );
        })
      ))}
    </Layer>
  );
}