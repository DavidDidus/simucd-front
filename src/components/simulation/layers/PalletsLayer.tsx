import React from 'react';
import { Layer, Image as KonvaImage, Group } from 'react-konva';
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

        const x = xNorm * stageWidth - PALLET_PIXEL_WIDTH / 2;
        const y = yNorm * stageHeight - PALLET_PIXEL_HEIGHT / 2;

        return (
          <Group key={p.id} x={x} y={y}>
            <KonvaImage
              width={PALLET_PIXEL_WIDTH}
              height={PALLET_PIXEL_HEIGHT}
              image={palletImg}
            />
           
          </Group>
        );
      })}
    </Layer>
  );
};
