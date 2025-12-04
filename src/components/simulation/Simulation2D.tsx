import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Image as KonvaImage } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './modals/SaveRouteModal';
import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import type { Point, ShiftResources } from '../../types';
import type { PathPx } from '../../utils/path';
import type { ActorState, ActorType } from '../../types/actors';
import { CAN_EDIT } from '../../utils/env';
import { buildPathPx, toNorm } from '../../utils/path';
import { formatHM, shiftForSecond, shiftLabel as labelOf , parseHM } from '../../utils/time';
import { PREDEFINED_ROUTES } from '../../utils/routes/routes';
import { useHTMLImage } from '../../hooks/useHTMLImage';
import { useStageSize } from '../../hooks/useStageSize';
import { useRoute } from '../../hooks/useRoute';
import { useObstacle } from '../../hooks/useObstacle';
import { PREDEFINED_OBSTACLES } from '../../utils/routes/obstacles';
import { aStarPathfinding } from '../../utils/routes/pathfinding';
import { createFollowRouteTaskForTruck, createFollowRouteTaskFromLoadSlot } from '../../utils/routes/scheduledRoutes';
import { usePallets, type EventoRecurso } from '../../hooks/usePallets';
import { PalletsLayer } from './layers/PalletsLayer';
import PalletSpawnPointsLayer from './layers/PalletSpawnPointsLayer';
import ParkingSlotsLayer from './layers/ParkingSlotLayer';
import SaveObstacleModal from './modals/SaveObstacleModal';
import ObstaclesLayer from './layers/ObstaclesLayer';
import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorShape from './layers/ActorsLayer';
import DevToolbar from './DevToolbar';
import { useSimulationEngine } from '../../hooks/useSimulationEngine';
import { PALLET_SPAWN_POINTS } from '../../types/pallets';
import type { RuntimePallet } from '../../types/pallets';

import grua_horquilla from '../../assets/Simulacion/GRUA_HORQUILLA.png';
import pallet_icon from '../../assets/Simulacion/PALLET.png'; 



type EditMode = 'route' | 'obstacle';

type BackendResponse = {
  turno_noche?: { linea_tiempo_recursos?: EventoRecurso[]; [key: string]: any };
  turno_dia?: { linea_tiempo_recursos?: EventoRecurso[]; [key: string]: any };
  [key: string]: any;
};

type Props = {
  running?: boolean;
  resources?: Partial<ShiftResources>;
  backendResponse?: BackendResponse | null;
};

const DEFAULT_ROUTE: Point[] = [
  { x: 0.06, y: 0.76 },
  { x: 0.94, y: 0.76 },
];

type TruckQueueItem = {
  camionId: string;
  arrivalSec: number; // hora de ingreso (segundos desde 00:00)
  order: number;
};

type SlotLiberadoEvent = {
  key: string;
  startAtSec: number; // cuando se libera un slot
  order: number;
};


const toUrl = (m: any) => (typeof m === 'string' ? m : m?.src || '');

  function getSlotNormPosition(
    zoneId: string | null | undefined,
    slotId: string | null | undefined
  ) {
    if (!zoneId || !slotId) {
      return { x: 0, y: 0 };
    }

    const zone = PALLET_SPAWN_POINTS.find(z => z.id === zoneId);
    const slot = zone?.slots?.find(s => s.id === slotId);

    if (!slot) {
      return { x: 0, y: 0 };
    }

    // slot.x / slot.y están en [0,1]
    return { x: slot.x, y: slot.y };
  }



export default function Simulation2D({
  running = true,
  resources: resourcesProp,
  backendResponse
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startupTasksCreatedRef = useRef(false);

  // Imágenes
  const bgImg = useHTMLImage(toUrl(BG_IMPORT));
  const craneImg = useHTMLImage(toUrl(grua_horquilla));
  const palletImg = useHTMLImage(toUrl(pallet_icon));

  // Dimensiones del Stage
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('route');
  const [showSaveObstacleModal, setShowSaveObstacleModal] = useState(false);
  const { obstacle, setObstacle, clearObstacle } = useObstacle([]);

  const craneMotionRef = useRef<{
    palletId: string;
    startSec: number;
    endSec: number;
    path: Point[];
  } | null>(null);

  const craneHandledPalletsRef = useRef<Set<string>>(new Set());

    // 🔹 Movimiento actual por grúa (key: actor.id)
  type CraneMotion = {
    eventKey: string;
    resourceId: number;
    palletId: string;
    startSec: number;
    endSec: number;
    path: Point[];
    pickupIndex: number;
  };

  const craneMotionsRef = useRef<Map<string, CraneMotion>>(new Map());

  const craneHandledEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!CAN_EDIT) setEditing(false);
  }, []);

  const { route, setRoute, saveRoute, loadRoute, clearRoute } =
    useRoute(DEFAULT_ROUTE);

  const [activeRouteId, setActiveRouteId] = useState<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const initialRouteIdRef = useRef<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const [showPalletSpawnPoints, setShowPalletSpawnPoints] = useState(false);

  const craneActorResourceMapRef = useRef<Map<string, number>>(new Map());
  const firedTruckMoveEventsRef = useRef<Set<string>>(new Set());

  // Ya procesé este evento de slot_liberado
