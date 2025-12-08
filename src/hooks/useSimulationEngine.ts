import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point } from '../types';
import type { ActorType, ActorState } from '../types/actors';
import type { SimTask, SimTaskStatus } from '../types/tasks';
import { PREDEFINED_ROUTES } from '../utils/routes/routes';
import { buildPathPx, poseAlongPath } from '../utils/path';
import { PREDEFINED_OBSTACLES } from '../utils/routes/obstacles';
import { aStarPathfinding } from '../utils/routes/pathfinding';
import type { RouteTransition } from '../utils/routes/scheduledRoutes';
import { useActorImages } from './useActorImages';
import { useActorStates } from './useActorStates';
import {
  findNearestFreeSlotInZone,
  getSlotById,
  occupySlot,
  releaseSlot,
} from '../utils/parkingUtils';

const SIM_DAY_SECONDS = 24 * 60 * 60;
const LOOP_DAY = false;

type UseSimulationEngineParams = {
  running: boolean;
  editing: boolean;
  actorCounts: Record<ActorType, number>;
  initialRouteId: string;
  stageWidth: number;
  stageHeight: number;
  truckIdsFromBackend?: string[];
};

type UseSimulationEngineResult = {
  simTimeSec: number;
  speedMult: number;
  setSpeedMult: (v: number) => void;

  tasks: SimTask[];
  addTask: (task: SimTask) => void;
  updateTaskStatus: (taskId: string, status: SimTaskStatus) => void;

  actorStates: ActorState[];
  setActorStates: React.Dispatch<React.SetStateAction<ActorState[]>>;
  actorsLoading: boolean;
};


