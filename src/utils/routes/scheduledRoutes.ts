import type { PredefinedRoute } from './routes';
import { PREDEFINED_ROUTES } from './routes';
import { findTransitionPath } from './pathfinding';
import type { Point } from '../../types';

export type ScheduledRoute = {
  routeId: string;
  startTime: string;
};

export type RouteTransition = {
  isTransitioning: boolean;
  transitionPath: Point[];
  fromRoute: PredefinedRoute | null;
  toRoute: PredefinedRoute;
  progress: number; // 0 a 1
  targetReached: boolean;
};

export const ROUTE_SCHEDULE: ScheduledRoute[] = [
  {
    routeId: PREDEFINED_ROUTES[0]?.id || 'fallback',
    startTime: "00:00"
  },
  {
    routeId: PREDEFINED_ROUTES[1]?.id || 'fallback',
    startTime: "00:02"
  },
  {
    routeId: PREDEFINED_ROUTES[2]?.id || 'fallback',
    startTime: "12:00"
  }
];

export function timeToSeconds(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 3600 + minutes * 60;
}

export function getActiveScheduledRoute(simTimeSec: number): { route: PredefinedRoute; schedule: ScheduledRoute } {
  const sortedSchedule = [...ROUTE_SCHEDULE].sort((a, b) => 
    timeToSeconds(a.startTime) - timeToSeconds(b.startTime)
  );

  let activeSchedule = sortedSchedule[0];
  
  for (const schedule of sortedSchedule) {
    const routeStartSec = timeToSeconds(schedule.startTime);
    if (simTimeSec >= routeStartSec) {
      activeSchedule = schedule;
    }
  }

  const route = PREDEFINED_ROUTES.find(r => r.id === activeSchedule.routeId) || PREDEFINED_ROUTES[0];

  return { route, schedule: activeSchedule };
}

// 🆕 Función actualizada para crear transición hacia el inicio de la ruta
export function createRouteTransition(
  currentPosition: Point,
  currentRoute: PredefinedRoute,
  targetRoute: PredefinedRoute,
  useCurvedPath: boolean = true
): RouteTransition {
  console.log(`🎯 Creando transición desde ${currentRoute.name} hacia el INICIO de ${targetRoute.name}`);
  console.log(`📍 Posición actual:`, currentPosition);
  console.log(`🎯 Objetivo (inicio de ruta):`, targetRoute.points[0]);
  
  const transitionPath = findTransitionPath(
    currentPosition,
    targetRoute.points,
    useCurvedPath
  );

  return {
    isTransitioning: true,
    transitionPath,
    fromRoute: currentRoute,
    toRoute: targetRoute,
    progress: 0,
    targetReached: false
  };
}

export function getScheduleWithRouteDetails(): Array<{ schedule: ScheduledRoute; route: PredefinedRoute }> {
  return ROUTE_SCHEDULE.map(schedule => {
    const route = PREDEFINED_ROUTES.find(r => r.id === schedule.routeId) || PREDEFINED_ROUTES[0];
    return { schedule, route };
  });
}