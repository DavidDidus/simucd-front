import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Stage,Layer } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './modals/SaveRouteModal';
import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import type { Point, ShiftResources } from '../../types';
import type { PathPx } from '../../utils/path';
import type { ActorType } from '../../types/actors';
import type { SimTask, SimTaskStatus } from '../../types/tasks';
import { CAN_EDIT } from '../../utils/env';
import { buildPathPx, toNorm } from '../../utils/path';
import { formatHM, shiftForSecond, shiftLabel as labelOf } from '../../utils/time';
import { getScheduleWithRouteDetails, type RouteTransition } from '../../utils/routes/scheduledRoutes';
import { poseAlongPath } from '../../utils/path';
import { PREDEFINED_ROUTES } from '../../utils/routes/routes';
import { useHTMLImage } from '../../hooks/useHTMLImage';
import { useStageSize } from '../../hooks/useStageSize';
import { useRoute } from '../../hooks/useRoute';
import { useActorImages } from '../../hooks/useActorImages';
import { useActorStates } from '../../hooks/useActorStates';
import { useObstacle} from '../../hooks/useObstacle';
import { PREDEFINED_OBSTACLES } from '../../utils/routes/obstacles';
import { aStarPathfinding } from '../../utils/routes/pathfinding';
import { createFollowRouteTaskForTruck } from '../../utils/routes/scheduledRoutes';
import { PARKING_ZONES } from '../../types/parkingSlot';
import PalletSpawnPointsLayer  from './layers/PalletSpawnPointsLayer';
import ParkingSlotsLayer from './layers/ParkingSlotLayer';
import SaveObstacleModal from './modals/SaveObstacleModal';
import ObstaclesLayer from './layers/ObstaclesLayer';
import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorShape from './layers/ActorsLayer';
import DevToolbar from './DevToolbar';


type EditMode = 'route' | 'obstacle';

type Props = {
  running?: boolean;
  resources?: Partial<ShiftResources>;
};

const DEFAULT_ROUTE: Point[] = [
  { x: 0.06, y: 0.76 },
  { x: 0.94, y: 0.76 },
];

const toUrl = (m: any) => (typeof m === 'string' ? m : m?.src || '');

