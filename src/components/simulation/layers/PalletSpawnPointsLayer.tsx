import React from 'react';
import { Layer, Image as KonvaImage, Text, Group } from 'react-konva';
import { PALLET_SPAWN_POINTS } from '../../../types/pallets';
import pallet from '../../../assets/Simulacion/Pallet_completo.png';

type Props = {
  stageWidth: number;
  stageHeight: number;
  showLabels?: boolean;
  showEmptySlots?: boolean; // 🆕 Controla si mostrar slots vacíos
  palletsCountsBySlot?: Record<string, number>; // 🆕 Mapa slotId -> cantidad de pallets
};

export default function PalletSpawnPointsLayer({ 
  stageWidth, 
  stageHeight, 
  showLabels = true,
  showEmptySlots = false, // Por defecto solo mostrar slots con pallets
  palletsCountsBySlot
}: Props) {
  // 🆕 Cargar imagen de pallet como HTMLImageElement para cumplir el tipo de konva
  const palletImg = React.useMemo(() => {
    const img = new window.Image();
    img.src = pallet;
    return img;
  }, [pallet]);

  const palletWidth = 10;
  const palletHeight = 10;

  return (
    <Layer>
      {PALLET_SPAWN_POINTS.map(zone =>
        zone.slots.map(slot => {
          // 🔹 Cantidad dinámica (state) o fallback a cant_pallets estático
          const countFromState = palletsCountsBySlot?.[slot.id];
          const palletCount =
            typeof countFromState === 'number'
              ? countFromState
              : slot.cant_pallets ?? 0;

          const hasPallets = palletCount > 0;

          if (!hasPallets && !showEmptySlots) {
            return null;
          }

          const baseX = slot.x * stageWidth;
          const baseY = slot.y * stageHeight;

          return (
            <Group key={slot.id}>
              {/* Dibujamos N pallets en este slot */}
              {Array.from({ length: palletCount }).map((_, i) => (
                <KonvaImage
                  key={`${slot.id}-pallet-${i}`}
                  image={palletImg}
                  x={baseX}       // pequeño offset para que se vean separados
                  y={baseY}
                  width={palletWidth}
                  height={palletHeight}
                  offsetX={palletWidth / 2}
                  offsetY={palletHeight / 2}
                  listening={false}
                  opacity={1}
                />
              ))}

              {/* Slots vacíos opcionales */}
              {!hasPallets && showEmptySlots && (
                <KonvaImage
                  image={palletImg}
                  x={baseX}
                  y={baseY}
                  width={palletWidth}
                  height={palletHeight}
                  offsetX={palletWidth / 2}
                  offsetY={palletHeight / 2}
                  listening={false}
                  opacity={0.15}
                />
              )}

              {showLabels && (
                <Text
                  x={baseX}
                  y={baseY - palletHeight / 2 - 15}
                  text={`${slot.id}\n${zone.name}`}
                  fontSize={9}
                  fill="#333"
                  align="center"
                  offsetX={25}
                  listening={false}
                />
              )}
            </Group>
          );
        })
      )}
    </Layer>
  );
}