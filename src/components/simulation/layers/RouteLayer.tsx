// src/components/simulation/layers/RouteLayer.tsx
import { Layer, Line, Group, Circle, Text } from 'react-konva';
import type { Point } from '../../../types';
import { toPx, toNorm } from '../../../utils/path';

type Props = {
  w: number;
  h: number;
  route: Point[];
  editing: boolean;
  canEdit: boolean;
  setRoute: (updater: any) => void;
};

export default function RouteLayer({ w, h, route, editing, canEdit, setRoute }: Props) {
  if (!(canEdit && editing)) return null;

  return (
    <Layer>
      {route.length >= 2 && (
        <Line
          points={route.flatMap((p) => [p.x * w, p.y * h])}
          stroke="#00b7ff"
          opacity={0.5}
          strokeWidth={6}
          lineJoin="round"
          lineCap="round"
        />
      )}
      {route.map((p, i) => {
        const pt = toPx(p, w, h);
        return (
          <Group key={i}>
            <Circle
              x={pt.x}
              y={pt.y}
              radius={8}
              fill="#00b7ff"
              stroke="#00131a"
              strokeWidth={2}
              draggable
              onDragMove={(e) => {
                const nx = e.target.x();
                const ny = e.target.y();
                setRoute((r: Point[]) => {
                  const copy = r.slice();
                  copy[i] = toNorm(nx, ny, w, h);
                  return copy;
                });
              }}
              onMouseDown={(e) => (e.cancelBubble = true)}
            />
            <Text x={pt.x + 10} y={pt.y - 8} text={`${i + 1}`} fontSize={12} fill="#fff" opacity={0.8} />
          </Group>
        );
      })}
    </Layer>
  );
}