export default function Simulation2D({ running = true, resources: resourcesProp }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startupTasksCreatedRef = useRef(false);

  // Imágenes
  const bgImg = useHTMLImage(toUrl(BG_IMPORT));

  // Dimensiones del Stage (escala por ancho)
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('route');
  const [showSaveObstacleModal, setShowSaveObstacleModal] = useState(false);
  const { obstacle, setObstacle, clearObstacle } = useObstacle([]);


  useEffect(() => { if (!CAN_EDIT) setEditing(false); }, []);
  const { route, setRoute, saveRoute, loadRoute, clearRoute } = useRoute(DEFAULT_ROUTE);

  const [activeRouteId, setActiveRouteId] = useState<string>(
  PREDEFINED_ROUTES[0]?.id || 'route-default'
);

const initialRouteIdRef = useRef<string>(
  PREDEFINED_ROUTES[0]?.id || 'route-default'
);

  const [showPalletSpawnPoints, setShowPalletSpawnPoints] = useState(false);

  // Simulación: reloj + cursor
  const [simTimeSec, setSimTimeSec] = useState(0);
  const simTimeRef = useRef(0); 
  const [speedMult, setSpeedMult] = useState<number>(1);
  
  //Borrar estos dos despues de configurar los obstaculos
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  const SIM_DAY_SECONDS = 24*60*60; 
  const LOOP_DAY = false;

  const [tasks, setTasks] = useState<SimTask[]>([]);

  // Añadir una tarea
  const addTask = useCallback((task: SimTask) => {
    setTasks(prev => {
      const withCreated = task.createdAtSimTime
        ? task
        : { ...task, createdAtSimTime: Date.now() / 1000 };
      return [...prev, withCreated];
    });
  }, []);

  // Actualizar estado de una tarea
  const updateTaskStatus = useCallback((taskId: string, status: SimTaskStatus) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status }
          : t
      )
    );
  }, []);

  const getNextTaskForActor = useCallback(
    (actorId: string, simTimeSec: number): SimTask | null => {
      const now = simTimeSec;

      const candidates = tasks.filter(t => {
        if (t.actorId !== actorId) return false;
        if (t.status !== 'pending') return false;

        // startAtSimTime <= ahora (o undefined)
        if (typeof t.startAtSimTime === 'number' && t.startAtSimTime > now) {
          return false;
        }

        // dependencias completadas
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
          return b.priority - a.priority; // prioridad más alta primero
        }
        const aCreated = a.createdAtSimTime ?? 0;
        const bCreated = b.createdAtSimTime ?? 0;
        return aCreated - bCreated; // más antigua primero
      });

      return sorted[0];
    },
    [tasks]
  );

  

  // Recursos por turno
  const [resources, setResources] = useState<ShiftResources>({ noche: 0, turnoA: 0, turnoB: 0 });
  useEffect(() => {
    if (!resourcesProp) return;
    setResources((prev) => ({
      noche: Math.max(0, Math.floor(resourcesProp.noche ?? prev.noche)),
      turnoA: Math.max(0, Math.floor(resourcesProp.turnoA ?? prev.turnoA)),
      turnoB: Math.max(0, Math.floor(resourcesProp.turnoB ?? prev.turnoB)),
    }));
  }, [resourcesProp]);

  
  // Configuración de actores - solo grúas
  const [actorCounts] = useState<Record<ActorType, number>>({
    truck1: 26,
    truck2: 0,
    truck3: 0,
    truck4: 0,
    crane1: 1,
  });

  // Hook para cargar imágenes de actores
  const { actors, loading: actorsLoading } = useActorImages(actorCounts);

  const { actorStates, setActorStates } = useActorStates(actors, actorsLoading, actorCounts, initialRouteIdRef.current);
  
  const handleRouteSelect = (routeId: string) => {
    if (editing) {
      alert('Termina de editar la ruta actual primero');
      return;
    }
    
    const selectedRoute = PREDEFINED_ROUTES.find((r) => r.id === routeId);
    if (selectedRoute) {
      console.log(`🎯 Ruta seleccionada manualmente: "${selectedRoute.name}"`);
      setActiveRouteId(routeId);
      
      const safePoints = applyAvoidObstaclesToRoute(selectedRoute.points);
      setRoute(safePoints);
      
      // Actualizar actores móviles
      setActorStates(prevStates =>
        prevStates.map(actor => {
          if (actor.behavior === 'mobile') {
            return {
              ...actor,
              routeId: routeId,
              cursor: 0,
              direction: 1
            };
          }
          return actor;
        })
      );
    }
  };

  const currentShift = useMemo(() => shiftForSecond(simTimeSec), [simTimeSec]);
  const activeCount = useMemo(() => Math.min(20, Math.max(0, resources[currentShift])), [resources, currentShift]);
  
  /*
  useEffect(() => {
  if (editing) return;

  const { route: scheduledRoute } = getActiveScheduledRoute(simTimeSec);
  
  if (scheduledRoute.id !== activeRouteId) {
    console.log(`⏰ Iniciando transición a ruta programada: "${scheduledRoute.name}"`);
    
    // 🔑 Para cada actor móvil, crear transición individual
    setActorStates(prevStates =>
      prevStates.map(actor => {
        if (actor.behavior !== 'mobile') return actor;

        // Obtener posición actual del actor
        const currentRoute = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
        if (!currentRoute) return actor;

        const currentPathPx = buildPathPx(currentRoute.points, stageDims.w, stageDims.h);
        if (currentPathPx.total === 0) return actor;

        // Calcular posición actual en coordenadas normalizadas
        const pose = poseAlongPath(currentPathPx, actor.cursor);
        const currentPosition: Point = {
          x: pose.x / stageDims.w,
          y: pose.y / stageDims.h
        };

        // 🆕 Crear transición usando A* hacia el inicio de la nueva ruta
        const targetPosition = scheduledRoute.points[0]; // Primer punto de la nueva ruta
        
        // 🔑 Usar A* para encontrar camino evitando obstáculos
        const transitionPath = aStarPathfinding(
          currentPosition,
          targetPosition,
          PREDEFINED_OBSTACLES
        );

        console.log(`🔄 Actor ${actor.id}: Transición de "${currentRoute.name}" a "${scheduledRoute.name}"`);
        console.log(`   Posición actual: (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)})`);
        console.log(`   Destino: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)})`);
        console.log(`   Puntos de transición: ${transitionPath.length}`);

        // Crear objeto de transición
        const transition: RouteTransition = {
          isTransitioning: true,
          transitionPath: transitionPath,
          fromRoute: currentRoute,
          toRoute: scheduledRoute,
          progress: 0,
          targetReached: false
        };

        return {
          ...actor,
          currentTransition: transition,
          cursor: 0, // Cursor de transición comienza en 0
          direction: 1 // Siempre hacia adelante en transiciones
        };
      })
    );

    setActiveRouteId(scheduledRoute.id);
  }
}, [simTimeSec, editing, activeRouteId, stageDims.w, stageDims.h, setActorStates]);
*/


  useEffect(() => {
  const active = running && !editing && !actorsLoading && actorStates.length > 0;
  if (!active) return;

  let raf = 0;
  let last = performance.now();

  const tick = (now: number) => {
    const dtReal = (now - last) / 1000;
    last = now;
    const dtSim = dtReal * speedMult;

    let nextSimTime = simTimeRef.current + dtSim;

    if (LOOP_DAY) {
    nextSimTime = nextSimTime % SIM_DAY_SECONDS;
  } else {
    if (nextSimTime >= SIM_DAY_SECONDS) {
      nextSimTime = SIM_DAY_SECONDS;
    }
  }
  // Actualizamos ref + estado (para UI)
  simTimeRef.current = nextSimTime;
  setSimTimeSec(nextSimTime);

  const logicalSimTime = nextSimTime;

    // 🔑 ACTUALIZAR ACTORES (transiciones Y movimiento normal)
  setActorStates(prevStates =>
    prevStates.map(actor => {
      // 1) Tareas y transiciones actuales
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

      // 2) Si no tiene transición ni tarea corriendo, intentar arrancar una
      if (!hasTransition && !hasRunningTask) {
        const nextTask = getNextTaskForActor(actor.id, logicalSimTime);

        if (nextTask && nextTask.type === 'followRoute' && nextTask.payload?.routeId) {
          const targetRouteId = nextTask.payload.routeId;
          const targetRoute = PREDEFINED_ROUTES.find(r => r.id === targetRouteId);

          if (targetRoute) {
            // 🔹 Definir posición actual en coordenadas NORMALIZADAS
            let currentPosition: Point;

            // 🅰️ Caso 1: actor estacionado en parking (lo que queremos para los camiones)
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
              // 🅱️ Caso 2: actor ya viene siguiendo una ruta (grúa u otros móviles)
              const currentRoute = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
              if (!currentRoute) {
                // no podemos calcular origen, dejamos el actor como está
                return actor;
              }

              const currentPathPx = buildPathPx(currentRoute.points, stageDims.w, stageDims.h);
              if (currentPathPx.total === 0) {
                return actor;
              }

              const pose = poseAlongPath(currentPathPx, actor.cursor);
              currentPosition = {
                x: pose.x / stageDims.w,
                y: pose.y / stageDims.h,
              };
            }

            const transitionPath = aStarPathfinding(
              currentPosition,
              targetRoute.points[0],   // inicio de la ruta asignada al truck
              PREDEFINED_OBSTACLES
            );

            // Si por algún motivo no hay path, no hacemos nada
            if (!transitionPath || transitionPath.length === 0) {
              return actor;
            }

            // Marcar la tarea como "running"
            updateTaskStatus(nextTask.id, 'running');

            const transition: RouteTransition = {
              isTransitioning: true,
              transitionPath,
              fromRoute: PREDEFINED_ROUTES.find(r => r.id === actor.routeId) || targetRoute,
              toRoute: targetRoute,
              progress: 0,
              targetReached: false
            };

            return {
              ...actor,
              behavior: 'mobile',        // el camión pasa a móvil
              currentTransition: transition,
              cursor: 0,
              direction: 1
            };
          }
        }
        // ⚠️ Si no hay tarea, o no hay ruta, o falló algo arriba, seguimos con la lógica de abajo
        // sin cambiar el actor aquí (no devolvemos todavía)
      }

      // 3) Si está en transición, manejamos CASO 1
      if (actor.currentTransition?.isTransitioning) {
        const transition = actor.currentTransition;
        const transitionPathPx = buildPathPx(transition.transitionPath, stageDims.w, stageDims.h);
        
        if (transitionPathPx.total === 0) {
          console.warn('⚠️ Path de transición vacío, finalizando transición');
          return {
            ...actor,
            currentTransition: undefined,
            routeId: transition.toRoute.id,
            cursor: 0,
            direction: 1
          };
        }

        const SPEED = stageDims.w * 0.02; // Velocidad para transiciones
        let newCursor = actor.cursor + (SPEED * dtSim);
        
        // 🔑 Si llegó al final de la transición
        if (newCursor >= transitionPathPx.total) {
  console.log(`✅ Actor ${actor.id}: Transición completada`);

  const parkingSlotId = (transition as any).parkingSlotId as string | undefined;

  if (parkingSlotId) {
    // 🔹 Es una transición hacia un slot de carga
    // 1) Liberar el slot anterior (si existía y es distinto)
    if (actor.parkingSlotId && actor.parkingSlotId !== parkingSlotId) {
      for (const zone of PARKING_ZONES) {
        const slot = zone.slots.find(s => s.id === actor.parkingSlotId);
        if (slot) {
          slot.occupied = false;
          break;
        }
      }
    }
    let targetSlot: { x: number; y: number; rotation?: number } | undefined;
    for (const zone of PARKING_ZONES) {
      const slot = zone.slots.find(s => s.id === parkingSlotId);
      if (slot) {
        targetSlot = slot;
        slot.occupied = true; // 👈 aquí sí marcamos ocupado
        break;
      }
    }

    // Marcar la tarea followRoute como completada
    setTasks(prev =>
      prev.map(t =>
        t.actorId === actor.id &&
        t.type === 'followRoute' &&
        t.status === 'running'
          ? { ...t, status: 'completed' }
          : t
      )
    );

    console.log(
      `🚛 Actor ${actor.id}: estacionado en slot ${parkingSlotId}`
    );

    return {
      ...actor,
      currentTransition: undefined,
      routeId: transition.toRoute.id, // sigue con la ruta lógica actual
      cursor: 0,
      direction: 0,
      behavior: 'stationary',
      parkingSlotId: parkingSlotId,
      parkingPosition: targetSlot
        ? {
            x: targetSlot.x,
            y: targetSlot.y,
            rotation: targetSlot.rotation ?? actor.parkingPosition?.rotation ?? 0,
          }
        : actor.parkingPosition,
    };
  }

  // 🔹 Caso anterior: transición normal (no parking)
  return {
    ...actor,
    currentTransition: undefined,
    routeId: transition.toRoute.id,
    cursor: 0,
    direction: 1,
  };
}

        // Continuar transición
        return {
          ...actor,
          cursor: newCursor,
          currentTransition: {
            ...transition,
            progress: newCursor / transitionPathPx.total,
            targetReached: newCursor > transitionPathPx.total * 0.95
          }
        };
      }

      // 4) Si NO está en transición y sigue siendo 'stationary' y sin tarea running → NO lo muevas en la ruta
      if (actor.behavior === 'stationary' && !runningFollowRouteTask) {
        return actor;
      }

      // 5) CASO 2: Movimiento normal (ruta)
      const actorRoute = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
      if (!actorRoute) {
        console.warn(`⚠️ Actor ${actor.id} tiene routeId inválido: ${actor.routeId}`);
        return actor;
      }

      const actorPathPx = buildPathPx(actorRoute.points, stageDims.w, stageDims.h);
      if (actorPathPx.total === 0) {
        console.warn(`⚠️ Ruta "${actorRoute.name}" no tiene puntos válidos`);
        return actor;
      }

      const SPEED = stageDims.w * 0.03 * actor.speed;

      // 🅰️ Caso: el actor tiene una tarea followRoute en ejecución
      if (runningFollowRouteTask) {
        // Avanza SIEMPRE hacia adelante, sin rebote
        const newCursor = actor.cursor + SPEED * dtSim;

        // Si llegó (o pasó) el final de la ruta
        if (newCursor >= actorPathPx.total) {
          // Punto final de la ruta en coordenadas normalizadas
          const routeEnd: Point =
            actorRoute.points[actorRoute.points.length - 1];

          // Buscar zona de carga
          const loadZone = PARKING_ZONES.find(z => z.id === 'zone-load');

          const freeSlots = loadZone
            ? loadZone.slots.filter(s => !s.occupied)
            : [];

          // Si no hay slots libres, se queda al final de la ruta y completa tarea
          if (!loadZone || freeSlots.length === 0) {
            setTasks(prev =>
              prev.map(t =>
                t.id === runningFollowRouteTask.id
                  ? { ...t, status: 'completed' }
                  : t
              )
            );

            console.log(
              `⚠️ Actor ${actor.id}: sin slots libres en zone-load, se queda al final de la ruta`
            );

            return {
              ...actor,
              cursor: actorPathPx.total,
              direction: 0,
              behavior: 'stationary',
            };
          }

          // Elegir slot libre más cercano al fin de la ruta
          let bestSlot = freeSlots[0];
          let bestDist = Infinity;
          for (const slot of freeSlots) {
            const dx = slot.x - routeEnd.x;
            const dy = slot.y - routeEnd.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
              bestDist = d2;
              bestSlot = slot;
            }
          }

           // Crear path A* desde fin de ruta hasta el slot de carga
            const parkingPath = aStarPathfinding(
              routeEnd,
              { x: bestSlot.x, y: bestSlot.y },
              PREDEFINED_OBSTACLES
            );

            if (!parkingPath || parkingPath.length === 0) {
              // Si A* falla, al menos lo dejamos en el final de la ruta y completamos
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

          // Iniciar transición de ruta → slot de carga
          const parkingTransition: RouteTransition & { parkingSlotId?: string } = {
            isTransitioning: true,
            transitionPath: parkingPath,
            fromRoute: actorRoute,
            toRoute: actorRoute, // seguimos usando la misma ruta lógica
            progress: 0,
            targetReached: false,
            // 👇 metadata adicional (aunque RouteTransition no lo declare, TS lo tolera)
            parkingSlotId: bestSlot.id,
          };

          return {
            ...actor,
            currentTransition: parkingTransition as RouteTransition,
            cursor: 0,
            direction: 1,
            // sigue siendo 'mobile' mientras hace la transición al slot
          };
        }

        // Todavía no llega al final → sigue avanzando
        return {
          ...actor,
          cursor: newCursor,
          direction: 1,
        };
      }

      // 🅱️ Caso: sin followRoute en ejecución (ej: grúas u otros actores móviles "libres")
      if (actor.behavior !== 'mobile') {
        // actores estacionarios sin tarea en curso no se mueven
        return actor;
      }

      const currentDirection = actor.direction || 1;
      let newCursor = actor.cursor + (SPEED * dtSim * currentDirection);
      let newDirection = currentDirection;

      // Movimiento con rebote solo para estos actores "libres"
      if (newCursor >= actorPathPx.total) {
        newCursor = actorPathPx.total;
        newDirection = -1;
      } else if (newCursor <= 0) {
        newCursor = 0;
        newDirection = 1;
      }

      return {
        ...actor,
        cursor: newCursor,
        direction: newDirection,
      };
    })
  );
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
 }, [running, editing, actorStates.length, stageDims.w, stageDims.h, speedMult, actorsLoading , tasks, getNextTaskForActor ]);

 useEffect(() => {
  // Evitar duplicar tareas si el efecto se vuelve a disparar
  if (startupTasksCreatedRef.current) return;
  if (actorStates.length === 0) return;

  // Filtra los camiones que tienen slot asignado
  const trucksInParking = actorStates.filter(
    (a) => a.type === 'truck1' && a.parkingSlotId  // ajusta tipos si tienes truck2, truck3, etc.
  );

  if (trucksInParking.length === 0) return;

  let previousTaskId: string | undefined;

  trucksInParking.forEach((actor) => {
    try {
    const task = createFollowRouteTaskForTruck(
      actor.id,
      actor.type,
      actor.parkingSlotId!,
      {
        startAtSimTime: "00:00",
        dependsOn: previousTaskId ? [previousTaskId] : undefined,
      } 
    );
  
    

    addTask(task);
    previousTaskId = task.id;
    } catch (error) {
    console.error(`Error creando tarea para actor ${actor.id}:`, error);
    
  }
  });

  startupTasksCreatedRef.current = true;
}, [actorStates, addTask]);

 
  // Escala dinámica basada en el tamaño del stage
  const actorScale = useMemo(() => {
    const targetScale = stageDims.w * 0.00008;
    return Math.max(0.3, Math.min(1.2, targetScale));
  }, [stageDims.w]);

  // Click para añadir puntos (solo en dev + edición)
  const onStageClick = (e: any) => {
  if (!CAN_EDIT || !editing) return;
  if (e.evt?.button !== 0) return; // solo click izquierdo

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  // Pasar de coordenadas de pantalla -> coordenadas del mundo (sin zoom ni pan)
  const localPos = {
    x: (pointer.x - stagePosition.x) / stageScale,
    y: (pointer.y - stagePosition.y) / stageScale,
  };

  const point = toNorm(localPos.x, localPos.y, stageDims.w, stageDims.h);

  if (editMode === 'route') {
    setRoute((r: Point[]) => [...r, point]);
  } else {
    setObstacle((o: Point[]) => [...o, point]);
  }
};

  // Handler para guardar obstáculo
  const handleSaveObstacle = () => {
    if (obstacle.length < 3) {
      alert("El obstáculo debe tener al menos 3 puntos");
      return;
    }
    setShowSaveObstacleModal(true);
  };

  // Handler para guardar ruta
  const handleSaveRoute = () => {
    if (route.length < 2) {
      alert("La ruta debe tener al menos 2 puntos");
      return;
    }
    setShowSaveModal(true);
  };

  // 🆕 Información de ruta actual y horarios programados
  const scheduleDetails = getScheduleWithRouteDetails();

  function applyAvoidObstaclesToRoute(route: Point[]): Point[] {
  if (route.length < 2) return route;

  const safeRoute: Point[] = [route[0]];

  for (let i = 1; i < route.length; i++) {
    const start = safeRoute[safeRoute.length - 1];
    const end = route[i];

    // Encontrar un camino seguro entre start y end
    const segmentPath = aStarPathfinding(start, end, PREDEFINED_OBSTACLES);

    // segmentPath incluye start, así que evitamos duplicarlo
    safeRoute.push(...segmentPath.slice(1));
  }

  return safeRoute;
}

