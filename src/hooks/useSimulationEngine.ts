// src/hooks/useSimulationEngine.ts
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
  const { running, editing, actorCounts, initialRouteId, stageWidth, stageHeight } = params;

  // 👉 Imágenes + estados de actores
  const { actors, loading: actorsLoading } = useActorImages(actorCounts);
  const { actorStates, setActorStates } = useActorStates(
    actors,
    actorsLoading,
    actorCounts,
    initialRouteId
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

      const candidates = tasks.filter(t => {
        if (t.actorId !== actorId) return false;
        if (t.status !== 'pending') return false;

        if (typeof t.startAtSimTime === 'number' && t.startAtSimTime > now) {
          return false;
        }

        if (t.dependsOn && t.dependsOn.length > 0) {
          const depsPending = t.dependsOn.some(depId => {
            const depTask = tasks.find(tt => tt.id === depId);
            if (!depTask) return true;
            return depTask.status !== 'completed';
          });
          if (depsPending) return false;
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

              if (
                  lastZoneLoadArrivalRef.current !== null &&
                  logicalSimTime < lastZoneLoadArrivalRef.current + 60
                ) {
                  // Aún no se cumple el minuto desde que se estacionó el último camión,
                  // no arrancamos la siguiente ruta en este tick.
                  return actor;
                }
                
              const targetRouteId = nextTask.payload.routeId;
              const targetRoute = PREDEFINED_ROUTES.find(
                r => r.id === targetRouteId
              );

              if (targetRoute) {
                const routeEnd: Point =
                  targetRoute.points[targetRoute.points.length - 1];

                const freeSlotInZoneLoad = findNearestFreeSlotInZone(
                  'zone-load',
                  routeEnd
                );

                // Si no hay ningún slot libre en zone-load, NO arrancamos la ruta
                if (!freeSlotInZoneLoad) {
                  console.log(
                    `⛔ No se inicia la ruta "${targetRoute.id}" para el actor ${actor.id}: sin slots libres en zone-load`
                  );
                  // Dejamos la tarea en 'pending' y el actor quieto
                  return actor;
                }
                let currentPosition: Point;

                if (
                  actor.parkingPosition &&
                  actor.behavior === 'stationary' &&
                  actor.cursor === 0
                ) {
                  currentPosition = {
                    x: actor.parkingPosition.x,
                    y: actor.parkingPosition.y,
                  };
                } else {
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
                  return actor;
                }

                updateTaskStatus(nextTask.id, 'running');

                const transition: RouteTransition = {
                  isTransitioning: true,
                  transitionPath,
                  fromRoute:
                    PREDEFINED_ROUTES.find(r => r.id === actor.routeId) ||
                    targetRoute,
                  toRoute: targetRoute,
                  progress: 0,
                  targetReached: false,
                };

                return {
                  ...actor,
                  behavior: 'mobile',
                  currentTransition: transition,
                  cursor: 0,
                  direction: 1,
                };
              }
            }
          }

          // 2) Transición activa
          if (actor.currentTransition?.isTransitioning) {
            const transition = actor.currentTransition;
            const transitionPathPx = buildPathPx(
              transition.transitionPath,
              stageWidth,
              stageHeight
            );

            if (transitionPathPx.total === 0) {
              console.warn('⚠️ Path de transición vacío, finalizando transición');
              return {
                ...actor,
                currentTransition: undefined,
                routeId: transition.toRoute.id,
                cursor: 0,
                direction: 1,
              };
            }

            const SPEED = stageWidth * 0.02;
            let newCursor = actor.cursor + SPEED * dtSim;

            if (newCursor >= transitionPathPx.total) {
              console.log(
                `✅ Actor ${actor.id}: Transición completada`
              );

              const parkingSlotId = (transition as any)
                .parkingSlotId as string | undefined;

              if (parkingSlotId) {
                // → Transición a slot de carga

                if (
                  actor.parkingSlotId &&
                  actor.parkingSlotId !== parkingSlotId
                ) {
                  releaseSlot(actor.parkingSlotId);
                }

                occupySlot(parkingSlotId);
                const targetSlot = getSlotById(parkingSlotId);
                
                lastZoneLoadArrivalRef.current = logicalSimTime;

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

              // Transición normal
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
                targetReached:
                  newCursor > transitionPathPx.total * 0.95,
              },
            };
          }

          // 3) Sin transición, stationary y sin tarea → quieto
          if (
            actor.behavior === 'stationary' &&
            !runningFollowRouteTask
          ) {
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
            console.warn(
              `⚠️ Ruta "${actorRoute.name}" no tiene puntos válidos`
            );
            return actor;
          }

          const SPEED = stageWidth * 0.03 * actor.speed;

          // 4.a) followRoute en ejecución → avanzar hasta fin de ruta y de ahí al parking
          if (runningFollowRouteTask) {
            const newCursor = actor.cursor + SPEED * dtSim;

            if (newCursor >= actorPathPx.total) {
              const routeEnd: Point =
                actorRoute.points[actorRoute.points.length - 1];  

              const bestSlot = findNearestFreeSlotInZone(
                'zone-load',
                routeEnd
              );

              if (!bestSlot) {
                setTasks(prev =>
                  prev.map(t =>
                    t.id === runningFollowRouteTask.id
                      ? { ...t, status: 'completed' }
                      : t
                  )
                );

                console.log(
                  `⚠️ Actor ${actor.id}: sin slots libres en zone-load`
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

                return {
                  ...actor,
                  cursor: actorPathPx.total,
                  direction: 0,
                  behavior: 'stationary',
                };
              }

              console.log(
                `🚛 Actor ${actor.id}: ruta completada, moviéndose a slot de carga ${bestSlot.id}`
              );

              const parkingTransition: RouteTransition & {
                parkingSlotId?: string;
              } = {
                isTransitioning: true,
                transitionPath: parkingPath,
                fromRoute: actorRoute,
                toRoute: actorRoute,
                progress: 0,
                targetReached: false,
                parkingSlotId: bestSlot.id,
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
    tasks,
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
    