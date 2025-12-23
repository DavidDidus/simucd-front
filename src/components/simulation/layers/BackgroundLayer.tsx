import { Layer, Rect, Image as KonvaImage } from 'react-konva';

type Props = { w: number; h: number; bgImg: HTMLImageElement | null; scale: number };

export default function BackgroundLayer({ w, h, bgImg, scale }: Props) {
  return (
    <Layer listening={false}>
      <Rect width={w} height={h} fill="#111" />
      {bgImg && <KonvaImage image={bgImg} x={0} y={0} scaleX={scale} scaleY={scale} listening={false} />}
    </Layer>
  );
}