const processedSlotLiberadoKeysRef = useRef<Set<string>>(new Set());

// Camiones a los que YA les generé una tarea hacia la zona de carga
const queuedTruckIdsRef = useRef<Set<string>>(new Set());

  // Recursos por turno (UI)
  const [resources, setResources] = useState<ShiftResources>({
    noche: 0,
    turnoA: 0,
    turnoB: 0,
  });

  useEffect(() => {
    if (!resourcesProp) return;
    setResources(prev => ({
      noche: Math.max(0, Math.floor(resourcesProp.noche ?? prev.noche)),
      turnoA: Math.max(0, Math.floor(resourcesProp.turnoA ?? prev.turnoA)),
      turnoB: Math.max(0, Math.floor(resourcesProp.turnoB ?? prev.turnoB)),
    }));
  }, [resourcesProp]);

  const truckQueue = useMemo<TruckQueueItem[]>(() => {
  if (!backendResponse) return [];

  const root: any = (backendResponse as any).data ?? backendResponse;
  const linea: EventoRecurso[] | undefined =
    root?.turno_noche?.linea_tiempo_recursos;

  if (!Array.isArray(linea)) return [];

  const items: TruckQueueItem[] = [];
  let order = 0;

  linea.forEach((e: any) => {
    if (
      e?.recurso === 'camion_operacion' &&
      e?.operacion === 'ingreso_camion_operaciones' &&
      typeof e?.hora_comienzo === 'string'
    ) {
      const label = String(e.label ?? '');
      const match = label.match(/Camión\s+([A-Za-z0-9_-]+)/i);
      const camionId = match?.[1];
      if (!camionId) return;

      const arrivalSec = parseHM(e.hora_comienzo);

      items.push({
        camionId,
        arrivalSec,
        order: order++,
      });
    }
  });

  // Ordenamos por hora de ingreso y, en empate, por orden de aparición
  items.sort((a, b) => {
    if (a.arrivalSec !== b.arrivalSec) {
      return a.arrivalSec - b.arrivalSec;
    }
    return a.order - b.order;
  });

  return items;
}, [backendResponse]);

const slotLiberadoEvents = useMemo<SlotLiberadoEvent[]>(() => {
  if (!backendResponse) return [];

  const root: any = (backendResponse as any).data ?? backendResponse;
  const linea: EventoRecurso[] | undefined =
    root?.turno_noche?.linea_tiempo_recursos;

  if (!Array.isArray(linea)) return [];

  const events: SlotLiberadoEvent[] = [];
  let order = 0;

  linea.forEach((e: any) => {
    if (
      e?.recurso === 'camiones_operacion' &&
      e?.operacion === 'slot_liberado' &&
      typeof e?.hora_comienzo === 'string'
    ) {
      const startAtSec = parseHM(e.hora_comienzo);
      const key = `slot-liberado-${e.id_recurso}-${e.hora_comienzo}-${order}`;

      events.push({
        key,
        startAtSec,
        order: order++,
      });
    }
  });

  events.sort((a, b) => {
    if (a.startAtSec !== b.startAtSec) {
      return a.startAtSec - b.startAtSec;
    }
    return a.order - b.order;
  });

  return events;
}, [backendResponse]);

const first16TruckIds = useMemo(
  () => new Set(truckQueue.slice(0, 16).map(t => t.camionId)),
  [truckQueue]
);

// Resto de camiones que van a la cola dinámica
const queuedTrucksAfter16 = useMemo(
  () => truckQueue.slice(16),
  [truckQueue]
);


const truckIdsFromBackend = useMemo(() => {
  if (!backendResponse) return [];

  // Soporta ambos formatos: { data: { turno_noche }} o { turno_noche } directo
  const root: any = (backendResponse as any).data ?? backendResponse;
  const linea: EventoRecurso[] | undefined =
    root?.turno_noche?.linea_tiempo_recursos;

  if (!Array.isArray(linea)) return [];

  const ids: string[] = [];
  const seen = new Set<string>();

  // Recorremos linea_tiempo_recursos en el ORDEN en que viene del backend
  linea.forEach((e: any) => {
    let camionId: string | undefined;

    // 2) (Opcional) Evento de "camion_operacion" si lo estás registrando en el backend:
    //    label tipo: "Camión E44 ingresa a operaciones (slot X)"
    if (
      !camionId &&
      e?.recurso === 'camion_operacion' &&
      e?.operacion === 'ingreso_camion_operaciones'
    ) {
      const label = String(e.label ?? '');
      const match = label.match(/Camión\s+([A-Za-z0-9_-]+)/i);
      camionId = match?.[1];
    }

    if (!camionId) return;

    // Solo agregamos la PRIMERA vez que aparece ese camion_id
    if (!seen.has(camionId)) {
      seen.add(camionId);
      ids.push(camionId);
    }
  });

  return ids;
}, [backendResponse]);



   const craneResourceIds = useMemo(() => {
    const linea = backendResponse?.turno_noche?.linea_tiempo_recursos;
    if (!Array.isArray(linea)) return [];

    const ids = new Set<number>();

    linea.forEach((ev: any) => {
      if (ev?.recurso === 'grua' && ev?.operacion === 'acomodo_pallet') {
        const raw = ev.id_recurso;
        const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
        if (!Number.isNaN(n)) {
          ids.add(n);
        }
      }
    });

    return Array.from(ids).sort((a, b) => a - b);
  }, [backendResponse]);

 // Configuración de actores