export function useSimulationEngine(
  params: UseSimulationEngineParams
): UseSimulationEngineResult {
  const { running, editing, actorCounts, initialRouteId, stageWidth, stageHeight, truckIdsFromBackend } = params;

  // 👉 Imágenes + estados de actores
  const { actors, loading: actorsLoading } = useActorImages(actorCounts);
  const { actorStates, setActorStates } = useActorStates(
    actors,
    actorsLoading,
    actorCounts,
    initialRouteId,
    truckIdsFromBackend
  );

  // Tiempo de simulación
  const [simTimeSec, setSimTimeSec] = useState(0);
  const simTimeRef = useRef(0);
  const [speedMult, setSpeedMult] = useState<number>(1);

  const lastZoneLoadArrivalRef = useRef<number | null>(null);

  // Tareas
  const [tasks, setTasks] = useState<SimTask[]>([]);

  const addTask = useCallback((task: SimTask) => {
    setTasks(prev => {
      const withCreated = task.createdAtSimTime
        ? task
        : { ...task, createdAtSimTime: Date.now() / 1000 };
      return [...prev, withCreated];
    });
  }, []);

  const updateTaskStatus = useCallback((taskId: string, status: SimTaskStatus) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, status } : t))
    );
  }, []);

    const getNextTaskForActor = useCallback(
    (actorId: string, timeSec: number): SimTask | null => {
      const now = timeSec;

      const hasDepsPending = (t: SimTask) => {
        if (!t.dependsOn || t.dependsOn.length === 0) return false;
        return t.dependsOn.some(depId => {
          const depTask = tasks.find(tt => tt.id === depId);
          if (!depTask) return true;
          return depTask.status !== 'completed';
        });
      };

      const candidates = tasks.filter(t => {
        if (t.actorId !== actorId) return false;
        if (t.status !== 'pending') return false;
        if (hasDepsPending(t)) return false;

        const targetZone = (t as any).payload?.targetZone;

        // 🔹 Para tareas que vuelven a zone-parking, NO bloqueamos por startAtSimTime
        if (t.type === 'followRoute' && targetZone === 'zone-parking') {
          return true;
        }

        // 🔹 Para el resto, respetamos startAtSimTime
        if (typeof t.startAtSimTime === 'number' && t.startAtSimTime > now) {
          return false;
        }

        return true;
      });

      if (candidates.length === 0) return null;

      const sorted = [...candidates].sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        const aCreated = a.createdAtSimTime ?? 0;
        const bCreated = b.createdAtSimTime ?? 0;
        return aCreated - bCreated;
      });

      return sorted[0];
    },
    [tasks]
  );

   // 👉 Loop principal de simulación (tick)
  useEffect(() => {
    const active =
      running && !editing && !actorsLoading && actorStates.length > 0;
    if (!active) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtReal = (now - last) / 1000;
      last = now;
      const dtSim = dtReal * speedMult;

      // Tiempo
      let nextSimTime = simTimeRef.current + dtSim;

      if (LOOP_DAY) {
        nextSimTime = nextSimTime % SIM_DAY_SECONDS;
      } else if (nextSimTime >= SIM_DAY_SECONDS) {
        nextSimTime = SIM_DAY_SECONDS;
      }

      simTimeRef.current = nextSimTime;
      setSimTimeSec(nextSimTime);
      const logicalSimTime = nextSimTime;

      // Actores
      setActorStates(prevStates =>
        prevStates.map(actor => {
           if (actor.isExited) {
            return actor;
          }
          const hasRunningTask = tasks.some(
            t => t.actorId === actor.id && t.status === 'running'
          );
          const hasTransition = !!actor.currentTransition?.isTransitioning;

          const runningFollowRouteTask = tasks.find(
            t =>
              t.actorId === actor.id &&
              t.status === 'running' &&
              t.type === 'followRoute'
          );

          // 1) Arrancar tarea si no tiene transición ni tarea en curso
          if (!hasTransition && !hasRunningTask) {
            const nextTask = getNextTaskForActor(actor.id, logicalSimTime);

            if (
              nextTask &&
              nextTask.type === 'followRoute' &&
              nextTask.payload?.routeId
            ) {
              const targetZone =
                (nextTask as any).payload?.targetZone ?? 'zone-load';
              
              
const targetRouteId = nextTask.payload.routeId;
const targetRoute = PREDEFINED_ROUTES.find(
  r => r.id === targetRouteId
);

if (!targetRoute) {
  console.warn(
    `[Engine] ❌ No se encontró targetRoute "${targetRouteId}" para actor ${actor.id}. Marcando tarea como completada para evitar loop.`
  );

  // Evita que la tarea se siga intentando en cada tick
  updateTaskStatus(nextTask.id, 'completed');
  return actor;
}


              // 🆕 Si la tarea es "volver al parking" o "salir del patio", liberamos su slot
              if (
                (targetZone === 'zone-parking' || targetZone === 'zone-exit') &&
                actor.parkingSlotId
              ) {
                console.log(
                  `🚛 ${actor.id} saliendo de slot ${actor.parkingSlotId} hacia ${targetZone}`
                );
                releaseSlot(actor.parkingSlotId);
              }


              // ⏱ Throttle de 1 minuto SOLO para tareas que van a zone-load
              if (
                targetZone === 'zone-load' &&
                lastZoneLoadArrivalRef.current !== null &&
                logicalSimTime < lastZoneLoadArrivalRef.current + 60
              ) {
                return actor;
              }


              if (targetRoute) {
                const routeEnd: Point =
                  targetRoute.points[targetRoute.points.length - 1];

                // Para rutas que terminan en zone-load, verificamos capacidad ANTES de arrancar
                if (targetZone === 'zone-load') {
                  const freeSlotInZoneLoad = findNearestFreeSlotInZone(
                    'zone-load',
                    routeEnd
                  );
                  if (!freeSlotInZoneLoad) {
                    // No arrancamos la ruta hacia zona de carga si no hay slots libres
                    return actor;
                  }
                }

                let currentPosition: Point;

if (actor.parkingPosition) {
  // 🚛 Camión en un slot (parking / load), usar directamente esa posición
  currentPosition = {
    x: actor.parkingPosition.x,
    y: actor.parkingPosition.y,
  };
} else {
  // 🚛 Camión en una ruta → tomar su posición actual en la ruta
  const currentRoute = PREDEFINED_ROUTES.find(
    r => r.id === actor.routeId
  );
  if (!currentRoute) return actor;

  const currentPathPx = buildPathPx(
    currentRoute.points,
    stageWidth,
    stageHeight
  );
  if (currentPathPx.total === 0) return actor;

  const pose = poseAlongPath(currentPathPx, actor.cursor);
  currentPosition = {
    x: pose.x / stageWidth,
    y: pose.y / stageHeight,
  };
}

                const transitionPath = aStarPathfinding(
  currentPosition,
  targetRoute.points[0],
  PREDEFINED_OBSTACLES
);

if (!transitionPath || transitionPath.length === 0) {
  console.warn(
    `⚠️ No se pudo construir transición para actor ${actor.id} hacia ruta ${targetRoute.id}`
  );
  // No arrancamos nada
  return actor;
}

// 🆕 Comprobar si ese path tiene longitud real (> 0 px)
const transitionPathPx = buildPathPx(
  transitionPath,
  stageWidth,
  stageHeight
);

if (transitionPathPx.total === 0) {
  // 👉 Ya estamos, en la práctica, en el inicio de la ruta.
  // No tiene sentido crear una RouteTransition; saltamos directo a la ruta.
  console.log(
    `[Engine] ℹ️ ${actor.id} ya está en el inicio de ${targetRoute.id}, arrancando ruta sin transición`
  );

  updateTaskStatus(nextTask.id, 'running');

  return {
    ...actor,
    behavior: 'mobile',
    currentTransition: undefined,
    routeId: targetRoute.id,
    cursor: 0,
    direction: 1,
    parkingSlotId:
      targetZone === 'zone-parking' || targetZone === 'zone-exit'
        ? undefined
        : actor.parkingSlotId,
  };
}

                updateTaskStatus(nextTask.id, 'running');

                console.log(
                  `[Engine] ▶ Arrancando followRoute para ${actor.id} routeId=${targetRouteId} targetZone=${targetZone}`
                );

                const transition: RouteTransition & { targetZone?: string } = {
                  isTransitioning: true,
                  transitionPath,
                  fromRoute:
                    PREDEFINED_ROUTES.find(r => r.id === actor.routeId) ||
                    targetRoute,
                  toRoute: targetRoute,
                  progress: 0,
                  targetReached: false,
                  targetZone,
                };

                return {
                  ...actor,
                  behavior: 'mobile',
                  currentTransition: transition,
                  cursor: 0,
                  direction: 1,
                  // 🆕 si va al parking, ya no "pertenece" a un slot-load
                 parkingSlotId:
                  targetZone === 'zone-parking' || targetZone === 'zone-exit'
                    ? undefined
                    : actor.parkingSlotId,
                };
              }
            }
          }


          // 2) Transición activa
if (actor.currentTransition?.isTransitioning) {
  const transition = actor.currentTransition as RouteTransition & {
    parkingSlotId?: string;
    targetZone?: string;
    isExit?: boolean;    // 👈 nuevo flag
  };

  const transitionPathPx = buildPathPx(
    transition.transitionPath,
    stageWidth,
    stageHeight
  );

  if (transitionPathPx.total === 0) {
    console.warn('⚠️ Path de transición vacío, finalizando transición');

    const parkingSlotId = transition.parkingSlotId;
    const targetZone = transition.targetZone ?? 'zone-load';

    if (!parkingSlotId && (transition.isExit || targetZone === 'zone-exit')) {
    const lastPoint =
      transition.transitionPath[transition.transitionPath.length - 1] ?? { x: 0.340, y: 0.999 };

    setTasks(prev =>
      prev.map(t =>
        t.actorId === actor.id &&
        t.type === 'followRoute' &&
        t.status === 'running'
          ? { ...t, status: 'completed' }
          : t
      )
    );

    return {
      ...actor,
      currentTransition: undefined,
      behavior: 'stationary',
      routeId: transition.toRoute.id,
      cursor: 0,
      direction: 0,
      parkingSlotId: undefined,
      parkingPosition: {
        x: lastPoint.x,
        y: lastPoint.y,
        rotation: actor.parkingPosition?.rotation ?? 0,
      },
      isExited: true,  // 👈 marcar como salido
    };
  }

    // 🔹 Caso especial: transición hacia un slot de parking/carga,
    // pero el path está vacío → “teletransportar” al slot y cerrar la tarea.
    if (parkingSlotId) {
      if (actor.parkingSlotId && actor.parkingSlotId !== parkingSlotId) {
        releaseSlot(actor.parkingSlotId);
      }

      occupySlot(parkingSlotId);
      const targetSlot = getSlotById(parkingSlotId);

      if (targetZone === 'zone-load') {
        lastZoneLoadArrivalRef.current = logicalSimTime;
      }

      // Marcar followRoute en running como completadas
      setTasks(prev =>
        prev.map(t =>
          t.actorId === actor.id &&
          t.type === 'followRoute' &&
          t.status === 'running'
            ? { ...t, status: 'completed' }
            : t
        )
      );

      return {
        ...actor,
        currentTransition: undefined,
        routeId: transition.toRoute.id,
        cursor: 0,
        direction: 0,
        behavior: 'stationary',
        parkingSlotId,
        parkingPosition: targetSlot
          ? {
              x: targetSlot.x,
              y: targetSlot.y,
              rotation:
                targetSlot.rotation ??
                actor.parkingPosition?.rotation ??
                0,
            }
          : actor.parkingPosition,
      };
    }

    // 🔹 Si no era una transición hacia slot, dejamos el fallback original
    return {
      ...actor,
      currentTransition: undefined,
      routeId: transition.toRoute.id,
      cursor: 0,
      direction: 1,
    };
  }

  // ⬇️ resto de la lógica de transición (SPEED, newCursor, etc) tal cual la tienes
  const SPEED = stageWidth * 0.02;
  let newCursor = actor.cursor + SPEED * dtSim;

 if (newCursor >= transitionPathPx.total) {
  console.log(`✅ Actor ${actor.id}: Transición completada`);

  const parkingSlotId = transition.parkingSlotId;
  const targetZone = transition.targetZone ?? 'zone-load';

  if (transition.isExit && targetZone === 'zone-exit') {
      const lastPoint =
        transition.transitionPath[transition.transitionPath.length - 1];

      setTasks(prev =>
        prev.map(t =>
          t.actorId === actor.id &&
          t.type === 'followRoute' &&
          t.status === 'running'
            ? { ...t, status: 'completed' }
            : t
        )
      );

      return {
        ...actor,
        currentTransition: undefined,
        behavior: 'stationary',
        routeId: transition.toRoute.id,
        cursor: 0,
        direction: 0,
        // 👇 importante: sin parkingSlotId → nunca entra en lógica de slots
        parkingSlotId: undefined,
        parkingPosition: {
          x: lastPoint.x,  // ~0.340
          y: lastPoint.y,  // ~0.999
          rotation: actor.parkingPosition?.rotation ?? 0,
        },
        isExited: true,  // 👈 marcar como salido
      };
    }

    if (parkingSlotId) {
      if (actor.parkingSlotId && actor.parkingSlotId !== parkingSlotId) {
        releaseSlot(actor.parkingSlotId);
      }

      occupySlot(parkingSlotId);
      const targetSlot = getSlotById(parkingSlotId);

      if (targetZone === 'zone-load') {
        lastZoneLoadArrivalRef.current = logicalSimTime;
      }

      setTasks(prev =>
        prev.map(t =>
          t.actorId === actor.id &&
          t.type === 'followRoute' &&
          t.status === 'running'
            ? { ...t, status: 'completed' }
            : t
        )
      );

      return {
        ...actor,
        currentTransition: undefined,
        routeId: transition.toRoute.id,
        cursor: 0,
        direction: 0,
        behavior: 'stationary',
        parkingSlotId,
        parkingPosition: targetSlot
          ? {
              x: targetSlot.x,
              y: targetSlot.y,
              rotation:
                targetSlot.rotation ??
                actor.parkingPosition?.rotation ??
                0,
            }
          : actor.parkingPosition,
      };
    }

    // Transición normal (sin slot asociado)
    return {
      ...actor,
      currentTransition: undefined,
      routeId: transition.toRoute.id,
      cursor: 0,
      direction: 1,
    };
  }

  // Continúa transición
  return {
    ...actor,
    cursor: newCursor,
    currentTransition: {
      ...transition,
      progress: newCursor / transitionPathPx.total,
      targetReached: newCursor > transitionPathPx.total * 0.95,
    },
  };
}


          // 3) Sin transición, stationary y sin tarea → quieto
          if (actor.behavior === 'stationary' && !runningFollowRouteTask) {
            return actor;
          }

          // 4) Movimiento en ruta
          const actorRoute = PREDEFINED_ROUTES.find(
            r => r.id === actor.routeId
          );
          if (!actorRoute) {
            console.warn(
              `⚠️ Actor ${actor.id} tiene routeId inválido: ${actor.routeId}`
            );
            return actor;
          }

          const actorPathPx = buildPathPx(
            actorRoute.points,
            stageWidth,
            stageHeight
          );
          if (actorPathPx.total === 0) {
            console.warn(`⚠️ Ruta "${actorRoute.name}" no tiene puntos válidos`);
            return actor;
          }

          const SPEED = stageWidth * 0.03 * actor.speed;

          // 4.a) followRoute en ejecución → avanzar hasta fin de ruta y de ahí a un slot
          if (runningFollowRouteTask) {
            const newCursor = actor.cursor + SPEED * dtSim;

            if (newCursor >= actorPathPx.total) {
              const routeEnd: Point =
                actorRoute.points[actorRoute.points.length - 1];

              const targetZone =
                (runningFollowRouteTask as any).payload?.targetZone ??
                'zone-load';

              // 🔹 CASO ESPECIAL: salida → no usamos slots, sólo un punto fijo
if (targetZone === 'zone-exit') {
  const exitPoint = { x: 0.340, y: 0.999 };

  const exitPath = aStarPathfinding(
    routeEnd,
    exitPoint,
    PREDEFINED_OBSTACLES
  );

  if (!exitPath || exitPath.length === 0) {
    console.warn(
      `⚠️ Actor ${actor.id}: no se pudo calcular path a zona de salida`
    );

    // Damos por terminada la tarea igualmente
    setTasks(prev =>
      prev.map(t =>
        t.id === runningFollowRouteTask.id
          ? { ...t, status: 'completed' }
          : t
      )
    );

    return {
      ...actor,
      cursor: actorPathPx.total,
      direction: 0,
      behavior: 'stationary',
    };
  }

  console.log(
    `🚛 Actor ${actor.id}: ruta completada, moviéndose a zona de salida (sin ocupar slot)`
  );

  const exitTransition: RouteTransition & {
    targetZone?: string;
    isExit?: boolean;
  } = {
    isTransitioning: true,
    transitionPath: exitPath,
    fromRoute: actorRoute,
    toRoute: actorRoute,
    progress: 0,
    targetReached: false,
    targetZone: 'zone-exit',
    isExit: true,
  };

  return {
    ...actor,
    currentTransition: exitTransition as RouteTransition,
    cursor: 0,
    direction: 1,
  };
}

// 🔹 Resto de zonas: comportamiento normal con slots
const bestSlot = findNearestFreeSlotInZone(targetZone, routeEnd);

if (!bestSlot) {
  setTasks(prev =>
    prev.map(t =>
      t.id === runningFollowRouteTask.id
        ? { ...t, status: 'completed' }
        : t
    )
  );

  console.log(
    `⚠️ Actor ${actor.id}: sin slots libres en ${targetZone}`
  );

  return {
    ...actor,
    cursor: actorPathPx.total,
    direction: 0,
    behavior: 'stationary',
  };
}

const parkingPath = aStarPathfinding(
  routeEnd,
  { x: bestSlot.x, y: bestSlot.y },
  PREDEFINED_OBSTACLES
);


              if (!parkingPath || parkingPath.length === 0) {
                setTasks(prev =>
                  prev.map(t =>
                    t.id === runningFollowRouteTask.id
                      ? { ...t, status: 'completed' }
                      : t
                  )
                );

                console.log(
  `🚛 [DEBUG] Fin de ruta ${actorRoute.id} para ${actor.id}, targetZone=${targetZone}, routeEnd=`,
  routeEnd
);
console.log('🚛 [DEBUG] bestSlot encontrado:', bestSlot);

                return {
                  ...actor,
                  cursor: actorPathPx.total,
                  direction: 0,
                  behavior: 'stationary',
                };
              }

              console.log(
                `🚛 Actor ${actor.id}: ruta completada, moviéndose a slot ${bestSlot.id} en ${targetZone}`
              );

              const parkingTransition: RouteTransition & {
                parkingSlotId?: string;
                targetZone?: string;
              } = {
                isTransitioning: true,
                transitionPath: parkingPath,
                fromRoute: actorRoute,
                toRoute: actorRoute,
                progress: 0,
                targetReached: false,
                parkingSlotId: bestSlot.id,
                targetZone,
              };

              return {
                ...actor,
                currentTransition: parkingTransition as RouteTransition,
                cursor: 0,
                direction: 1,
              };
            }

            return {
              ...actor,
              cursor: newCursor,
              direction: 1,
            };
          }

          // 4.b) actores móviles "libres" (ej: grúas)
          if (actor.behavior !== 'mobile') {
            return actor;
          }

          const currentDirection = actor.direction || 1;
          let freeCursor =
            actor.cursor + SPEED * dtSim * currentDirection;
          let freeDir = currentDirection;

          if (freeCursor >= actorPathPx.total) {
            freeCursor = actorPathPx.total;
            freeDir = -1;
          } else if (freeCursor <= 0) {
            freeCursor = 0;
            freeDir = 1;
          }

          return {
            ...actor,
            cursor: freeCursor,
            direction: freeDir,
          };
        })
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    running,
    editing,
    actorsLoading,
    actorStates.length,
    speedMult,
    getNextTaskForActor,
    setActorStates,
    stageWidth,
    stageHeight,
  ]);

  return {
    simTimeSec,
    speedMult,
    setSpeedMult,
    tasks,
    addTask,
    updateTaskStatus,
    actorStates,
    setActorStates,
    actorsLoading,
  };
}
