import type { PredefinedRoute } from './routes';
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
  'slot-31': 'route-parking-31-patio',
  'slot-32': 'route-parking-32-patio',
  'slot-33': 'route-parking-33-patio',
  'slot-34': 'route-parking-34-patio',
  'slot-35': 'route-parking-35-patio',
  'slot-36': 'route-parking-36-patio',
  'slot-37': 'route-parking-37-patio',
  'slot-38': 'route-parking-38-patio',
  'slot-39': 'route-parking-39-patio',
  'slot-40': 'route-parking-40-patio',
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

export function createT2ReturnToParkingTask(
  truckId: string,
  actorType: string,
  options: {
    startAtSimTime?: string;
    targetSlotId?: string;     // slot parking asignado
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = 'route-t2-return-to-parking'; // 👈 crea esta ruta en PREDEFINED_ROUTES

  return createBaseTask({
    id: `t2:return:${truckId}:${options.targetSlotId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options.priority ?? 1,
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-parking',     // 👈 para que el engine lo estacione
      targetSlotId: options.targetSlotId,
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


export const T2_T1T2_ENTRY_ROUTE_MAP: Record<string, string> = {
  'slot-t1-t2-1': 'route-t2-to-t1t2-1',
  'slot-t1-t2-2': 'route-t2-to-t1t2-2',
  'slot-t1-t2-3': 'route-t2-to-t1t2-3',
  'slot-t1-t2-4': 'route-t2-to-t1t2-4',
  'slot-t1-t2-5': 'route-t2-to-t1t2-5',
};

export function getRouteIdForT2EntryToT1T2Slot(slotId: string) {
  return T2_T1T2_ENTRY_ROUTE_MAP[slotId];
}

export function createT2EntryToT1T2SlotTask(
  truckId: string,
  actorType: string,
  options: {
    startAtSimTime?: string;
    targetSlotId: string;     // slot-t1-t2-X
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = getRouteIdForT2EntryToT1T2Slot(options.targetSlotId);
  if (!routeId) {
    throw new Error(`[T2 v2+] No route for targetSlotId=${options.targetSlotId}`);
  }

  return createBaseTask({
    id: `t2:entry:t1t2:${truckId}:${options.targetSlotId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options.priority ?? 1,
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-load-download-t1-t2',
      targetSlotId: options.targetSlotId, // 👈 clave: slot específico
    },
  });
}

// 🆕 T2 v2+ salida desde zona T1/T2 hacia salida general
export const T2_T1T2_EXIT_ROUTE_MAP: Record<string, string> = {
  'slot-t1-t2-1': 'route-t1t2-1-to-exit',
  'slot-t1-t2-2': 'route-t1t2-2-to-exit',
  'slot-t1-t2-3': 'route-t1t2-3-to-exit',
  'slot-t1-t2-4': 'route-t1t2-4-to-exit',
  'slot-t1-t2-5': 'route-t1t2-5-to-exit',
};

export function getRouteIdForT2ExitFromT1T2Slot(fromSlotId: string) {
  return T2_T1T2_EXIT_ROUTE_MAP[fromSlotId];
}


export function createT2ExitFromT1T2SlotTask(
  truckId: string,
  actorType: string,
  options: {
    startAtSimTime?: string;
    fromSlotId: string;          // 👈 slot-t1-t2-X real donde está estacionado
    targetSlotId?: string;       // opcional (si quieres “terminar” visualmente en un slot-exit)
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const routeId = getRouteIdForT2ExitFromT1T2Slot(options.fromSlotId);

  if (!routeId) {
    throw new Error(
      `[T2 Exit] No route for exit from slot ${options.fromSlotId}. Revisa T2_T1T2_EXIT_ROUTE_MAP`
    );
  }

  return createBaseTask({
    id: `t2:exit:t1t2:${truckId}:${options.fromSlotId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options.priority ?? 1,
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-exit',
      // opcional: si tu engine soporta terminar en un slot de salida específico
      ...(options.targetSlotId ? { targetSlotId: options.targetSlotId } : {}),
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

// 1) Mapa: desde qué slot T1/T2 sale → qué ruta usar para ir a chequeo final
export const T1T2_TO_FINAL_CHECK_ROUTE_MAP: Record<string, string> = {
  'slot-t1-t2-1': 'route-t1t2-1-to-check-2',
  'slot-t1-t2-2': 'route-t1t2-2-to-check-2',
  'slot-t1-t2-3': 'route-t1t2-3-to-check-2',
  'slot-t1-t2-4': 'route-t1t2-4-to-check-2',
  'slot-t1-t2-5': 'route-t1t2-5-to-check-2',
};

export function getRouteIdForT1FinalCheckFromSlot(fromSlotId: string) {
  return T1T2_TO_FINAL_CHECK_ROUTE_MAP[fromSlotId];
}

export function createT1FinalCheckTaskForTruck(
  truckId: string,
  actorType: string,
  options: {
    startAtSimTime?: string;
    fromSlotId: string;          // 👈 slot real donde está estacionado
    targetSlotId?: string;       // 👈 por defecto slot-check-t1-2
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const targetSlotId = options.targetSlotId ?? 'slot-check-t1-2';

  const routeId = getRouteIdForT1FinalCheckFromSlot(options.fromSlotId);
  if (!routeId) {
    throw new Error(
      `[T1] No route for final check from slot ${options.fromSlotId}. Revisa T1T2_TO_FINAL_CHECK_ROUTE_MAP`
    );
  }

  return createBaseTask({
    id: `t1:finalCheck:${truckId}:${options.fromSlotId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options.priority ?? 1,
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-check-t1',
      targetSlotId, // 👈 termina en slot-check-t1-2
    },
  });
}

export const T1_EXIT_ROUTE_MAP: Record<string, string> = {
  'slot-check-t1-2': 'route-t1-check2-to-exit',
};

export function getRouteIdForT1ExitFromSlot(fromSlotId: string) {
  return T1_EXIT_ROUTE_MAP[fromSlotId];
}

export function createT1ExitTaskForTruck(
  truckId: string,
  actorType: string,
  options: {
    startAtSimTime?: string;
    fromSlotId: string;           // debe ser slot-check-t1-2
    targetSlotId?: string;        // default slot-exit-t1-1
    priority?: number;
    dependsOn?: string[];
  }
): SimTask {
  const targetSlotId = options.targetSlotId ?? 'slot-exit-t1-1';

  const routeId = getRouteIdForT1ExitFromSlot(options.fromSlotId);
  if (!routeId) {
    throw new Error(
      `[T1 Exit] El camión debe salir desde slot-check-t1-2. fromSlotId=${options.fromSlotId}`
    );
  }

  return createBaseTask({
    id: `t1:exit:${truckId}:${Date.now()}`,
    actorId: truckId,
    actorType,
    type: 'followRoute',
    priority: options.priority ?? 1,
    startAtSimTime: options.startAtSimTime ? parseHM(options.startAtSimTime) : undefined,
    dependsOn: options.dependsOn,
    payload: {
      routeId,
      targetZone: 'zone-exit',
      targetSlotId,
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
