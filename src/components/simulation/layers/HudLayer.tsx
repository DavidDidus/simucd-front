import { Layer, Group, Text } from 'react-konva';
import type { ShiftResources } from '../../../types';

type Props = {
  w: number;
  clock: string;
  shiftLabel: string;
  resources: ShiftResources;
  activeCount: number;
};

export default function HudLayer({ w, clock }: Props) {
  return (
    <Layer listening={false}>
      <Group x={0} y={8}>
        <Text
          x={0}
          y={0}
          width={w - 12}
          align="right"
          text={`🕒 ${clock}`}
          fontSize={18}
          fill="#fff"
          shadowColor="#000"
          shadowBlur={6}
          shadowOpacity={0.6}
        />
      </Group>
    </Layer>
  );
}