const mobileActors = actorStates.filter(a => a.behavior === 'mobile');
const stationaryActors = actorStates.filter(a => a.behavior === 'stationary');


  return (
    <div>
      <DevToolbar
        editing={editing}
        setEditing={setEditing}
        saveRoute={handleSaveRoute}
        clearRoute={clearRoute}
        loadRoute={loadRoute}
        resources={resources}
        setResources={setResources}
        resetClock={() => {
          setSimTimeSec(0);
        }}
        editMode={editMode}
        onEditModeChange={setEditMode}
        saveObstacle={handleSaveObstacle}
        clearObstacle={clearObstacle}
      />

      {/* Modal para guardar obstáculo */}
      {showSaveObstacleModal && (
        <SaveObstacleModal
          points={obstacle}
          onClose={() => setShowSaveObstacleModal(false)}
        />
      )}

      {/* Modal para guardar ruta */}
      {showSaveModal && (
        <SaveRouteModal
          points={route}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 260px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div ref={wrapRef} style={{ borderRadius: 8, overflow: 'hidden' }}>
          {actorsLoading && (
            <div style={{ 
              position: 'absolute', 
              top: 10, 
              left: 10, 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '5px 10px', 
              borderRadius: 4,
              zIndex: 1000
            }}>
              Cargando actores...
            </div>
          )}
          
          <Stage
            width={stageDims.w}
            height={stageDims.h}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePosition.x}
            y={stagePosition.y}
            onMouseDown={onStageClick}
            style={{ cursor: CAN_EDIT && editing ? 'crosshair' : 'default' }}
          >
            <BackgroundLayer w={stageDims.w} h={stageDims.h} bgImg={bgImg} scale={stageDims.scale} />
            <ObstaclesLayer
              w={stageDims.w}
              h={stageDims.h}
              obstacles={PREDEFINED_OBSTACLES}
              editingObstacle={editMode === 'obstacle' ? obstacle : undefined}
              editing={editing && editMode === 'obstacle'}
              canEdit={CAN_EDIT}
              setObstacle={setObstacle}
              showObstacles={editing && editMode === 'obstacle'} // 🆕 Mostrar solo en edición de obstáculos
            />
            <HUDLayer
              w={stageDims.w}
              clock={formatHM(simTimeSec)}
              shiftLabel={labelOf(currentShift)}
              resources={resources}
              activeCount={activeCount}
            />
            <RouteLayer
              w={stageDims.w}
              h={stageDims.h}
              route={route}
              editing={editing}
              canEdit={CAN_EDIT}
              setRoute={setRoute}
            />
                <ParkingSlotsLayer
                  stageWidth={stageDims.w}
                  stageHeight={stageDims.h}
                  showLabels={editing}
                />
           {/*
            <PalletSpawnPointsLayer
                stageWidth={stageDims.w}
                stageHeight={stageDims.h}
                showLabels={false}
                showEmptySlots={true}
              />
              */}
            <Layer>
  {actorStates.map(actor => {
    let pathToRender: PathPx;

    if (actor.currentTransition?.isTransitioning) {
      // 🔹 Caso 1: transición activa
      pathToRender = buildPathPx(
        actor.currentTransition.transitionPath,
        stageDims.w,
        stageDims.h
      );
    } else if (
      actor.parkingPosition &&
      actor.cursor === 0 &&
      !actor.currentTransition?.isTransitioning
    ) {
      // 🔹 Caso 2: actor en parking (idle, todavía no se ha movido)
      const parkingRoute: Point[] = [
        { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
        { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
      ];
      pathToRender = buildPathPx(parkingRoute, stageDims.w, stageDims.h);
    } else {
      // 🔹 Caso 3: movimiento por ruta normal
      const route = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
      if (!route) return null;
      pathToRender = buildPathPx(route.points, stageDims.w, stageDims.h);
    }

    return (
      <ActorShape
        key={actor.id}
        actor={actor}
        path={pathToRender}
        cursor={actor.cursor}
        scale={actorScale}
        editing={editing}
        stageWidth={stageDims.w}
        stageHeight={stageDims.h}
      />
    );
  })}
</Layer>

          </Stage>
        </div>

        <SimSidebar 
          simTimeSec={simTimeSec}
          speedMult={speedMult}
          onSpeedChange={setSpeedMult}
          resources={resources}
          currentShift={currentShift}
          selectedRouteId={activeRouteId}
          onRouteSelect={handleRouteSelect} 
        />
      </div>

      {/* 🆕 Panel de información mejorado con rutas del JSON */}
      <div style={{ 
  position: 'fixed', 
  bottom: 10, 
  right: 10, 
  background: 'white', 
  padding: 10, 
  border: '1px solid #ccc',
  borderRadius: 8,
  fontSize: '12px',
  maxWidth: 280
}}>
  <h4>📍 Estado de Rutas:</h4>
  
  {/* 🆕 Mostrar transiciones activas de los actores */}
  {actorStates.some(a => a.currentTransition?.isTransitioning) ? (
    <div style={{ background: '#fff3cd', padding: '5px', borderRadius: '4px', marginBottom: '8px' }}>
      {actorStates
        .filter(a => a.currentTransition?.isTransitioning)
        .map(actor => (
          <div key={actor.id} style={{ marginBottom: '8px' }}>
            <div><strong>🔄 {actor.id} transicionando...</strong></div>
            <div style={{ fontSize: '10px' }}>
              De: {actor.currentTransition?.fromRoute?.name}
            </div>
            <div style={{ fontSize: '10px' }}>
              A: {actor.currentTransition?.toRoute.name}
            </div>
            <div style={{ fontSize: '10px' }}>
              Progreso: {Math.round((actor.currentTransition?.progress || 0) * 100)}%
            </div>
            <div style={{ 
              background: '#007bff', 
              height: '4px', 
              borderRadius: '2px',
              marginTop: '4px',
              marginBottom: '4px'
            }}>
              <div style={{
                background: '#28a745',
                height: '100%',
                width: `${(actor.currentTransition?.progress || 0) * 100}%`,
                borderRadius: '2px',
                transition: 'width 0.1s'
              }} />
            </div>
          </div>
        ))}
    </div>
  ) : (
    <div>
      <strong>Ruta activa:</strong> {PREDEFINED_ROUTES.find(r => r.id === activeRouteId)?.name || 'N/A'}
    </div>
  )}
  
  <div>🚛 Estacionados: {stationaryActors.length}</div>
  <div>🏃 Móviles: {mobileActors.length}</div>
  <hr style={{ margin: '8px 0' }} />
  <div>Hora actual: {formatHM(simTimeSec)}</div>
  <hr style={{ margin: '8px 0' }} />
  <div>Horarios programados:</div>
  {scheduleDetails.map(({ schedule, route }) => (
    <div key={schedule.routeId} style={{ 
      fontSize: '10px', 
      opacity: route.id === activeRouteId ? 1 : 0.6,
      fontWeight: route.id === activeRouteId ? 'bold' : 'normal',
      padding: '2px 0'
    }}>
      {schedule.startTime} - {route.name}
    </div>
  ))}
</div>
    </div>
  );
}