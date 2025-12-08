import type { PredefinedRoute } from './routes';
import { PREDEFINED_ROUTES } from './routes';
import { findTransitionPath } from './pathfinding';
import type { Point } from '../../types';
import type { PredefinedObstacle } from '../../types/obstacles';
import type { SimTask } from '../../types/tasks';
import { createBaseTask } from '../../types/tasks';
import { parseHM } from '../time';

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

export const SLOT_TO_ROUTE_MAP: Record<string, string> = {
  'slot-1': 'route-parking-1-patio',
  'slot-2': 'route-parking-2-patio',
  'slot-3': 'route-parking-3-patio',
  'slot-4': 'route-parking-4-patio',
  'slot-5': 'route-parking-5-patio',
  'slot-6': 'route-parking-6-patio',
  'slot-7': 'route-parking-7-patio',
  'slot-8': 'route-parking-8-patio',
  'slot-9': 'route-parking-9-patio',
  'slot-10': 'route-parking-10-patio',
  'slot-11': 'route-parking-11-patio',
  'slot-12': 'route-parking-12-patio',
  'slot-13': 'route-parking-13-patio',
  'slot-14': 'route-parking-14-patio',
  'slot-15': 'route-parking-15-patio',
  'slot-16': 'route-parking-16-patio',
  'slot-17': 'route-parking-17-patio',
  'slot-18': 'route-parking-18-patio',
  'slot-19': 'route-parking-19-patio',
  'slot-20': 'route-parking-20-patio',
  'slot-21': 'route-parking-21-patio',
  'slot-22': 'route-parking-22-patio',
  'slot-23': 'route-parking-23-patio',
  'slot-24': 'route-parking-24-patio',
  'slot-25': 'route-parking-25-patio',
  'slot-26': 'route-parking-26-patio',
  'slot-27': 'route-parking-27-patio',
  'slot-28': 'route-parking-28-patio',
  'slot-29': 'route-parking-29-patio',
  'slot-30': 'route-parking-30-patio',
};

export const LOAD_TO_ROUTE_MAP: Record<string, string> = {
  'slot-load-1': 'route-patio-1-loading',
  'slot-load-2': 'route-patio-2-loading',
  'slot-load-3': 'route-patio-3-loading',
  'slot-load-4': 'route-patio-4-loading',
  'slot-load-5': 'route-patio-5-loading',
  'slot-load-6': 'route-patio-6-loading',
  'slot-load-7': 'route-patio-7-loading',
  'slot-load-8': 'route-patio-8-loading',
  'slot-load-9': 'route-patio-9-loading',
  'slot-load-10': 'route-patio-10-loading',
  'slot-load-11': 'route-patio-11-loading',
  'slot-load-12': 'route-patio-12-loading',
  'slot-load-13': 'route-patio-13-loading',
  'slot-load-14': 'route-patio-14-loading',
  'slot-load-15': 'route-patio-15-loading',
  'slot-load-16': 'route-patio-16-loading',
};

/**
 * Helper para obtener el routeId asociado a un parkingSlotId.
 * Devuelve undefined si no hay mapeo.
 */
export function getRouteIdForSlot(slotId: string): string | undefined {
  return SLOT_TO_ROUTE_MAP[slotId];
}

export function getRouteIdForLoadSlot(loadSlotId: string): string | undefined {
  return LOAD_TO_ROUTE_MAP[loadSlotId];
}

/**
 * Crea una SimTask de tipo "followRoute" para un camión estacionado en un slot.
 *
 * - truckId: id del actor (ej: "truck1-0")
 * - actorType: por ahora string (ej: "truck1"), luego lo tipamos con ActorType
 * - parkingSlotId: id del slot (ej: "slot-1")
 *
 * La tarea resultante:
 *  - type = "followRoute"
 *  - status = "pending"
 *  - priority = 1 (por defecto)
 *  - startAtSimTime = undefined (la decidirá el scheduler)
 *  - payload.routeId = ruta asignada al slot
 */
