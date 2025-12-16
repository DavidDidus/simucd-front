import { useState } from 'react';
import type { Point } from '../types';

const LS_KEY = 'sim:route:v1';

export function useRoute(defaultRoute: Point[]) {
  const [route, setRoute] = useState<Point[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return defaultRoute;
  });

  const saveRoute = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(route)); } catch {} };
  const loadRoute = () => { try { const raw = localStorage.getItem(LS_KEY); if (raw) setRoute(JSON.parse(raw)); } catch {} };
  const clearRoute = () => setRoute([]);

  return { route, setRoute, saveRoute, loadRoute, clearRoute };
}