const actorCounts = useMemo<Record<ActorType, number>>(
  () => {
    const requestedCranes = resources.noche || 0;
    const backendCranes = craneResourceIds.length;

    // Queremos al menos una grúa si hay tareas,
    // y no menos grúas que ids de recurso (para mapear 1 a 1)
    const craneCount = Math.max(requestedCranes, backendCranes || 1);

    return {
      truck1: truckIdsFromBackend.length || 26,
      truck2: 0,
      truck3: 0,
      truck4: 0,
      crane1: craneCount,
    };
  },
  [truckIdsFromBackend, resources.noche, craneResourceIds]
);

  // Engine de simulación (tiempo + actores + tareas + parking)
  const {
    simTimeSec,
    speedMult,
    setSpeedMult,
    addTask,
    actorStates,
    setActorStates,
    actorsLoading,
  } = useSimulationEngine({
    running,
    editing,
    actorCounts,
    initialRouteId: initialRouteIdRef.current,
    stageWidth: stageDims.w,
    stageHeight: stageDims.h,
    truckIdsFromBackend,
  });

    // 🔹 Tipo local: evento de movimiento de pallet manejado por una grúa concreta
  type CraneMovementEvent = {
    key: string;          // identificador único del evento
    resourceId: number;   // id_recurso de la grúa
    palletId: string;
    startAtSec: number;
    endAtSec: number;
  };

  const craneMovementEvents = useMemo<CraneMovementEvent[]>(() => {
  const linea = backendResponse?.turno_noche?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: CraneMovementEvent[] = [];

  linea
    .filter(
      (e: any) =>
        e?.recurso === 'grua' &&
        (e?.operacion === 'acomodo_pallet' ||
          e?.operacion === 'despacho_completo' ||
          e?.operacion === 'carga_pallet') &&        // 👈 NUEVO
        typeof e?.hora_comienzo === 'string'
    )
    .forEach((e: any) => {
      const label = String(e.label ?? '');

      let palletIdFromLabel: string | undefined;

      if (e.operacion === 'acomodo_pallet') {
        // "Acomodando pallet MX25"
        const match = label.match(
          /Acomodando\s+pallet\s+([A-Za-z0-9_-]+)/i
        );
        palletIdFromLabel = match?.[1];
      } else if (e.operacion === 'despacho_completo') {
        // "Despachando pallet completo CP18"
        const match = label.match(
          /Despachando\s+pallet\s+completo\s+([A-Za-z0-9_-]+)/i
        );
        palletIdFromLabel = match?.[1];
      } else if (e.operacion === 'carga_pallet') {
        // "Cargando pallet CP17 - Camión E45"
        const match = label.match(
          /Cargando\s+pallet\s+([A-Za-z0-9_-]+)/i
        );
        palletIdFromLabel = match?.[1];
      }

      const palletId =
        palletIdFromLabel ??
        `pallet-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;

      const startAtSec = parseHM(e.hora_comienzo);
      const endAtSec = startAtSec + (e.duracion_min ?? 0) * 60;

      const raw = e.id_recurso;
      const resourceId =
        typeof raw === 'number' ? raw : parseInt(String(raw), 10);

      if (Number.isNaN(resourceId)) return;

      const key = `crane-${resourceId}-${e.hora_comienzo}-${palletId}-${e.operacion}`;

      events.push({
        key,
        resourceId,
        palletId,
        startAtSec,
        endAtSec,
      });
    });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse, parseHM]);

type TruckMoveEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
  endAtSec: number;
};

const truckMoveEvents = useMemo<TruckMoveEvent[]>(() => {
  const linea = backendResponse?.turno_noche?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: TruckMoveEvent[] = [];

  linea
    .filter(
      (e: any) =>
        e?.recurso === 'patio' &&
        e?.operacion === 'salida_parking' &&
        typeof e?.hora_comienzo === 'string'
    )
    .forEach((e: any) => {
      const label = String(e.label ?? '');

      // "Moviendo camión E80"
      const matchTruck = label.match(/Camión\s+([A-Za-z0-9_-]+)/i);
      const camionId = matchTruck?.[1];
      if (!camionId) return;

      const startAtSec = parseHM(e.hora_comienzo);
      const endAtSec = startAtSec + (e.duracion_min ?? 0) * 60;
      const key = `move-truck-${camionId}-${e.hora_comienzo}`;

      events.push({
        key,
        camionId,
        startAtSec,
        endAtSec,
      });
    });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  console.log('[TruckMoveEvents]', events);
  return events;
}, [backendResponse, parseHM]);

  // 🔹 palletId -> resourceId según la línea de tiempo del backend
const palletResourceMap = useMemo(() => {
  const map: Record<string, number> = {};
  craneMovementEvents.forEach(ev => {
    // si un pallet aparece varias veces, te quedas con el último o el primero (a elección)
    if (map[ev.palletId] == null) {
      map[ev.palletId] = ev.resourceId;
    }
  });

  return map;
}, [craneMovementEvents]);


  // Selección manual de ruta para visualización / edición
  const handleRouteSelect = (routeId: string) => {
    if (editing) {
      alert('Termina de editar la ruta actual primero');
      return;
    }

    const selectedRoute = PREDEFINED_ROUTES.find(r => r.id === routeId);
    if (selectedRoute) {
      console.log(`🎯 Ruta seleccionada manualmente: "${selectedRoute.name}"`);
      setActiveRouteId(routeId);

      const safePoints = applyAvoidObstaclesToRoute(selectedRoute.points);
      setRoute(safePoints);

      // Opcional: actualizar ruta de actores móviles si quieres que sigan esta ruta
      setActorStates(prevStates =>
        prevStates.map(actor => {
          if (actor.behavior === 'mobile') {
            return {
              ...actor,
              routeId: routeId,
              cursor: 0,
              direction: 1,
            };
          }
          return actor;
        })
      );
    }
  };

  // Shift actual y recursos activos
  const currentShift = useMemo(
    () => shiftForSecond(simTimeSec),
    [simTimeSec]
  );
  const activeCount = useMemo(
    () => Math.min(20, Math.max(0, resources[currentShift])),
    [resources, currentShift]
  );

  // 🧠 Tareas iniciales para camiones en parking (solo IDs del backend)
    // 🧠 Tareas iniciales SOLO para los primeros 16 camiones (entran inmediatamente)
  useEffect(() => {
    if (startupTasksCreatedRef.current) return;
    if (actorStates.length === 0) return;

    // IDs que vienen del backend
    const backendIdSet = new Set(truckIdsFromBackend);
    if (backendIdSet.size === 0) return;

    console.log('[Startup Tasks] truckIdsFromBackend:', truckIdsFromBackend);

    const trucksInParking = actorStates.filter(
      a =>
        a.type === 'truck1' &&
        a.parkingSlotId &&
        backendIdSet.has(a.id)
    );

    console.log(
      '[Startup Tasks] actorStates truck1 IDs:',
      trucksInParking.map(a => a.id)
    );

    // 👉 Solo los primeros 16 (según cola de tiempo)
    const immediateTruckIds =
      first16TruckIds.size > 0
        ? trucksInParking
            .filter(a => first16TruckIds.has(a.id))
            .map(a => a.id)
        : trucksInParking.map(a => a.id); // fallback, por si no hay datos de ingreso

    const immediateTrucks = trucksInParking.filter(a =>
      immediateTruckIds.includes(a.id)
    ).slice(0, 16);

    console.log(
      `[Startup Tasks] Camiones que entran inmediatamente:`,
      immediateTrucks.map(a => a.id)
    );

    if (immediateTrucks.length === 0) return;

    let previousTaskId: string | undefined;

    immediateTrucks.forEach(actor => {
      try {
        const task = createFollowRouteTaskForTruck(
          actor.id,
          actor.type,
          actor.parkingSlotId!,
          {
            startAtSimTime: '00:00',
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
  }, [actorStates, addTask, truckIdsFromBackend, first16TruckIds]);

  useEffect(() => {
  if (!slotLiberadoEvents.length) return;
  if (!actorStates.length) return;

  // Para debug
  // console.log('[TruckQueue] slotLiberadoEvents', slotLiberadoEvents);
  // console.log('[TruckQueue] queuedTrucksAfter16', queuedTrucksAfter16);

  slotLiberadoEvents.forEach(ev => {
    // Ya gestioné este evento
    if (processedSlotLiberadoKeysRef.current.has(ev.key)) {
      return;
    }

    // El evento aún no ha ocurrido en el tiempo simulado
    if (simTimeSec < ev.startAtSec) {
      return;
    }

    // 🔎 Buscamos el siguiente camión elegible:
    //  - Es uno de los "restantes" (no top 16)
    //  - Su hora de ingreso ya llegó
    //  - Aún no tiene tarea creada
    const candidate = queuedTrucksAfter16.find(t => {
      if (t.arrivalSec > simTimeSec) return false;
      if (queuedTruckIdsRef.current.has(t.camionId)) return false;
      return true;
    });

    if (!candidate) {
      // No hay camión listo todavía → NO marcamos este slot como procesado.
      // La próxima vez que corramos el efecto, volveremos a intentar.
      return;
    }

    // Buscamos el actor correspondiente en el parking
    const actor = actorStates.find(
      a =>
        (a.type === 'truck1' || a.type === 'truck2') &&
        a.id === candidate.camionId &&
        a.parkingSlotId
    );

    if (!actor) {
      console.warn(
        '[TruckQueue] No se encontró actor en parking para camión',
        candidate.camionId
      );
      // Lo marcamos como "ya encolado" para no reintentar eternamente
      queuedTruckIdsRef.current.add(candidate.camionId);
      processedSlotLiberadoKeysRef.current.add(ev.key);
      return;
    }

    try {
      // ⏱ Hora efectiva de inicio: max(hora de ingreso, tiempo actual)
      const startSec = Math.max(simTimeSec, candidate.arrivalSec);

      const task = createFollowRouteTaskForTruck(
        actor.id,
        actor.type,
        actor.parkingSlotId!,
        {
          startAtSimTime: formatHM(startSec),
        }
      );

      addTask(task);
      queuedTruckIdsRef.current.add(candidate.camionId);
      processedSlotLiberadoKeysRef.current.add(ev.key);

      console.log(
        `[TruckQueue] 🟢 Asignado camión ${candidate.camionId} a slot liberado (${formatHM(
          ev.startAtSec
        )}), startAtSimTime=${formatHM(startSec)}`
      );
    } catch (error) {
      console.error(
        '[TruckQueue] Error creando tarea para camión',
        candidate.camionId,
        error
      );
      queuedTruckIdsRef.current.add(candidate.camionId);
      processedSlotLiberadoKeysRef.current.add(ev.key);
    }
  });
}, [
  slotLiberadoEvents,
  queuedTrucksAfter16,
  simTimeSec,
  actorStates,
  addTask,
  formatHM,
]);


    // 🔹 Mapa palletId -> { startSec, endSec } basado en eventos de grúa
  const craneTransitOverrides = useMemo<
    Record<string, { startSec: number; endSec: number }>
  >(() => {
    const map: Record<string, { startSec: number; endSec: number }> = {};

    const APPROACH_FRACTION = 0.25;

    const startOffset = 5; // segundos
    const endOffset = -5;  // segundos

    for (const ev of craneMovementEvents) {
        if (map[ev.palletId]) continue;
      // Si ya existe una entrada, puedes decidir si sobrescribir solo si este
      // evento empieza antes o algo así; por ahora, el primero que entra gana.

      const durationSec = ev.endAtSec - ev.startAtSec;
      const approachTime = Math.max(0, durationSec * APPROACH_FRACTION);

      const palletStart = ev.startAtSec + approachTime;
      const palletEnd = ev.endAtSec; // o restarle un pequeño margen si quieres 

      map[ev.palletId] = {
        startSec: palletStart,
        endSec: palletEnd,
    };
    }

    return map;
  }, [craneMovementEvents]);

 // 🔹 Hook que genera pallets en temporary-zone según la línea de tiempo
  const { palletCountsBySlot, pallets } = usePallets({
    backendResponse,
    simTimeSec,
    actorStates,
    craneTransitOverrides,
  });


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

    const localPos = {
      x: (pointer.x ) ,
      y: (pointer.y ),
    };

    const point = toNorm(localPos.x, localPos.y, stageDims.w, stageDims.h);

    if (editMode === 'route') {
      setRoute((r: Point[]) => [...r, point]);
    } else {
      setObstacle((o: Point[]) => [...o, point]);
    }
  };

  // Guardar obstáculo
  const handleSaveObstacle = () => {
    if (obstacle.length < 3) {
      alert('El obstáculo debe tener al menos 3 puntos');
      return;
    }
    setShowSaveObstacleModal(true);
  };

  // Guardar ruta
  const handleSaveRoute = () => {
    if (route.length < 2) {
      alert('La ruta debe tener al menos 2 puntos');
      return;
    }
    setShowSaveModal(true);
  };

  useEffect(() => {
  if (!actorStates.length || !craneResourceIds.length) return;

  // Tomamos las grúas de la simulación y las ordenamos para tener un orden estable
  const cranes = actorStates
    .filter(a => a.type === 'crane1')
    .sort((a, b) => {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

  const map = new Map<string, number>();

  cranes.forEach((actor, idx) => {
    // Si tienes 4 grúas y resourceIds [1,2,3,4], mapea uno a uno
    // Si hay más grúas que ids, las extra usan un id "sintético"
    const resId = craneResourceIds[idx] ?? (idx + 1);
    map.set(actor.id, resId);
  });

  craneActorResourceMapRef.current = map;
}, [actorStates, craneResourceIds]);


  // Aplicar A* entre puntos de la ruta para evitar obstáculos
  function applyAvoidObstaclesToRoute(routePoints: Point[]): Point[] {
    if (routePoints.length < 2) return routePoints;

    const safeRoute: Point[] = [routePoints[0]];

    for (let i = 1; i < routePoints.length; i++) {
      const start = safeRoute[safeRoute.length - 1];
      const end = routePoints[i];

      const segmentPath = aStarPathfinding(start, end, PREDEFINED_OBSTACLES);
      safeRoute.push(...segmentPath.slice(1)); // evitar duplicar start
    }

    return safeRoute;
  }
 
  const mobileActors = actorStates.filter(a => a.behavior === 'mobile');
  const stationaryActors = actorStates.filter(a => a.behavior === 'stationary');

  function getTruckNormPositionForPallet(
  p: RuntimePallet,
  actorStates: ActorState[]
): Point | null {
  if (!p.dropOnTruck || !p.dropTruckId) return null;

  const actor = actorStates.find(
    (a) =>
      (a.type === 'truck1' || a.type === 'truck2') &&
      a.id === p.dropTruckId &&
      a.parkingPosition
  );

  if (!actor || !actor.parkingPosition) return null;

  return {
    x: actor.parkingPosition.x,
    y: actor.parkingPosition.y,
  };
}
 

const FORKLIFT_ANGLE_OFFSET = 90;
// 🔹 Movimiento de TODAS las grúas basado en pallets en tránsito (multi-grúa)
useEffect(() => {
  if (!actorStates.length) return;

  setActorStates(prevStates => {
    if (!prevStates.length) return prevStates;

    const nextStates = prevStates.map(actor => {
      if (actor.type !== 'crane1') {
        return actor;
      }

      const motionKey = actor.id;
      const motion = craneMotionsRef.current.get(motionKey);

      // 1) Si ya hay un movimiento activo para ESTA grúa → avanzar
      if (motion) {
        const { startSec, endSec, path, palletId } = motion;

        if (!path.length) {
          craneMotionsRef.current.delete(motionKey);
          return actor;
        }

        // Llegó al final del movimiento
        if (simTimeSec >= endSec) {
          const lastPoint = path[path.length - 1];

          craneMotionsRef.current.delete(motionKey);
          craneHandledPalletsRef.current.add(palletId);

          const basePos = actor.parkingPosition ?? {
            x: lastPoint.x,
            y: lastPoint.y,
            rotation: 0,
            
          };

          return {
            ...actor,
            parkingPosition: {
              ...basePos,
              x: lastPoint.x,
              y: lastPoint.y,
            },
          };
        }

        if (simTimeSec < startSec) {
          return actor;
        }

        // 🔹 Interpolación en el path
        const tRaw =
          (simTimeSec - startSec) / Math.max(endSec - startSec, 0.0001);
        const t = Math.min(1, Math.max(0, tRaw));

        const idxFloat = t * (path.length - 1);
        const idxLow = Math.floor(idxFloat);
        const idxHigh = Math.min(idxLow + 1, path.length - 1);
        const frac = idxFloat - idxLow;

        const pLow = path[idxLow];
        const pHigh = path[idxHigh];

        const x = pLow.x * (1 - frac) + pHigh.x * frac;
        const y = pLow.y * (1 - frac) + pHigh.y * frac;

        // 🔹 Calcular dirección (ángulo) de avance
        const dx = pHigh.x - pLow.x;
        const dy = pHigh.y - pLow.y;

        let rotation = actor.parkingPosition?.rotation ?? 0;
        if (dx !== 0 || dy !== 0) {
          const angleRad = Math.atan2(dy, dx); // y primero, x después
          const angleDeg = (angleRad * 180) / Math.PI;
          rotation = angleDeg + FORKLIFT_ANGLE_OFFSET;
        }

        const basePos = actor.parkingPosition ?? { x, y, rotation: 0 };

        return {
          ...actor,
          parkingPosition: {
            ...basePos,
            x,
            y,
            rotation,
          },
        };
      }

      // 2) Asignar nuevo pallet si no tiene movimiento activo
      //    👉 ahora respetando id_recurso del backend
      const resourceIdForActor =
        craneActorResourceMapRef.current.get(actor.id) ?? null;

      const pallet = pallets.find(p => {
        if (!p.inTransit) return false;
        if (craneHandledPalletsRef.current.has(p.id)) return false;
        if (
          Array.from(craneMotionsRef.current.values()).some(
            m => m.palletId === p.id
          )
        ) {
          return false;
        }

        // Debe existir un id_recurso asociado a este pallet en el backend
        const assignedResourceId = palletResourceMap[p.id];
        if (assignedResourceId == null) return false;
        if (resourceIdForActor == null) return false;

        // 🔹 La grúa sólo mueve pallets cuyo movimiento pertenece a su id_recurso
        return assignedResourceId === resourceIdForActor;
      });

      if (!pallet) {
        // No hay pallets en tránsito asignados a esta grúa en este momento
        return actor;
      }
      const startSec = pallet.transitStartSimSec ?? simTimeSec;
      const endSec =
        pallet.transitEndSimSec ?? (startSec + 60);

      const craneStart = actor.parkingPosition
        ? { x: actor.parkingPosition.x, y: actor.parkingPosition.y }
        : { x: 0.5, y: 0.5 };

      const fromPos = getSlotNormPosition(
        pallet.fromZoneId ?? pallet.zoneId,
        pallet.fromSlotId ?? pallet.slotId
      );

      // 👇 Si el pallet es de despacho completo, el destino es el camión
      const truckTarget =
        getTruckNormPositionForPallet(pallet as RuntimePallet, actorStates);

      const toPos =
        truckTarget ??
        getSlotNormPosition(
          pallet.toZoneId ?? pallet.zoneId,
          pallet.toSlotId ?? pallet.slotId
        );


      const leg1 = aStarPathfinding(craneStart, fromPos, PREDEFINED_OBSTACLES);
      const leg2 = aStarPathfinding(fromPos, toPos, PREDEFINED_OBSTACLES);

      let fullPath: Point[] = [];
      let pickupIndex = 0; // por defecto

      if (leg1 && leg1.length > 0) {
        fullPath = [...leg1];
        // 🔹 el pallet está al final del primer tramo (leg1)
        pickupIndex = Math.max(leg1.length - 1, 0);
      }
      if (leg2 && leg2.length > 0) {
        fullPath = [...fullPath, ...leg2.slice(1)];
      }

      if (!fullPath.length) {
        console.warn(
          '[Grúa] No se pudo generar path A* para pallet',
          pallet.id
        );
        craneHandledPalletsRef.current.add(pallet.id);
        return actor;
      }

      craneMotionsRef.current.set(motionKey, {
        eventKey: `pallet-${pallet.id}`,
        resourceId: 0,
        palletId: pallet.id,
        startSec,
        endSec,
        path: fullPath,
        pickupIndex, // 🔹 guardamos el índice de recogida
      });


      return actor;
    });

    return nextStates;
  });

}, [simTimeSec, pallets, setActorStates, actorStates.length]);

useEffect(() => {
  if (!truckMoveEvents.length) return;
  if (!actorStates.length) return;

  truckMoveEvents.forEach(ev => {
    // ya procesado
    if (firedTruckMoveEventsRef.current.has(ev.key)) return;

    // todavía no comienza según la línea de tiempo del backend
    if (simTimeSec < ev.startAtSec) return;

    // buscar el actor que representa a ese camión
    const actor = actorStates.find(
      a =>
        (a.type === 'truck1' || a.type === 'truck2') &&
        a.id === ev.camionId
    );

    if (!actor) {
      console.warn(
        '[TruckMove] No se encontró actor para camión',
        ev.camionId
      );
      firedTruckMoveEventsRef.current.add(ev.key);
      return;
    }

    const currentSlotId = (actor as any).parkingSlotId as string | undefined;
    if (!currentSlotId) {
      console.warn(
        '[TruckMove] Camión sin parkingSlotId',
        ev.camionId
      );
      firedTruckMoveEventsRef.current.add(ev.key);
      return;
    }

    // 📍 Extraemos el índice del slot (sirve tanto para "slot-5" como para "slot-load-5")
    const match = currentSlotId.match(/(\d+)$/);
    if (!match) {
      console.warn(
        '[TruckMove] parkingSlotId no tiene índice numérico:',
        currentSlotId,
        'camión',
        ev.camionId
      );
      firedTruckMoveEventsRef.current.add(ev.key);
      return;
    }

    const index = match[1];
    const loadSlotId = `slot-load-${index}`;

    console.log(
      `[TruckMove] camión ${ev.camionId} currentSlotId=${currentSlotId} -> loadSlotId=${loadSlotId}`
    );

        try {
      const task = createFollowRouteTaskFromLoadSlot(
        actor.id,
        actor.type,
        loadSlotId,
        {
          // ⏱ arranca ahora mismo según el reloj de la simulación
          startAtSimTime: formatHM(simTimeSec),
        }
      );

      addTask(task);
      firedTruckMoveEventsRef.current.add(ev.key);

      // 👇 Forzamos al actor a tomar esta ruta YA
      const routeId = (task as any).payload?.routeId;
      if (routeId) {
        setActorStates(prev =>
          prev.map(a => {
            if (a.id !== actor.id) return a;

            return {
              ...a,
              routeId,
              cursor: 0,
              direction: 1,
            };
          })
        );
      }

      console.log(
        `[TruckMove] ✅ Creada tarea followRoute desde ${loadSlotId} para camión ${ev.camionId} a las ${formatHM(
          simTimeSec
        )} con routeId=${routeId}`,
        task
      );
    } catch (error) {
      console.error(
        '[TruckMove] Error creando tarea de retorno para camión',
        ev.camionId,
        'loadSlotId=',
        loadSlotId,
        error
      );
      firedTruckMoveEventsRef.current.add(ev.key);
    }
  });
}, [truckMoveEvents, simTimeSec, actorStates, addTask, setActorStates]);


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
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: 4,
                zIndex: 1000,
              }}
            >
              Cargando actores...
            </div>
          )}

          <Stage
            width={stageDims.w}
            height={stageDims.h}
            onMouseDown={onStageClick}
            style={{ cursor: CAN_EDIT && editing ? 'crosshair' : 'default' }}
          >
            <BackgroundLayer
              w={stageDims.w}
              h={stageDims.h}
              bgImg={bgImg}
              scale={stageDims.scale}
            />

            <ObstaclesLayer
              w={stageDims.w}
              h={stageDims.h}
              obstacles={PREDEFINED_OBSTACLES}
              editingObstacle={editMode === 'obstacle' ? obstacle : undefined}
              editing={editing && editMode === 'obstacle'}
              canEdit={CAN_EDIT}
              setObstacle={setObstacle}
              showObstacles={editing && editMode === 'obstacle'}
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
              showSlots={true}
            />

            <PalletsLayer
              stageWidth={stageDims.w}
              stageHeight={stageDims.h}
              pallets={pallets}
            />
            
            <PalletSpawnPointsLayer
              stageWidth={stageDims.w}
              stageHeight={stageDims.h}
              showLabels={false}
              showEmptySlots={false}
              palletsCountsBySlot={palletCountsBySlot}
            />

            <Layer>
              {actorStates.map(actor => {
                let pathToRender: PathPx;

                if (actor.currentTransition?.isTransitioning) {
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
                  const parkingRoute: Point[] = [
                    { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
                    { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
                  ];
                  pathToRender = buildPathPx(
                    parkingRoute,
                    stageDims.w,
                    stageDims.h
                  );
                } else {
                  const actorRoute = PREDEFINED_ROUTES.find(
                    r => r.id === actor.routeId
                  );
                  if (!actorRoute) return null;
                  pathToRender = buildPathPx(
                    actorRoute.points,
                    stageDims.w,
                    stageDims.h
                  );
                }

                // 🔹 ¿está esta grúa moviendo un pallet según el ESTADO del pallet?
                // 🔹 Cálculo extra solo para grúas: ¿está esta grúa moviendo un pallet?
                let showCarriedPallet = false;

                if (actor.type === 'crane1') {
                  const motion = craneMotionsRef.current.get(actor.id);

                  if (motion) {
                    const runtimePallet = pallets.find(p => p.id === motion.palletId);

                    if (runtimePallet?.inTransit) {
                      const { startSec, endSec, path, pickupIndex } = motion;

                      if (path.length > 1 && simTimeSec >= startSec && simTimeSec <= endSec) {
                        const tRaw =
                          (simTimeSec - startSec) / Math.max(endSec - startSec, 0.0001);
                        const t = Math.min(1, Math.max(0, tRaw));

                        const idxFloat = t * (path.length - 1);

                        // 🔹 Solo mostramos el pallet DESPUÉS de llegar al pallet (fase 2)
                        if (idxFloat >= pickupIndex) {
                          showCarriedPallet = true;
                        }
                      }
                    }
                  }
                }



                // Posición actual de la grúa (normalizada)
                const xNorm = actor.parkingPosition?.x ?? 0.5;
                const yNorm = actor.parkingPosition?.y ?? 0.5;
                const rotationDeg = actor.parkingPosition?.rotation ?? 0;

                const xPx = xNorm * stageDims.w;
                const yPx = yNorm * stageDims.h;

                const palletPixelSize = 120 * actorScale; // tamaño del pallet
                const distanceForward = 28 * actorScale; // distancia desde el centro de la grúa

                const rotRad = (rotationDeg * Math.PI) / 180;
                const offsetXForward = Math.cos(rotRad) * distanceForward;
                const offsetYForward = Math.sin(rotRad) * distanceForward;

                const palletX = xPx + offsetXForward;
                const palletY = yPx + offsetYForward;

                return (
                  <Group key={actor.id}>
                    <ActorShape
                      actor={actor}
                      path={pathToRender}
                      cursor={actor.cursor}
                      scale={actorScale}
                      editing={editing}
                      stageWidth={stageDims.w}
                      stageHeight={stageDims.h}
                    />

                    {showCarriedPallet && palletImg && (
                      <KonvaImage
                        image={palletImg}
                        x={palletX}
                        y={palletY}
                        width={palletPixelSize}
                        height={palletPixelSize}
                        offsetX={palletPixelSize / 2}
                        offsetY={palletPixelSize / 2}
                        rotation={rotationDeg}
                      />
                    )}
                  </Group>
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

      {/* Panel de información de rutas */}
      <div
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'white',
          padding: 10,
          border: '1px solid #ccc',
          borderRadius: 8,
          fontSize: '12px',
          maxWidth: 280,
        }}
      >
       
        <div>🚛 Estacionados: {stationaryActors.length}</div>
        <div>🏃 Móviles: {mobileActors.length}</div>
        <hr style={{ margin: '8px 0' }} />
        <div>Hora actual: {formatHM(simTimeSec)}</div>
        
      </div>
    </div>
  );
}