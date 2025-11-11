import { useEffect, useState } from 'react';

export function useHTMLImage(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.src = src;
    const onload = () => setImg(i);
    const onerr = () => setImg(null);
    i.addEventListener('load', onload);
    i.addEventListener('error', onerr);
    return () => {
      i.removeEventListener('load', onload);
      i.removeEventListener('error', onerr);
    };
  }, [src]);
  return img;
}
