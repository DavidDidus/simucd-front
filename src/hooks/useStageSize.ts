import { useEffect, useMemo, useState } from 'react';

export function useStageSize(
  container: React.RefObject<HTMLDivElement | null>,
  bgWidth?: number,
  bgHeight?: number
) {
  const [containerW, setContainerW] = useState(960);

  useEffect(() => {
    const el = container.current;
    const measure = () => el && setContainerW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [container]);

  const stageDims = useMemo(() => {
    if (!bgWidth || !bgHeight) {
      const h = Math.round(containerW * 0.55);
      return { w: containerW, h, scale: 1 };
    }
    const scale = containerW / bgWidth;
    return { w: Math.round(bgWidth * scale), h: Math.round(bgHeight * scale), scale };
  }, [bgWidth, bgHeight, containerW]);

  return stageDims;
}
