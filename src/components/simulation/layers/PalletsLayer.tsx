import React from 'react';
import { Layer, Image as KonvaImage, Group, Circle, Text } from 'react-konva';
import type { RuntimePallet } from '../../../types/pallets';
import pallet from '../../../assets/Simulacion/Pallet_completo.png';

type Props = {
  stageWidth: number;
  stageHeight: number;
  pallets: RuntimePallet[];
};

const PALLET_PIXEL_WIDTH = 10;
const PALLET_PIXEL_HEIGHT = 10;

export const PalletsLayer: React.FC<Props> = ({
  stageWidth,
  stageHeight,
  pallets,
}) => {
  const palletImg = React.useMemo(() => {
    const img = new window.Image();
    img.src = pallet;
    return img;
  }, []);

  return (
    <Layer>
      {pallets.map((p) => {
        const xNorm = p.xNorm ?? 0;
        const yNorm = p.yNorm ?? 0;

        // Top-left del pallet (como ya lo tenías)
        const x = xNorm * stageWidth - PALLET_PIXEL_WIDTH / 2;
        const y = yNorm * stageHeight - PALLET_PIXEL_HEIGHT / 2;

        // Centro del pallet dentro del Group
        const cx = PALLET_PIXEL_WIDTH / 2;
        const cy = PALLET_PIXEL_HEIGHT / 2;

        return (
          <Group key={p.id} x={x} y={y}>
            {/* 🔸 Halo de chequeo mientras el pallet está siendo chequeado */}
            {p.isBeingChecked && (
              <Circle
                x={cx}
                y={cy}
                radius={PALLET_PIXEL_WIDTH * 0.9}
                fill="rgba(255, 215, 0, 0.25)"      // amarillo suave
                stroke="rgba(255, 215, 0, 0.9)"
                strokeWidth={1}
              />
            )}

            {/* Icono del pallet */}
            <KonvaImage
              width={PALLET_PIXEL_WIDTH}
              height={PALLET_PIXEL_HEIGHT}
              image={palletImg}
            />

            {/* ✅ Check verde cuando el pallet ya fue chequeado y no está en proceso */}
            {p.isCheckedOk && !p.isBeingChecked && (
              <Text
                text="✔"
                x={PALLET_PIXEL_WIDTH * 0.4}
                y={-PALLET_PIXEL_HEIGHT * 0.6}
                fontSize={PALLET_PIXEL_WIDTH} // pequeño pero visible
                fill="green"
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
};
