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
import { createFollowRouteTaskForTruck, createFollowRouteTaskFromLoadSlot , createExitRouteTaskForTruck, createDistributionEntryTaskForTruck, 
  createDistributionExitTaskForTruck, createT1GoToCheckTask, createWaitTask, createT1EntryTaskForTruck, 
  createT1FinalCheckTaskForTruck, createT1ExitTaskForTruck ,createT2ReturnToParkingTask ,createT2EntryToT1T2SlotTask ,createT2ExitFromT1T2SlotTask
} from '../../utils/routes/scheduledRoutes';
import { usePallets, type EventoRecurso } from '../../hooks/usePallets';
import { PalletsLayer } from './layers/PalletsLayer';
import { PARKING_ZONES } from '../../types/parkingSlot';
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

import pallet_icon from '../../assets/Simulacion/PALLET.png'; 

type EditMode = 'route' | 'obstacle';

type BackendResponse = {
  // 🔹 Nueva API: toda la línea de tiempo unificada aquí
  linea_tiempo_recursos?: EventoRecurso[];

  // 🔹 Turno noche con sus métricas (pero sin línea de tiempo)
  turno_noche?: {
    turno_fin_real?: any;
    timeline?: any;
    ice_mixto?: any;
    ocupacion_recursos?: any;
    planificacion_detalle?: any;
    tiempos_espera_promedio?: any;
    porcentaje_operaciones_con_espera?: any;
    linea_tiempo_cuello_botella?: any;
    tasa_defectos?: any;
    [key: string]: any;
  };

  // 🔹 Turno día con métricas
  turno_dia?: {
    ocupacion_recursos?: any;
    metricas_turnos?: any;
    [key: string]: any;
  };

  // 🔹 Posible wrapper tipo { data: {...} }
  data?: any;

  [key: string]: any;
};

type DistributionTruckEntryEvent = {
  key: string;
  startAtSec: number;
};

type DistributionTruckExitEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
  endAtSec: number;
};

type T1TruckEntryEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
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

type TruckExitEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
  endAtSec: number;
};

type TruckExitMotion = {
  camionId: string;
  startSec: number;
  endSec: number;
  path: Point[];
};

type T1FinalCheckEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
  durationSec: number;
};

type T2EntryV2Event = {
  key: string;
  camionId: string;   // "E47"
  startAtSec: number; // hora_comienzo
};

type T2ExitEvent = {
  key: string;
  camionId: string;     // "E44"
  startAtSec: number;   // hora_comienzo
  endAtSec: number;     // hora_fin (opcional, por si quieres forzar hide)
};



function pickFreeSlotInT1T2Zone(actorStates: ActorState[]): string | undefined {
  const zone = PARKING_ZONES.find(z => z.id === 'zone-load-download-t1-t2');
  const slots = zone?.slots ?? [];
  if (!slots.length) return undefined;

  const occupied = new Set(
    actorStates
      .filter(a => !a.isExited && a.parkingSlotId)
      .map(a => a.parkingSlotId as string)
  );

  return slots.map(s => s.id).find(id => !occupied.has(id));
}

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

function getParkingSlotById(slotId: string) {
  for (const zone of PARKING_ZONES) {
    const slot = zone.slots.find(s => s.id === slotId);
    if (slot) return slot;
  }
  return undefined;
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
  const palletImg = useHTMLImage(toUrl(pallet_icon));

  // Dimensiones del Stage
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('route');
  const [showSaveObstacleModal, setShowSaveObstacleModal] = useState(false);
  const { obstacle, setObstacle, clearObstacle } = useObstacle([]);

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


  useEffect(() => {
    if (!CAN_EDIT) setEditing(false);
  }, []);

  const { route, setRoute, loadRoute, clearRoute } =
    useRoute(DEFAULT_ROUTE);

  const [activeRouteId, setActiveRouteId] = useState<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const initialRouteIdRef = useRef<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );


  const craneActorResourceMapRef = useRef<Map<string, number>>(new Map());
  const firedTruckMoveEventsRef = useRef<Set<string>>(new Set());

  const processedTruckExitKeysRef = useRef<Set<string>>(new Set());

  const truckExitMotionsRef = useRef<Map<string, TruckExitMotion>>(new Map());

  // Ya procesé este evento de slot_liberado
const processedSlotLiberadoKeysRef = useRef<Set<string>>(new Set());

// Camiones a los que YA les generé una tarea hacia la zona de carga
const queuedTruckIdsRef = useRef<Set<string>>(new Set());

const distributionTruckInitializedRef = useRef(false);

