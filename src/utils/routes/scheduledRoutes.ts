import type { PredefinedRoute } from './routes';
import { PARKING_ZONES } from '../../types/parkingSlot';
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

export const DISTRIBUTION_ROUTE_MAP: Record<string, string> = {
  'slot-distribution-1': 'route-distribution-truck',
  'slot-distribution-2': 'route-distribution-truck', // o la ruta específica si tienes otra
};

function findNearestLoadRouteFromSlot(
  slotId: string
): { loadSlotId: string; routeId: string } | undefined {
  // Buscamos el slot de origen (puede ser slot-distribution-1 o 2)
  const allSlots = PARKING_ZONES.flatMap(z => z.slots);
  const fromSlot = allSlots.find(s => s.id === slotId);

  if (!fromSlot) return undefined;

  let best:
    | { loadSlotId: string; routeId: string; dist2: number }
    | undefined;

  for (const zone of PARKING_ZONES) {
    for (const slot of zone.slots) {
      // solo slots de carga
      if (!slot.id.startsWith('slot-load-')) continue;

      const routeId = LOAD_TO_ROUTE_MAP[slot.id];
      if (!routeId) continue;

      const dx = slot.x - fromSlot.x;
      const dy = slot.y - fromSlot.y;
      const dist2 = dx * dx + dy * dy;

      if (!best || dist2 < best.dist2) {
        best = {
          loadSlotId: slot.id,
          routeId,
          dist2,
        };
      }
    }
  }

  if (!best) return undefined;
  return { loadSlotId: best.loadSlotId, routeId: best.routeId };
}

export function createDistributionExitTaskForTruck(
  truckId: string,
  actorType: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
    fromSlotId?: string;   // slot actual del camión (normalmente slot-distribution-2)
    targetSlotId?: string; // a dónde queremos llegar visualmente (slot-distribution-1)
  }
): SimTask {
  const fromSlotId = options?.fromSlotId ?? 'slot-distribution-2';
  const targetSlotId = options?.targetSlotId ?? 'slot-distribution-1';

  const routeId = 'route-salida-distribucion';

  const taskId = `followRouteDistributionExit:${truckId}:${fromSlotId}:${Date.now()}`;

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
      targetZone: 'zone-exit',   // 👈 igual que los camiones normales para que el engine lo pueda "sacar"
      targetSlotId,              // 👈 visualmente queremos terminar en slot-distribution-1
    },
  });
}


export function getRouteIdForDistributionSlot(slotId: string): string | undefined {
  return DISTRIBUTION_ROUTE_MAP[slotId];
}

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

export function createDistributionEntryTaskForTruck(
  truckId: string,
  actorType: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
    targetSlotId?: string;
  }
): SimTask {
  // por defecto mandamos al slot-distribution-2
  const targetSlotId = options?.targetSlotId ?? 'slot-distribution-2';

  const routeId =
    getRouteIdForDistributionSlot(targetSlotId) ??
    'route-distribution-truck';

  const taskId = `followRouteDistribution:${truckId}:${targetSlotId}:${Date.now()}`;

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
      targetZone: 'zone-parking-distribution', // 👈 llega a esa zona
      targetSlotId,                            // 👈 específicamente a slot-distribution-2
    },
  });
}

export const T1_CHECK_TO_ROUTE_MAP: Record<string, string> = {
  'slot-check-t1-1': 'route-t1-check-1',
};

export function getRouteIdForT1CheckSlot(slotId: string) {
  return T1_CHECK_TO_ROUTE_MAP[slotId];
}
export function createT1GoToCheckTask(
  truckId: string,
  actorType: string,
  options: { startAtSimTime?: string; targetSlotId?: string; dependsOn?: string[] }
): SimTask {
  const targetSlotId = options.targetSlotId ?? 'slot-check-t1-1';
  const routeId = getRouteIdForT1CheckSlot(targetSlotId);
  if (!routeId) throw new Error(`[T1] No route for check slot ${targetSlotId}`);

  return createBaseTask({
    id: `t1:goCheck:${truckId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-check-t1',
      targetSlotId,
    },
  });
}

export function createWaitTask(
  actorId: string,
  actorType: string,
  options: { dependsOn?: string[]; durationSec: number }
): SimTask {
  return createBaseTask({
    id: `wait:${actorId}:${Date.now()}`,
    actorId,
    actorType,
    type: 'wait',
    priority: 1,
    dependsOn: options.dependsOn,
    payloadExtra: { durationSec: options.durationSec },
  });
}

export function createT1EntryTaskForTruck(
  truckId: string,
  actorType: string,
  options?: {
    startAtSimTime?: string;
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = 'route-t1t2-entry'; // 👈 una ruta que termine cerca de la zona

  const taskId = `followRouteT1Zone:${truckId}:${Date.now()}`;

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
      targetZone: 'zone-load-download-t1-t2', // 👈 CLAVE
      // 👇 sin targetSlotId
    },
  });
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
