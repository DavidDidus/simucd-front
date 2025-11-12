import { Layer, Image as KonvaImage } from 'react-konva';
import type { PathPx } from '../../../utils/path';
import { poseAlongPath } from '../../../utils/path';
import type { ActorConfig } from '../../../types/actors';

type Props = {
  actors: ActorConfig[];
  path: PathPx;
  cursor: number;
  scale: number;
  editing: boolean;
};

export default function ActorsLayer({ actors, path, cursor, scale, editing }: Props) {
  if (editing || path.total <= 0) return null;

  return (
    <Layer>
      {actors.map((actor) => {
        if (actor.count <= 0) return null;
        
        const img = actor.image;
        if (!img) return null;
        
        const spacing = path.total / Math.max(1, actor.count);
        
        return Array.from({ length: actor.count }).map((_, i) => {
          const actorCursor = cursor * actor.speed; // 👈 Aplicar velocidad al cursor
          const offset = spacing * i;              // 👈 Separación simple entre actores
          const pose = poseAlongPath(path, (actorCursor + offset) % path.total);
          
          // 🆕 Calcular escala basada en el tamaño definido vs tamaño real de la imagen
          const scaleX = (actor.size.width / img.width) * scale;
          const scaleY = (actor.size.height / img.height) * scale;
          
          return (
            <KonvaImage
              key={`${actor.id}-${i}`}
              image={img}
              x={pose.x}
              y={pose.y}
              offsetX={img.width / 2}
              offsetY={img.height / 2}
              scaleX={scaleX} // 👈 Usando escala calculada
              scaleY={scaleY} // 👈 Usando escala calculada
              rotation={pose.rot}
              listening={false}
            />
          );
        });
      })}
    </Layer>
  );
}