const processedDistributionEntryKeysRef = useRef<Set<string>>(new Set());
const processedDistributionExitKeysRef = useRef<Set<string>>(new Set());
const t1TruckInitializedRef = useRef(false);
const processedT1EntryKeysRef = useRef<Set<string>>(new Set());
const processedT1FinalCheckKeysRef = useRef<Set<string>>(new Set());
const lastT2T1T2SlotRef = useRef<Record<string, string>>({});
const processedT2ExitKeysRef = useRef<Set<string>>(new Set());


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
    root?.linea_tiempo_recursos;

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
    root?.linea_tiempo_recursos;

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
    root?.linea_tiempo_recursos;

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

  const truckT1IdsFromBackend = useMemo(() => {
  if (!backendResponse) return [];

  const root: any = (backendResponse as any).data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const ids: string[] = [];
  const seen = new Set<string>();

  linea.forEach((e: any) => {
    if (e?.recurso !== 'camion_t1') return;
    const id = String(e.id_recurso ?? '');
    if (!id) return;

    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });

  return ids;
}, [backendResponse]);

   const craneResourceIds = useMemo(() => {
    const linea = backendResponse?.linea_tiempo_recursos;
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

// 1. En la línea ~482, calcular el MÁXIMO de grúas entre todos los turnos
const actorCounts = useMemo<Record<ActorType, number>>(
  () => {
    // Tomamos el MÁXIMO entre todos los turnos
    const maxCranes = Math.max(
      resources.noche || 0,
      resources.turnoA || 0,
      resources.turnoB || 0
    );
    const backendCranes = craneResourceIds.length;

    const craneCount = Math.max(maxCranes, backendCranes || 1);

    return {
      truck1: truckIdsFromBackend.length || 26,
      truck2: 0,
      truck3: 0,
      truck4: 0,
      truckT1: truckT1IdsFromBackend.length || 1,
      truckDistribucion: 1,
      crane1: craneCount,
    };
  },
  [truckIdsFromBackend, resources.noche, resources.turnoA, resources.turnoB, craneResourceIds]
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
    truckT1IdsFromBackend
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
  const linea = backendResponse?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: CraneMovementEvent[] = [];
  console.log("linea", linea);

    linea
    .filter(
      (e: any) =>
        e?.recurso === 'grua' &&
        (
          e?.operacion === 'acomodo_pallet' ||
          e?.operacion === 'despacho_completo' ||
          e?.operacion === 'carga_pallet' ||
          e?.operacion === 'acomodo_staging_mixto' ||
          // 👇 NUEVO: eventos de carga a camión de distribución
          (typeof e?.operacion === 'string' &&
           e.operacion.toLowerCase().startsWith('grua_camion_distribucion'))
        ) &&
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
      } else if (e.operacion === 'acomodo_staging_mixto') {
        // "Acomodando pallet mixto MX571 (staging)"
        const match = label.match(
          /Acomodando\s+pallet\s+mixto\s+([A-Za-z0-9_-]+)/i
        );
        palletIdFromLabel = match?.[1];
      }  else if (
        typeof e.operacion === 'string' &&
        e.operacion.toLowerCase().includes('grua_camion_distribucion')
      ) {
        // Evento de carga del camión de distribución
        // No viene id de pallet en el label, usamos un id sintético estable
        palletIdFromLabel =
          `pallet-distrib-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;
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

const distributionTruckEntryEvents = useMemo<DistributionTruckEntryEvent[]>(() => {
  // 👇 igual que en truckQueue: soporta backendResponse.data o plano
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;

  console.log('[DistributionTruck] linea_tiempo_recursos (raw):', linea);

  if (!Array.isArray(linea)) return [];

  const events: DistributionTruckEntryEvent[] = [];

  linea
    .filter((e: any) => {
      // 👇 Lo hacemos un poco más tolerante con espacios y mayúsculas
      if (e?.recurso !== 'camion_distribucion') return false;
      if (typeof e?.operacion !== 'string') return false;

      const op = e.operacion.toLowerCase();
      return op.includes('camion_distribucion') && op.includes('entrada');
    })
    .forEach((e: any, idx: number) => {
      const startAtSec = parseHM(e.hora_comienzo);
      const key = `distribution-entry-${e.hora_comienzo}-${idx}`;

      events.push({
        key,
        startAtSec,
      });
    });

  events.sort((a, b) => a.startAtSec - b.startAtSec);

  console.log('[DistributionTruck] eventos de entrada parseados:', events);
  return events;
}, [backendResponse]);

const distributionTruckExitEvents = useMemo<DistributionTruckExitEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;

  if (!Array.isArray(linea)) return [];

  const events: DistributionTruckExitEvent[] = [];

  linea
    .filter((e: any) => {
      if (e?.recurso !== 'camion_distribucion') return false;
      if (typeof e?.operacion !== 'string') return false;

      const op = e.operacion.toLowerCase();
      // e.g. "camion_distribucion - salida"
      return op.includes('salida');
    })
    .forEach((e: any, idx: number) => {
      // 👉 Usamos hora_fin como momento en que debe irse
      const startAtSec = parseHM(e.hora_fin);
      const endAtSec = startAtSec + 120; // 

      const camionId = String(e.id_recurso ?? `camion_distribucion-${idx}`);
      const key = `distribution-exit-${camionId}-${e.hora_fin ?? e.hora_comienzo}-${idx}`;

      events.push({
        key,
        camionId,
        startAtSec,
        endAtSec,
      });
    });

  events.sort((a, b) => a.startAtSec - b.startAtSec);

  console.log('[DistributionTruck] eventos de salida parseados:', events);
  return events;
}, [backendResponse]);

useEffect(() => {
  if (distributionTruckInitializedRef.current) return;
  if (!actorStates.length) return;

  const exitSlot = getParkingSlotById('slot-exit-1');

  setActorStates(prev =>
    prev.map(a => {
      if (a.type !== 'truckDistribucion') return a;

      let parkingPosition = a.parkingPosition;
      let parkingSlotId = (a as any).parkingSlotId as string | undefined;

      if (exitSlot) {
        parkingPosition = {
          x: exitSlot.x,
          y: exitSlot.y,
          rotation: exitSlot.rotation,
        };
        parkingSlotId = exitSlot.id;
      }

      return {
        ...a,
        isExited: true,          // 👈 no se ve al inicio
        parkingPosition,         // 👈 está físicamente en slot-exit-1
        parkingSlotId,           // 👈 su slot lógico es slot-exit-1
      };
    })
  );

  distributionTruckInitializedRef.current = true;
}, [actorStates.length, setActorStates]);

useEffect(() => {
  if (!distributionTruckEntryEvents.length) return;
  if (!actorStates.length) return;

  distributionTruckEntryEvents.forEach(ev => {
    if (processedDistributionEntryKeysRef.current.has(ev.key)) return;

    // todavía no llega la hora del evento
    if (simTimeSec < ev.startAtSec) return;

    console.log(
      `[DistributionTruck] 🔔 Evento de entrada alcanzado a las ${formatHM(
        simTimeSec
      )}, programado para ${formatHM(ev.startAtSec)}`
    );

    // buscamos el actor truckDistribucion (aunque esté isExited = true)
    const actor = actorStates.find(a => a.type === 'truckDistribucion');

    if (!actor) {
      console.warn(
        '[DistributionTruck] ⚠️ No se encontró actor de tipo truckDistribucion en actorStates'
      );
      processedDistributionEntryKeysRef.current.add(ev.key);
      return;
    }

    console.log(
      '[DistributionTruck] Encontrado actor truckDistribucion:',
      actor.id,
      'isExited =',
      actor.isExited,
      'parkingSlotId =',
      actor.parkingSlotId,
      'parkingPosition =',
      actor.parkingPosition
    );

    // 1) Hacer visible el camión
    setActorStates(prev =>
      prev.map(a =>
        a.id === actor.id
          ? { ...a, isExited: false }
          : a
      )
    );

    // 2) Crear la tarea de entrada hacia slot-distribution-2
    try {
      const task = createDistributionEntryTaskForTruck(
        actor.id,
        actor.type,
        {
          startAtSimTime: formatHM(ev.startAtSec),
          targetSlotId: 'slot-distribution-2',
        }
      );

      addTask(task);
      processedDistributionEntryKeysRef.current.add(ev.key);

      console.log(
        `[DistributionTruck] ✅ Tarea de entrada creada para ${actor.id} → slot-distribution-2`
      );
    } catch (error) {
      console.error(
        '[DistributionTruck] ❌ Error creando tarea de entrada para camión de distribución',
        error
      );
      processedDistributionEntryKeysRef.current.add(ev.key);
    }
  });
}, [
  distributionTruckEntryEvents,
  simTimeSec,
  actorStates,
  addTask,
  setActorStates,
  formatHM, // si tu linter molesta, puedes quitarlo y poner // eslint-disable-line
]);

useEffect(() => {
  if (!distributionTruckExitEvents.length) return;
  if (!actorStates.length) return;

  distributionTruckExitEvents.forEach(ev => {
    // ya procesado
    if (processedDistributionExitKeysRef.current.has(ev.key)) return;

    // todavía no llega la hora de salida (según hora_fin)
    if (simTimeSec < ev.startAtSec) return;

    // Buscar el actor truckDistribucion correspondiente
    // Si hubiera varios, se podría matchear por ev.camionId; por ahora,
    // asumimos un solo camión de distribución
    const actor =
      actorStates.find(
        a =>
          a.type === 'truckDistribucion' &&
          (a.id === ev.camionId || !ev.camionId)
      ) || actorStates.find(a => a.type === 'truckDistribucion');

    if (!actor) {
      console.warn(
        '[DistributionTruck Exit] No se encontró actor truckDistribucion para evento',
        ev
      );
      processedDistributionExitKeysRef.current.add(ev.key);
      return;
    }

    // Slot actual del camión de distribución (normalmente slot-distribution-2
    // después de la entrada)
    const fromSlotId = (actor as any).parkingSlotId as string | undefined;

    // 👇 Solo permitimos salida si efectivamente está en la zona de distribución
    if (fromSlotId !== 'slot-distribution-2') {
      // Todavía no ha terminado de entrar → esperamos al próximo tick
      return;
    }

    const startSec = Math.max(simTimeSec, ev.startAtSec);

    try {
      const task = createDistributionExitTaskForTruck(
        actor.id,
        actor.type,
        {
          // usamos la hora del evento (hora_fin) como startAtSimTime
          startAtSimTime: formatHM(startSec),
          fromSlotId,
          targetSlotId: 'slot-distribution-1',
        }
      );

      addTask(task);
      processedDistributionExitKeysRef.current.add(ev.key);

      console.log(
        `[DistributionTruck Exit] ✅ Tarea de salida creada para ${actor.id} ` +
          `desde ${fromSlotId ?? 'desconocido'} hacia slot-distribution-1 ` +
          `a las ${formatHM(ev.startAtSec)}`
      );
    } catch (error) {
      console.error(
        '[DistributionTruck Exit] ❌ Error creando tarea de salida para camión de distribución',
        error
      );
      processedDistributionExitKeysRef.current.add(ev.key);
    }
  });
}, [
  distributionTruckExitEvents,
  simTimeSec,
  actorStates,
  addTask,
  formatHM,
]);

const t1TruckEntryEvents = useMemo<T1TruckEntryEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T1TruckEntryEvent[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'camion_t1') return;
    if (typeof e?.hora_comienzo !== 'string') return;

    const label = String(e.label ?? '').toLowerCase();
    if (!label.includes('entrada')) return;

    const camionId = String(e.id_recurso ?? `T1-${idx}`);
    const startAtSec = parseHM(e.hora_comienzo);
    const key = `t1-entry-${camionId}-${e.hora_comienzo}-${idx}`;

    events.push({ key, camionId, startAtSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);

useEffect(() => {
  if (t1TruckInitializedRef.current) return;
  if (!actorStates.length) return;

  const exitSlot = getParkingSlotById('slot-exit-t1-1'); 

  setActorStates(prev =>
    prev.map(a => {
      if (a.type !== 'truckT1') return a;

      let parkingPosition = a.parkingPosition;
      let parkingSlotId = (a as any).parkingSlotId as string | undefined;

      if (exitSlot) {
        parkingPosition = { x: exitSlot.x, y: exitSlot.y, rotation: exitSlot.rotation };
        parkingSlotId = exitSlot.id;
      }

      return {
        ...a,
        isExited: true,
        parkingPosition,
        parkingSlotId,
      };
    })
  );

  t1TruckInitializedRef.current = true;
}, [actorStates.length, setActorStates]);

useEffect(() => {
  if (!t1TruckEntryEvents.length) return;
  if (!actorStates.length) return;

  t1TruckEntryEvents.forEach(ev => {
    if (processedT1EntryKeysRef.current.has(ev.key)) return;
    if (simTimeSec < ev.startAtSec) return;

    // Busca el actor T1 con el mismo id del backend
    const actor = actorStates.find(a => a.type === 'truckT1' && a.id === ev.camionId)
      ?? actorStates.find(a => a.type === 'truckT1');

    if (!actor) {
      processedT1EntryKeysRef.current.add(ev.key);
      return;
    }

    // 1) Visible
    setActorStates(prev =>
      prev.map(a => (a.id === actor.id ? { ...a, isExited: false } : a))
    );

    // 2) Tarea de entrada (reusamos la función de distribución)
    try {
  // (A) elegir slot final libre en zone-load-download-t1-t2
 const checkSec = t1CheckDurationByTruckId.get(ev.camionId) ?? 0;

// 1) ir a checkpoint
const goCheck = createT1GoToCheckTask(actor.id, actor.type, {
  startAtSimTime: formatHM(ev.startAtSec),
  targetSlotId: 'slot-check-t1-1',
});
addTask(goCheck);

// 2) esperar chequeo (empieza cuando llega)
const wait = createWaitTask(actor.id, actor.type, {
  dependsOn: [goCheck.id],
  durationSec: checkSec,
});
addTask(wait);

// 3) ir a zona t1/t2 (SIN slot fijo)
const goZone = createT1EntryTaskForTruck(actor.id, actor.type, {
  dependsOn: [wait.id],
  // 👇 no targetSlotId
});
addTask(goZone);

processedT1EntryKeysRef.current.add(ev.key);

} catch (err) {
  console.error('[T1] Error creando cadena de tareas', err);
  processedT1EntryKeysRef.current.add(ev.key);
}

  });
}, [t1TruckEntryEvents, simTimeSec, actorStates, addTask, setActorStates, formatHM]);

const t1CheckDurationByTruckId = useMemo(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return new Map<string, number>();

  const map = new Map<string, number>();

  linea.forEach((e: any) => {
    if (e?.recurso !== 'chequeador') return;
    if (typeof e?.label !== 'string') return;

    const m = e.label.match(/camion_(T1-[A-Za-z0-9_-]+)/i);
    const camionId = m?.[1];
    if (!camionId) return;

    const durationSec = Math.max(0, (e.duracion_min ?? 0) * 60);
    map.set(camionId, durationSec);
  });

  return map;
}, [backendResponse]);

const t1FinalCheckEvents = useMemo<T1FinalCheckEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T1FinalCheckEvent[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'chequeador') return;
    if (typeof e?.hora_comienzo !== 'string') return;

    const label = String(e.label ?? '').toLowerCase();
    if (!label.includes('chequeo_final_t1_camion_')) return;

    const m = String(e.label ?? '').match(
      /chequeo_final_t1_camion_(T1-[A-Za-z0-9_-]+)/i
    );
    const camionId = m?.[1];
    if (!camionId) return;

    const startAtSec = parseHM(e.hora_comienzo);
    const durationSec = Math.max(0, (e.duracion_min ?? 0) * 60);

    const key = `t1-final-check-${camionId}-${e.hora_comienzo}-${idx}`;
    events.push({ key, camionId, startAtSec, durationSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);

useEffect(() => {
  if (!t1FinalCheckEvents.length) return;
  if (!actorStates.length) return;

  t1FinalCheckEvents.forEach(ev => {
    if (processedT1FinalCheckKeysRef.current.has(ev.key)) return;
    if (simTimeSec < ev.startAtSec) return;

    const actor =
      actorStates.find(a => a.type === 'truckT1' && a.id === ev.camionId) ??
      actorStates.find(a => a.type === 'truckT1');

    if (!actor) {
      processedT1FinalCheckKeysRef.current.add(ev.key);
      return;
    }

    // Debe estar en un slot de la zona T1/T2 para usar ruta por slot
    const fromSlotId = (actor as any).parkingSlotId as string | undefined;
    if (!fromSlotId || !fromSlotId.startsWith('slot-t1-t2-')) {
      // reintentar próximo tick
      return;
    }

    try {
      const startSec = Math.max(simTimeSec, ev.startAtSec);

      // 1) Ir desde slot-t1-t2-X hacia slot-check-t1-2 (ruta por slot)
      const goCheck = createT1FinalCheckTaskForTruck(actor.id, actor.type, {
        startAtSimTime: formatHM(startSec),
        fromSlotId,
        targetSlotId: 'slot-check-t1-2',
      });
      addTask(goCheck);

      // 2) Esperar chequeo (duración del evento)
      const wait = createWaitTask(actor.id, actor.type, {
        dependsOn: [goCheck.id],
        durationSec: ev.durationSec,
      });
      addTask(wait);

      const exitStartSec = startSec + ev.durationSec;

      const exit = createT1ExitTaskForTruck(actor.id, actor.type, {
        startAtSimTime: formatHM(exitStartSec),
        fromSlotId: 'slot-check-t1-2',
        targetSlotId: 'slot-exit-t1-1',
      });

      addTask(exit);

      processedT1FinalCheckKeysRef.current.add(ev.key);

      console.log(
        `[T1 Final Check] ✅ Cadena creada para ${actor.id}: ${fromSlotId} -> check2 (${ev.durationSec}s) -> salida`
      );
    } catch (err) {
      console.error('[T1 Final Check] ❌ Error creando cadena', err);
      processedT1FinalCheckKeysRef.current.add(ev.key);
    }
  });
}, [t1FinalCheckEvents, simTimeSec, actorStates, addTask, formatHM]);

type T2ReturnEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
};

const t2ReturnEvents = useMemo<T2ReturnEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T2ReturnEvent[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'camion_t2') return;
    if (typeof e?.hora_comienzo !== 'string') return;

    const op = String(e.operacion ?? '');

    // ✅ aceptar ambos tipos de arribo
    const isArriboSoloV1 = op === 't2_arribo_solo_v1';
    const isArriboFinal = op === 't2_arribo_final';
    if (!isArriboSoloV1 && !isArriboFinal) return;

    // ✅ "E71_arribo" -> "E71"
    // ✅ "E44_arribo_final" -> "E44"
    const raw = String(e.id_recurso ?? '');
    const camionId =
      raw.replace(/_arribo(_final)?$/i, '') || `E${idx}`;

    const startAtSec = parseHM(e.hora_comienzo);

    const key = `t2-arribo-${op}-${camionId}-${e.hora_comienzo}-${idx}`;

    events.push({ key, camionId, startAtSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);

const processedT2ReturnKeysRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!t2ReturnEvents.length) return;
  if (!actorStates.length) return;

  t2ReturnEvents.forEach(ev => {
    if (processedT2ReturnKeysRef.current.has(ev.key)) return;
    if (simTimeSec < ev.startAtSec) return;

    // ✅ T2 son truck1
    const actor =
      actorStates.find(a => a.type === 'truck1' && a.id === ev.camionId) ??
      actorStates.find(a => a.type === 'truck1' && a.id.includes(ev.camionId));

    if (!actor) {
      processedT2ReturnKeysRef.current.add(ev.key);
      return;
    }

    try {
      const startSec = Math.max(simTimeSec, ev.startAtSec);

      // 1) Hacer visible si venía "exited"
      if (actor.isExited) {
        setActorStates(prev =>
          prev.map(a => (a.id === actor.id ? { ...a, isExited: false } : a))
        );
      }

      // 2) Crear task de retorno (NO ocupar slot acá)
      const task = createT2ReturnToParkingTask(actor.id, actor.type, {
        startAtSimTime: formatHM(startSec),
        // si tu engine soporta targetSlotId, lo puedes agregar acá.
        // targetSlotId: 'slot-3',
      });

      addTask(task);
      processedT2ReturnKeysRef.current.add(ev.key);

      console.log(
        `[T2 Return solo v1] ✅ ${actor.id} retorno a parking a las ${formatHM(startSec)}`
      );
    } catch (err) {
      console.error('[T2 Return solo v1] ❌ Error creando retorno', err);
      processedT2ReturnKeysRef.current.add(ev.key);
    }
  });
}, [t2ReturnEvents, simTimeSec, actorStates, addTask, formatHM, setActorStates]);

const t2EntryV2Events = useMemo<T2EntryV2Event[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T2EntryV2Event[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'camion_t2') return;
    if (String(e?.operacion ?? '').toLowerCase() !== 't2 - entrada') return;
    if (typeof e?.hora_comienzo !== 'string') return;

    // label ejemplo: "T2 E47 v2"
    const label = String(e.label ?? '');
    const m = label.match(/\bT2\s+([A-Za-z0-9_-]+)\s+v(\d+)\b/i);
    if (!m) return;

    const camionId = m[1];
    const vuelta = parseInt(m[2], 10);
    if (!Number.isFinite(vuelta) || vuelta < 2) return;

    const startAtSec = parseHM(e.hora_comienzo);
    const key = `t2-entry-v${vuelta}-${camionId}-${e.hora_comienzo}-${idx}`;

    events.push({ key, camionId, startAtSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);

const t2ExitEvents = useMemo<T2ExitEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T2ExitEvent[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'camion_t2') return;
    if (typeof e?.operacion !== 'string') return;

    const op = e.operacion.toLowerCase();
    // "t2_carga_dia - salida"
    if (!op.includes('salida')) return;

    if (typeof e?.hora_comienzo !== 'string') return;

    const camionId =
      String(e.id_recurso ?? '').trim() ||
      (String(e.label ?? '').match(/\bT2\s+([A-Za-z0-9_-]+)/i)?.[1] ?? `E${idx}`);

    const startAtSec = parseHM(e.hora_comienzo);
    const endAtSec =
      typeof e?.hora_fin === 'string' ? parseHM(e.hora_fin) : startAtSec + (e.duracion_min ?? 0) * 60;

    const key = `t2-exit-${camionId}-${e.hora_comienzo}-${idx}`;

    events.push({ key, camionId, startAtSec, endAtSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);

useEffect(() => {
  if (!t2ExitEvents.length) return;
  if (!actorStates.length) return;

  t2ExitEvents.forEach(ev => {
    if (processedT2ExitKeysRef.current.has(ev.key)) return;

    // aún no llega la hora
    if (simTimeSec < ev.startAtSec) return;

    // T2 en tu sim son truck1 (como ya hiciste en retorno/entrada v2)
    const actor =
      actorStates.find(a => a.type === 'truck1' && a.id === ev.camionId) ??
      actorStates.find(a => a.type === 'truck1' && a.id.includes(ev.camionId));

    // si aún no existe el actor, reintenta hasta que pase la ventana
    if (!actor) {
      if (simTimeSec >= ev.endAtSec) processedT2ExitKeysRef.current.add(ev.key);
      return;
    }

    const slotIdNow = (actor as any).parkingSlotId as string | undefined;

const fromSlotId =
  slotIdNow?.startsWith('slot-t1-t2-')
    ? slotIdNow
    : lastT2T1T2SlotRef.current[actor.id];

    if (!fromSlotId) {
      // si el camión aún no “está estacionado” cuando llega la hora, reintenta
      if (simTimeSec >= ev.endAtSec) processedT2ExitKeysRef.current.add(ev.key);
      return;
    }

    try {
      const startSec = Math.max(simTimeSec, ev.startAtSec);

      // Si venía oculto por alguna razón, lo mostramos antes de sacarlo
      if (actor.isExited) {
        setActorStates(prev =>
          prev.map(a => (a.id === actor.id ? { ...a, isExited: false } : a))
        );
      }

      const task = createT2ExitFromT1T2SlotTask(
        actor.id,
        actor.type,
        {
          fromSlotId,
          startAtSimTime: formatHM(ev.endAtSec),
        }
      );

      addTask(task);
      processedT2ExitKeysRef.current.add(ev.key);

      console.log(
        `[T2 Exit] ✅ ${actor.id} sale desde ${fromSlotId} a las ${formatHM(startSec)}`
      );
    } catch (err) {
      console.error('[T2 Exit] ❌ Error creando salida', ev, err);
      processedT2ExitKeysRef.current.add(ev.key);
    }
  });
}, [t2ExitEvents, simTimeSec, actorStates, addTask, formatHM, setActorStates]);


const processedT2EntryV2KeysRef = useRef<Set<string>>(new Set());

// offset acumulado por camión (segundos de espera)
const truckDelaySecRef = useRef<Map<string, number>>(new Map());

function getTruckDelaySec(camionId: string) {
  return truckDelaySecRef.current.get(camionId) ?? 0;
}
function addTruckDelaySec(camionId: string, deltaSec: number) {
  const prev = truckDelaySecRef.current.get(camionId) ?? 0;
  truckDelaySecRef.current.set(camionId, prev + Math.max(0, deltaSec));
}

useEffect(() => {
  if (!t2EntryV2Events.length) return;
  if (!actorStates.length) return;

  const reviveSlot = getParkingSlotById('slot-exit-1') ?? getParkingSlotById('slot-exit-t1-1');

  t2EntryV2Events.forEach(ev => {
    if (processedT2EntryV2KeysRef.current.has(ev.key)) return;

    const plannedStart = ev.startAtSec + getTruckDelaySec(ev.camionId);
    if (simTimeSec < plannedStart) return;

    const actor =
      actorStates.find(a => a.type === 'truck1' && a.id === ev.camionId) ??
      actorStates.find(a => a.type === 'truck1' && a.id.includes(ev.camionId));

    if (!actor) {
      // ojo: acá NO lo marques procesado si el actor aún no existe
      // porque si el engine crea actores tarde, te lo “comes”.
      return;
    }

    // 1) asegurar visible + con posición/slot si venía exited
    if (actor.isExited || !(actor as any).parkingSlotId) {
      setActorStates(prev =>
        prev.map(a => {
          if (a.id !== actor.id) return a;

          const next: any = { ...a, isExited: false };

          // si no tiene slot, lo “revivimos” en un slot staging (fuera de la operación)
          if (!(a as any).parkingSlotId && reviveSlot) {
            next.parkingSlotId = reviveSlot.id;
            next.parkingPosition = {
              x: reviveSlot.x,
              y: reviveSlot.y,
              rotation: reviveSlot.rotation,
            };
          }

          return next;
        })
      );
    }

    // 2) buscar slot libre en zona t1/t2
    const freeSlotId = pickFreeSlotInT1T2Zone(actorStates);
    if (!freeSlotId) {
      // no hay slot -> esperar (no marcar procesado)
      return;
    }

    // 3) delay acumulado por espera real
    const waitedSec = Math.max(0, simTimeSec - plannedStart);
    if (waitedSec > 0) addTruckDelaySec(ev.camionId, waitedSec);

    // 4) crear task
    try {
      const task = createT2EntryToT1T2SlotTask(actor.id, actor.type, {
        startAtSimTime: formatHM(simTimeSec),
        targetSlotId: freeSlotId,
      });

      addTask(task);
      processedT2EntryV2KeysRef.current.add(ev.key);

      console.log(
        `[T2 v2+] ✅ ${actor.id} entra a ${freeSlotId} @ ${formatHM(simTimeSec)} (esperó ${Math.round(waitedSec/60)}m)`
      );
    } catch (err) {
      console.error('[T2 v2+] ❌ Error creando task', err);
      processedT2EntryV2KeysRef.current.add(ev.key);
    }
  });
}, [t2EntryV2Events, simTimeSec, actorStates, addTask, formatHM, setActorStates]);
/*
const t1TruckExitEvents = useMemo<T1TruckExitEvent[]>(() => {
  const root: any = (backendResponse as any)?.data ?? backendResponse;
  const linea: EventoRecurso[] | undefined = root?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: T1TruckExitEvent[] = [];

  linea.forEach((e: any, idx: number) => {
    if (e?.recurso !== 'camion_t1') return;
    if (typeof e?.hora_comienzo !== 'string') return;

    const label = String(e.label ?? '').toLowerCase();
    const op = String(e.operacion ?? '').toLowerCase();

    const isExit =
      label.includes('salida') || op.includes('salida') || op === 't1_h0_h3';

    if (!isExit) return;

    const camionId = String(e.id_recurso ?? `T1-${idx}`);
    const startAtSec = parseHM(e.hora_comienzo);
    const key = `t1-exit-${camionId}-${e.hora_comienzo}-${idx}`;

    events.push({ key, camionId, startAtSec });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [backendResponse]);  

const processedT1ExitKeysRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!t1TruckExitEvents.length) return;
  if (!actorStates.length) return;

  t1TruckExitEvents.forEach(ev => {
    if (processedT1ExitKeysRef.current.has(ev.key)) return;
    if (simTimeSec < ev.startAtSec) return;

    const actor =
      actorStates.find(a => a.type === 'truckT1' && a.id === ev.camionId) ??
      actorStates.find(a => a.type === 'truckT1');

    if (!actor) {
      processedT1ExitKeysRef.current.add(ev.key);
      return;
    }

    // Ya salió
    if (actor.isExited) {
      processedT1ExitKeysRef.current.add(ev.key);
      return;
    }

    const fromSlotId = (actor as any).parkingSlotId as string | undefined;

    // 👇 Regla: SOLO sale desde chequeo final
    if (fromSlotId !== 'slot-check-t1-2') {
      // No lo procesamos aún → reintentar en el próximo tick
      return;
    }

    try {
      const startSec = Math.max(simTimeSec, ev.startAtSec);

      const task = createT1ExitTaskForTruck(actor.id, actor.type, {
        startAtSimTime: formatHM(startSec),
        fromSlotId: 'slot-check-t1-2',
        targetSlotId: 'slot-exit-t1-1',
      });

      addTask(task);
      processedT1ExitKeysRef.current.add(ev.key);

      console.log(
        `[T1 Exit] ✅ ${actor.id} slot-check-t1-2 -> slot-exit-t1-1 a las ${formatHM(startSec)}`
      );
    } catch (err) {
      console.error('[T1 Exit] ❌ Error creando tarea de salida', err);
      processedT1ExitKeysRef.current.add(ev.key);
    }
  });
}, [t1TruckExitEvents, simTimeSec, actorStates, addTask, formatHM]);

*/
type TruckMoveEvent = {
  key: string;
  camionId: string;
  startAtSec: number;
  endAtSec: number;
};

const truckMoveEvents = useMemo<TruckMoveEvent[]>(() => {
  const linea = backendResponse?.linea_tiempo_recursos;
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

const truckExitEvents = useMemo<TruckExitEvent[]>(() => {
  const linea = backendResponse?.linea_tiempo_recursos;
  if (!Array.isArray(linea)) return [];

  const events: TruckExitEvent[] = [];

  linea
    .filter(
      (e: any) =>
        e?.recurso === 'camion_operacion' &&
        e?.operacion === 'salida_camion' &&
        typeof e?.hora_comienzo === 'string'
    )
    .forEach((e: any, idx: number) => {
      const label = String(e.label ?? '');

      // "Salida camión E78 - Vuelta 1"
      const matchTruck = label.match(/Camión\s+([A-Za-z0-9_-]+)/i);
      const camionId = matchTruck?.[1];
      if (!camionId) return;

      const startAtSec = parseHM(e.hora_comienzo);
      const durationSec = (e.duracion_min ?? 0) * 60 || 60; // 60s por defecto
      const endAtSec = startAtSec + durationSec;

      const key = `exit-truck-${camionId}-${e.hora_comienzo}-${idx}`;

      events.push({
        key,
        camionId,
        startAtSec,
        endAtSec,
      });
    });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  console.log('[TruckExitEvents]', events);
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
  if (!truckExitEvents.length) return;
  if (!actorStates.length) return;

  truckExitEvents.forEach(ev => {
    // ya procesado
    if (processedTruckExitKeysRef.current.has(ev.key)) return;

    // todavía no llega la hora de salida
    if (simTimeSec < ev.startAtSec) return;

    const actor = actorStates.find(
      a =>
        (a.type === 'truck1' || a.type === 'truck2') &&
        a.id === ev.camionId
    );

    if (!actor) {
      console.warn(
        '[TruckExit] No se encontró actor para camión',
        ev.camionId
      );
      processedTruckExitKeysRef.current.add(ev.key);
      return;
    }

    const parkingSlotId = (actor as any).parkingSlotId as string | undefined;
    if (!parkingSlotId) {
      console.warn(
        '[TruckExit] Camión sin parkingSlotId al salir',
        ev.camionId
      );
      processedTruckExitKeysRef.current.add(ev.key);
      return;
    }

    try {
      const task = createExitRouteTaskForTruck(
        actor.id,
        actor.type,
        parkingSlotId,
        {
          startAtSimTime: formatHM(simTimeSec),
        }
      );

      addTask(task);
      processedTruckExitKeysRef.current.add(ev.key);

      console.log(
        `[TruckExit] ✅ Creada tarea de salida para camión ${ev.camionId} desde ${parkingSlotId} a las ${formatHM(
          simTimeSec
        )}`
      );
    } catch (error) {
      console.error(
        '[TruckExit] Error creando tarea de salida para camión',
        ev.camionId,
        error
      );
      processedTruckExitKeysRef.current.add(ev.key);
    }
  });
}, [truckExitEvents, simTimeSec, actorStates, addTask, formatHM]);

useEffect(() => {
  if (!actorStates?.length) return;

  actorStates.forEach((a) => {
    // ⚠️ ajusta si tu type real para T2 no es "truck2"
    if (a.type !== 'truck2') return;

    const slotId = (a as any).parkingSlotId as string | undefined;

    // guardamos SOLO si está realmente en un slot-t1-t2-*
    if (slotId && slotId.startsWith('slot-t1-t2-')) {
      lastT2T1T2SlotRef.current[a.id] = slotId;
    }
  });
}, [actorStates]);


useEffect(() => {
  if (!actorStates.length) return;

  setActorStates(prevStates => {
    if (!prevStates.length) return prevStates;

    return prevStates.map(actor => {
      // solo camiones
      if (actor.type !== 'truck1' && actor.type !== 'truck2') {
        return actor;
      }

      const motion = truckExitMotionsRef.current.get(actor.id);
      if (!motion) return actor;

      const { startSec, endSec, path } = motion;

      if (!path.length) {
        truckExitMotionsRef.current.delete(actor.id);
        return actor;
      }

      // si aún no empieza, no tocamos nada
      if (simTimeSec < startSec) {
        return actor;
      }

      // si ya terminó, lo dejamos en el último punto y opcionalmente podríamos "desaparecerlo"
      if (simTimeSec >= endSec) {
        const lastPoint = path[path.length - 1];

        const basePos = actor.parkingPosition ?? {
          x: lastPoint.x,
          y: lastPoint.y,
          rotation: 0,
        };

        // aquí podrías marcarlo como fuera de servicio si quieres
        return {
          ...actor,
          parkingPosition: {
            ...basePos,
            x: lastPoint.x,
            y: lastPoint.y,
          },
        };
      }

      // interpolación dentro del path
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

      const basePos = actor.parkingPosition ?? { x, y, rotation: 0 };

      return {
        ...actor,
        parkingPosition: {
          ...basePos,
          x,
          y,
        },
      };
    });
  });
}, [simTimeSec, setActorStates, actorStates.length]);


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

function getTruckNormPositionForPallet(
  p: RuntimePallet,
  actorStates: ActorState[]
): Point | null {
  if (!p.dropOnTruck || !p.dropTruckId) return null;

  const actor = actorStates.find(
    (a) =>
      (a.type === 'truck1' ||
       a.type === 'truck2' ||
       a.type === 'truckDistribucion') &&   // 👈 NUEVO
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

        // ya lo está moviendo alguna grúa
        if (
          Array.from(craneMotionsRef.current.values()).some(
            m => m.palletId === p.id
          )
        ) {
          return false;
        }

        const assignedResourceId = palletResourceMap[p.id];

        // 🔹 Caso 1: el pallet está asociado a un id_recurso concreto (backend)
        if (assignedResourceId != null && resourceIdForActor != null) {
          return assignedResourceId === resourceIdForActor;
        }

        // 🔹 Caso 2: pallet SIN mapping (ej: abastecimiento, descarga distribución)
        //     → lo puede tomar cualquier grúa libre
        return true;
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

    try {
      let task;

      // 🔍 Si el camión está en un slot de CARGA (slot-load-X) → volver a parking
      if (currentSlotId.startsWith('slot-load-')) {
        task = createFollowRouteTaskFromLoadSlot(
          actor.id,
          actor.type,
          currentSlotId, // 👈 usamos el slot REAL donde está
          {
            startAtSimTime: formatHM(simTimeSec),
          }
        );
      } else {
        // 🚛 Si está en un slot de PARKING (slot-X normal) → ir a zona de carga
        task = createFollowRouteTaskForTruck(
          actor.id,
          actor.type,
          currentSlotId,
          {
            startAtSimTime: formatHM(simTimeSec),
          }
        );
      }

      addTask(task);
      firedTruckMoveEventsRef.current.add(ev.key);

      console.log(
        `[TruckMove] ✅ Creada tarea para camión ${ev.camionId} desde slot ${currentSlotId} a las ${formatHM(
          simTimeSec
        )}`
      );
    } catch (error) {
      console.error(
        '[TruckMove] Error creando tarea de movimiento para camión',
        ev.camionId,
        'slotId=',
        currentSlotId,
        error
      );
      firedTruckMoveEventsRef.current.add(ev.key);
    }
  });
}, [truckMoveEvents, simTimeSec, actorStates, addTask, formatHM]);

const visibleActors = useMemo(() => {
  const currentShift = shiftForSecond(simTimeSec);
  const activeCranes = resources[currentShift] || 0;
  
  return actorStates.filter(a => {
    if (a.isExited) return false;
    
    // Si es una grúa, solo mostramos las primeras N según el turno
    if (a.type === 'crane1') {
      const cranes = actorStates
        .filter(actor => actor.type === 'crane1')
        .sort((x, y) => x.id.localeCompare(y.id));
      
      const craneIndex = cranes.findIndex(c => c.id === a.id);
      return craneIndex < activeCranes;
    }
    
    return true;
  });
}, [actorStates, simTimeSec, resources]);

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
              showSlots={editing}
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
              {visibleActors.map(actor => {
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
      
    </div>
  );
}