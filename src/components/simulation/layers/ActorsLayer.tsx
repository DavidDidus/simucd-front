// src/components/simulation/layers/ActorsLayer.tsx
import { Layer, Image as KonvaImage } from 'react-konva';
import type { PathPx } from '../../../utils/path';
import { poseAlongPath } from '../../../utils/path';

type Props = {
  count: number;
  path: PathPx;
  cursor: number;
  forkliftImg: HTMLImageElement | null;
  scale: number;
  editing: boolean;
};

export default function ActorsLayer({ count, path, cursor, forkliftImg, scale, editing }: Props) {
  if (!forkliftImg || editing || count <= 0 || path.total <= 0) return null;

  const spacing = path.total / Math.max(1, count);

  return (
    <Layer>
      {Array.from({ length: count }).map((_, i) => {
        const pose = poseAlongPath(path, cursor + spacing * i);
        return (
          <KonvaImage
            key={i}
            image={forkliftImg}
            x={pose.x}
            y={pose.y}
            offsetX={forkliftImg.width / 2}
            offsetY={forkliftImg.height / 2}
            scaleX={scale}
            scaleY={scale}
            rotation={pose.rot}
            listening={false}
          />
        );
      })}
    </Layer>
  );
}
