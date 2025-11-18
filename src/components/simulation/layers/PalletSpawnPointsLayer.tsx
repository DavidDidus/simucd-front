import React from 'react';
import { Layer, Image as KonvaImage, Text, Group } from 'react-konva';
import { PALLET_SPAWN_POINTS } from '../../../types/pallets';
import pallet from '../../../assets/Simulacion/Pallet_completo.png';

type Props = {
  stageWidth: number;
  stageHeight: number;
  showLabels?: boolean;
  showEmptySlots?: boolean; // 🆕 Controla si mostrar slots vacíos
};

export default function PalletSpawnPointsLayer({ 
  stageWidth, 
  stageHeight, 
  showLabels = true,
  showEmptySlots = false // Por defecto solo mostrar slots con pallets
}: Props) {
  // 🆕 Cargar imagen de pallet como HTMLImageElement para cumplir el tipo de konva
  const palletImg = React.useMemo(() => {
    const img = new window.Image();
    img.src = pallet;
    return img;
  }, [pallet]);

  return (
    <Layer>
      {PALLET_SPAWN_POINTS.map(zone => (
        zone.slots.map(slot => {
          const cantPallets = slot.cant_pallets || 0;
          
          // 🔑 Si no hay pallets y no se deben mostrar slots vacíos, skip
          if (cantPallets === 0 && !showEmptySlots) {
            return null;
          }

          const x = slot.x * stageWidth;
          const y = slot.y * stageHeight;
          
          // Tamaño del pallet (ajusta según tu necesidad)
          const palletWidth = 10;
          const palletHeight = 10;

          return (
            <Group key={slot.id}>
              {cantPallets > 0 && palletImg && (
                <KonvaImage
                  image={palletImg}
                  x={x}
                  y={y}
                  width={palletWidth}
                  height={palletHeight}
                  offsetX={palletWidth / 2}
                  offsetY={palletHeight / 2}
                  listening={false}
                  opacity={1}
                />
              )}
              {showLabels && showEmptySlots && (
                <Text
                  x={x}
                  y={y - palletHeight / 2 - 15}
                  text={`${slot.id}\n${zone.name}`}
                  fontSize={9}
                  fill={cantPallets > 0 ? '#333' : '#999'}
                  align="center"
                  offsetX={25}
                  listening={false}
                />
              )}

              {cantPallets === 0 && showEmptySlots && (
                <KonvaImage
                  image={palletImg}
                  x={x}
                  y={y}
                  width={palletWidth}
                  height={palletHeight}
                  offsetX={palletWidth / 2}
                  offsetY={palletHeight / 2}
                  listening={false}
                  opacity={1} // Muy transparente para indicar vacío
                />
              )}
            </Group>
          );
        })
      ))}
    </Layer>
  );
}