export function createFollowRouteTaskForTruck(
  truckId: string,
  actorType: string,
  parkingSlotId: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = getRouteIdForSlot(parkingSlotId);

  if (!routeId) {
    throw new Error(
      `[createFollowRouteTaskForTruck] No se encontró ruta para el slot "${parkingSlotId}". ` +
        `Revisa SLOT_TO_ROUTE_MAP.`
    );
  }

  const taskId = `followRoute:${truckId}:${parkingSlotId}:${Date.now()}`;

  return createBaseTask({
    id: taskId,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options?.priority ?? 1,
    startAtSimTime:
      options?.startAtSimTime !== undefined
        ? parseHM(options.startAtSimTime)
        : undefined,
    dependsOn: options?.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-load',        // 👈 LLEGA A ZONA DE CARGA
    },
  });
}

/**
 * 🆕 Tarea para mover camión desde su slot de carga (slot-load-X)
 * usando LOAD_TO_ROUTE_MAP.
 * El A* lo sigue manejando el engine igual que cuando va de parking→load.
 */
export function createFollowRouteTaskFromLoadSlot(
  truckId: string,
  actorType: string,
  loadSlotId: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  // 🔹 Usamos DIRECTO el mapa de slots de carga → ruta asociada al slot-load-X
  const routeId = getRouteIdForLoadSlot(loadSlotId);

  if (!routeId) {
    throw new Error(
      `[createFollowRouteTaskFromLoadSlot] No se encontró ruta para el slot de carga "${loadSlotId}". ` +
        `Revisa LOAD_TO_ROUTE_MAP.`
    );
  }

  const taskId = `followRouteFromLoad:${truckId}:${loadSlotId}:${Date.now()}`;

  return createBaseTask({
    id: taskId,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options?.priority ?? 1,
    startAtSimTime:
      options?.startAtSimTime !== undefined
        ? parseHM(options.startAtSimTime)
        : undefined,
    dependsOn: options?.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-parking', // 👈 esta tarea SIEMPRE termina estacionando en zona de parking
    },
  });
}



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



export function getActiveScheduledRoute(simTimeSec: number): { route: PredefinedRoute; schedule: ScheduledRoute } {
  const sortedSchedule = [...ROUTE_SCHEDULE].sort((a, b) => 
    parseHM(a.startTime) - parseHM(b.startTime)
  );

  let activeSchedule = sortedSchedule[0];
  
  for (const schedule of sortedSchedule) {
    const routeStartSec = parseHM(schedule.startTime);
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
  obstacles: PredefinedObstacle[] = [], // 🆕 Parámetro de obstáculos
): RouteTransition {
  console.log(`🎯 Creando transición desde ${currentRoute.name} hacia ${targetRoute.name}`);
  console.log(`🚧 Considerando ${obstacles.length} obstáculos`);
  console.log(`📍 Posición actual:`, currentPosition);
  console.log(`🎯 Objetivo (inicio de ruta):`, targetRoute.points[0]);
  
  const transitionPath = findTransitionPath(
    currentPosition,
    targetRoute.points,
    obstacles // 🆕 Pasar obstáculos
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

export function createExitRouteTaskForTruck(
  truckId: string,
  actorType: string,
  parkingSlotId: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = getRouteIdForSlot(parkingSlotId);

  if (!routeId) {
    throw new Error(
      `[createExitRouteTaskForTruck] No se encontró ruta para el slot "${parkingSlotId}". ` +
        `Revisa SLOT_TO_ROUTE_MAP.`
    );
  }

  const taskId = `followRouteExit:${truckId}:${parkingSlotId}:${Date.now()}`;

  return createBaseTask({
    id: taskId,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options?.priority ?? 1,
    startAtSimTime:
      options?.startAtSimTime !== undefined
        ? parseHM(options.startAtSimTime)
        : undefined,
    dependsOn: options?.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-exit',   // 👈 NUEVA “zona virtual” de salida
    },
  });
}
