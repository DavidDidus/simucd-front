import type { Point } from '../types';

export type PathPx = {
  pts: { x: number; y: number }[];
  segs: { len: number; dx: number; dy: number }[];
  total: number;
};

export const toPx = (p: Point, w: number, h: number) => ({ x: p.x * w, y: p.y * h });
export const toNorm = (x: number, y: number, w: number, h: number): Point => ({
  x: Math.min(1, Math.max(0, x / w)),
  y: Math.min(1, Math.max(0, y / h)),
});

export function buildPathPx(route: Point[], w: number, h: number): PathPx {
  const pts = route.map((p) => toPx(p, w, h));
  const segs: PathPx['segs'] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy);
    segs.push({ len, dx, dy });
    total += len;
  }
  return { pts, segs, total };
}

export function poseAlongPath(path: PathPx, distance: number) {
  const L = path.total;
  if (L <= 0) return { x: 0, y: 0, rot: 0 };

  const period = 2 * L;
  let d = distance % period;
  if (d < 0) d += period;
  if (d > L) d = period - d;

  const { pts, segs } = path;
  let acc = 0, idx = 0;
  while (idx < segs.length && acc + segs[idx].len < d) {
    acc += segs[idx].len;
    idx++;
  }
  if (idx >= segs.length) idx = segs.length - 1;

  const seg = segs[idx];
  const p0 = pts[idx];
  const t = seg.len ? (d - acc) / seg.len : 0;
  const x = p0.x + seg.dx * t;
  const y = p0.y + seg.dy * t;
  const rad = Math.atan2(seg.dy, seg.dx);
  const rot = (rad * 180) / Math.PI + 90;
  return { x, y, rot };
}
