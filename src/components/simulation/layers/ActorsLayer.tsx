import { Layer, Image as KonvaImage } from 'react-konva';
import type { PathPx } from '../../../utils/path';
import { poseAlongPath } from '../../../utils/path';
import type { ActorState } from '../../../types/actors';

type Props = {
  actor: ActorState
  path: PathPx;
  cursor: number;
  scale: number;
  editing: boolean;
  stageWidth: number;
  stageHeight: number;
};

export default function ActorsLayer({ 
  actor, 
  path, 
  cursor, 
  scale, 
  editing,
  stageWidth,
  stageHeight 
}: Props) {
  if (editing) return null;
  if (!actor.image) return null;

  const img = actor.image;
  const scaleX = (actor.size.width / img.width) * scale;
  const scaleY = (actor.size.height / img.height) * scale;

  return (
    <Layer>
      {/* 🆕 Renderizar actor estacionado */}
      {actor.behavior === 'stationary' && actor.parkingPosition ? (
        <KonvaImage
          image={img}
          x={actor.parkingPosition.x * stageWidth}
          y={actor.parkingPosition.y * stageHeight}
          offsetX={img.width / 2}
          offsetY={img.height / 2}
          scaleX={scaleX}
          scaleY={scaleY}
          rotation={actor.parkingPosition.rotation || 0}
          listening={false}
          opacity={0.85}
        />
      ) : null}

      {/* 🆕 Renderizar actor móvil */}
      {actor.behavior === 'mobile' && path.total > 0 ? (
        (() => {
          const pose = poseAlongPath(path, cursor % path.total);
          return (
            <KonvaImage
              image={img}
              x={pose.x}
              y={pose.y}
              offsetX={img.width / 2}
              offsetY={img.height / 2}
              scaleX={scaleX}
              scaleY={scaleY}
              rotation={pose.rot}
              listening={false}
            />
          );
        })()
      ) : null}
    </Layer>
  );
}