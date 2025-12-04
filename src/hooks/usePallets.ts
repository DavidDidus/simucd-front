// src/hooks/usePallets.ts
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { PALLET_SPAWN_POINTS } from '../types/pallets';
import type { ActorState } from '../types/actors';
import type { RuntimePallet } from '../types/pallets';
import { aStarPathfinding } from '../utils/routes/pathfinding';
import { PREDEFINED_OBSTACLES } from '../utils/routes/obstacles';
import type { Point } from '../types';

export type EventoRecurso = {
  recurso: string;
  id_recurso: number;
  hora_comienzo: string;
  hora_fin: string;
  duracion_min: number;
  label: string;
  operacion: string;
};

type ParrilleroEvent = {
  id: string;
  camionId: string;
  startAtSec: number;
  endAtSec: number;
  palletsIniciales: number;
  palletsFinales: number;
};

// Estructuras mínimas para leer planificacion_detalle del backend
type PalletPlan = {
  mixto: boolean;
  cajas: number;
  id: string; // "MX25", "CP1", etc.
};

type CheckPalletEvent = {
  palletId: string;
  startAtSec: number;
  endAtSec: number;
};

type CamionPlan = {
  camion_id: string;
  pallets: PalletPlan[];
};

type PlanificacionDetalleEntry = [number, CamionPlan[]];

type TurnoNocheBackend = {
  linea_tiempo_recursos?: EventoRecurso[];
  planificacion_detalle?: PlanificacionDetalleEntry[];
};

type BackendResponseMaybeAxios = {
  data?: {
    turno_noche?: TurnoNocheBackend;
    turno_dia?: any;
    [key: string]: any;
  };
  turno_noche?: TurnoNocheBackend;
  turno_dia?: any;
  [key: string]: any;
};

type CranePalletEvent = {
    id: string;
    palletId: string;
    // camionId inicial según planificación (fallback)
    camionId: string | null;
    startAtSec: number; // cuando empieza a moverlo
    endAtSec: number;   // cuando debería haber llegado
    kind: 'acomodo' | 'despacho';
    operacion: 'acomodo_pallet' | 'despacho_completo' | 'carga_pallet';
    label: string;
  };

// Convierte "HH:MM" -> segundos
function hmToSeconds(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 3600 + m * 60;
}

type UsePalletsArgs = {
  backendResponse?: BackendResponseMaybeAxios | null;
  simTimeSec: number;
  actorStates?: ActorState[] | null;
  craneTransitOverrides?: Record<string, { startSec: number; endSec: number }>;
  
};

// Construye mapa palletId -> camion_id usando planificacion_detalle
function buildPalletToCamionMap(
  planificacion_detalle?: PlanificacionDetalleEntry[]
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(planificacion_detalle)) return map;

  for (const entry of planificacion_detalle) {
    const [, camiones] = entry; // ej: [1, [ { camion_id, pallets: [...] } ]]
    if (!Array.isArray(camiones)) continue;

    for (const camion of camiones) {
      const camionId = camion.camion_id;
      if (!camionId || !Array.isArray(camion.pallets)) continue;

      for (const pallet of camion.pallets) {
        if (!pallet?.id) continue;
        map[pallet.id] = camionId;
      }
    }
  }

  return map;
}

// Dado un camionId, busca en actorStates en qué slot está,
// y si es slot-load-X devuelve load-zone-X
function findLoadZoneForCamion(
  camionId: string | null,
  actorStates?: ActorState[] | null
): string | null {
  if (!camionId || !actorStates) return null;

  const actor = actorStates.find(
    (a) =>
      (a.type === 'truck1' || a.type === 'truck2') &&
      a.id === camionId
  );
  if (!actor) return null;

  const slotId = (actor as any).parkingSlotId as string | undefined;
  if (!slotId) return null;

  // Esperamos algo tipo "slot-load-1"
  const match = slotId.match(/slot-load-(\d+)/);
  if (!match) return null;

  const index = match[1]; // "1"
  return `load-zone-${index}`; // "load-zone-1"
}

export function usePallets({ backendResponse, simTimeSec, actorStates,craneTransitOverrides }: UsePalletsArgs) {
  const [pallets, setPallets] = useState<RuntimePallet[]>([]);
  const palletsRef = useRef<RuntimePallet[]>([]);

  useEffect(() => {
    palletsRef.current = pallets;
  }, [pallets]);


  // Para no disparar el mismo evento de pallet dos veces
  const firedEventsRef = useRef<Set<string>>(new Set());

  // Para no disparar el mismo evento de grúa dos veces
  const firedCraneEventsRef = useRef<Set<string>>(new Set());
  // Para saber qué eventos de grúa ya iniciaron el movimiento
  const startedCraneEventsRef = useRef<Set<string>>(new Set());

  // Para no disparar el mismo evento de parrillero dos veces
  const firedParrilleroEventsRef = useRef<Set<string>>(new Set());


  // 1) Normalizar datos del backend (SOLO turno_noche por ahora)
  const { lineaTiempoRecursos, palletToCamionMap } = useMemo(() => {
    if (!backendResponse) {
      return {
        lineaTiempoRecursos: [] as EventoRecurso[],
        palletToCamionMap: {} as Record<string, string>,
      };
    }

    const root: any = (backendResponse as any).data ?? backendResponse;
    const turnoNoche: TurnoNocheBackend | undefined | null =
      root?.turno_noche ?? null;

    const linea: EventoRecurso[] =
      turnoNoche?.linea_tiempo_recursos ?? [];

    const palletMap = buildPalletToCamionMap(
      turnoNoche?.planificacion_detalle
    );

    return {
      lineaTiempoRecursos: linea,
      palletToCamionMap: palletMap,
    };
  }, [backendResponse]);

  // 2) Interpretar los eventos del backend y convertirlos en "eventos de pallet"
  const palletEvents = useMemo(() => {
    const events = (lineaTiempoRecursos ?? [])
      .filter(
        (e) =>
          e.recurso === 'picker' &&
          e.operacion === 'picking_mixto' &&
          e.label.startsWith('Preparando pallet mixto')
      )
      .map((e) => {
        const fireAtSec = hmToSeconds(e.hora_comienzo) + e.duracion_min * 60;

        // Ejemplo label: "Preparando pallet mixto MX25 (44 cajas)"
        const match = e.label.match(
          /Preparando\s+pallet\s+mixto\s+([A-Za-z0-9_-]+)/
        );
        const palletIdFromLabel = match?.[1];

        const palletId =
          palletIdFromLabel ?? `pallet-${e.id_recurso}-${e.hora_fin}`;

        const camionId = palletToCamionMap[palletId] ?? null;

        return {
          palletId,
          fireAtSec,
          label: e.label,
          camionId,
        };
      });

    return events;
  }, [lineaTiempoRecursos, palletToCamionMap]);

    const checkPalletEvents = useMemo<CheckPalletEvent[]>(() => {
    const events = (lineaTiempoRecursos ?? [])
      .filter(
        (e) =>
          e.recurso === 'chequeador' &&
          e.operacion === 'chequeo_pallet' &&
          typeof e.hora_comienzo === 'string'
      )
      .map((e) => {
        // Ejemplo label: "Chequeando pallet MX553 (33 cajas)"
        const match = String(e.label ?? '').match(
          /Chequeando\s+pallet\s+([A-Za-z0-9_-]+)/i
        );
        const palletIdFromLabel = match?.[1];

        const palletId =
          palletIdFromLabel ??
          `pallet-chequeo-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;

        const startAtSec = hmToSeconds(e.hora_comienzo) + 60;
        const endAtSec = (startAtSec + (e.duracion_min ?? 0) * 60 ) ;

        return {
          palletId,
          startAtSec,
          endAtSec,
        };
      });

    // Ordenar por tiempo de inicio
    events.sort((a, b) => a.startAtSec - b.startAtSec);
    return events;
  }, [lineaTiempoRecursos]);

  const parrilleroEvents = useMemo<ParrilleroEvent[]>(() => {
  const events: ParrilleroEvent[] = [];

  (lineaTiempoRecursos ?? []).forEach((e) => {
    if (e.recurso !== 'parrillero') return;
    if (e.operacion !== 'ajuste_capacidad') return;
    if (!e.hora_comienzo || !e.hora_fin) return;

    const baseLabel = String(e.label ?? '');

    // Ejemplo label:
    // "Ajustando capacidad - Camión E71 - pallets iniciales: 17, finales: 12"
    const truckMatch = baseLabel.match(/Camión\s+([A-Za-z0-9_-]+)/i);
    const countsMatch = baseLabel.match(
      /pallets\s+iniciales:\s*(\d+)\s*,\s*finales:\s*(\d+)/i
    );

    const camionId = truckMatch?.[1];
    const iniciales = countsMatch ? parseInt(countsMatch[1], 10) : NaN;
    const finales = countsMatch ? parseInt(countsMatch[2], 10) : NaN;

    if (!camionId || Number.isNaN(iniciales) || Number.isNaN(finales)) {
      return;
    }

    const startAtSec = hmToSeconds(e.hora_comienzo);
    const endAtSec = hmToSeconds(e.hora_fin);

    events.push({
      id: `parrillero-${camionId}-${e.hora_comienzo}`,
      camionId,
      startAtSec,
      endAtSec,
      palletsIniciales: iniciales,
      palletsFinales: finales,
    });
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [lineaTiempoRecursos]);

  const cranePalletEvents = useMemo<CranePalletEvent[]>(() => {
  const events: CranePalletEvent[] = [];

  (lineaTiempoRecursos ?? []).forEach((e) => {
    if (e.recurso !== 'grua') return;
    if (!e.hora_comienzo) return;

    const baseLabel = e.label ?? '';
    const startAtSec = hmToSeconds(e.hora_comienzo);
    const endAtSec = startAtSec + (e.duracion_min ?? 0) * 60;

    // 👇 Acomodar pallet mixto a load-zone
    if (
      e.operacion === 'acomodo_pallet' &&
      baseLabel.toLowerCase().startsWith('acomodando pallet')
    ) {
      const match = baseLabel.match(
        /Acomodando\s+pallet\s+([A-Za-z0-9_-]+)/i
      );
      const palletIdFromLabel = match?.[1];
      const palletId =
        palletIdFromLabel ??
        `pallet-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;

      const camionId = palletToCamionMap[palletId] ?? null;

      events.push({
        id: `crane-${e.id_recurso}-${e.hora_comienzo}-${palletId}-acomodo`,
        palletId,
        camionId,
        startAtSec,
        endAtSec,
        kind: 'acomodo',
        operacion: 'acomodo_pallet',
        label: baseLabel,
      });
      return;
    }

    // 👇 Despacho de pallets completos desde zona "completo"
    if (
      e.operacion === 'despacho_completo' &&
      baseLabel.toLowerCase().startsWith('despachando pallet completo')
    ) {
      const match = baseLabel.match(
        /Despachando\s+pallet\s+completo\s+([A-Za-z0-9_-]+)/i
      );
      const palletIdFromLabel = match?.[1];
      const palletId =
        palletIdFromLabel ??
        `pallet-completo-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;

      const camionId = palletToCamionMap[palletId] ?? null;

      events.push({
        id: `crane-${e.id_recurso}-${e.hora_comienzo}-${palletId}-despacho`,
        palletId,
        camionId,
        startAtSec,
        endAtSec,
        kind: 'despacho',
        operacion: 'despacho_completo',
        label: baseLabel,
      });
      return;
    }

    // 👇 NUEVO: carga de pallets desde la load-zone al camión
    if (
      e.operacion === 'carga_pallet' &&
      baseLabel.toLowerCase().startsWith('cargando pallet')
    ) {
      // Ejemplo: "Cargando pallet CP17 - Camión E45"
      const matchPal = baseLabel.match(
        /Cargando\s+pallet\s+([A-Za-z0-9_-]+)/i
      );
      const matchTruck = baseLabel.match(/Camión\s+([A-Za-z0-9_-]+)/i);

      const palletIdFromLabel = matchPal?.[1];
      const camionIdFromLabel = matchTruck?.[1] ?? null;

      const palletId =
        palletIdFromLabel ??
        `pallet-carga-${e.id_recurso}-${e.hora_fin ?? e.hora_comienzo}`;

      const camionId =
        camionIdFromLabel ?? palletToCamionMap[palletId] ?? null;

      events.push({
        id: `crane-${e.id_recurso}-${e.hora_comienzo}-${palletId}-carga`,
        palletId,
        camionId,
        startAtSec,
        endAtSec,
        kind: 'despacho',              // 👈 para que se elimine al final
        operacion: 'carga_pallet',
        label: baseLabel,
      });
      return;
    }
  });

  events.sort((a, b) => a.startAtSec - b.startAtSec);
  return events;
}, [lineaTiempoRecursos, palletToCamionMap]);

  // 4) Función para generar un pallet en temporary-zone en un slot aleatorio
  const spawnPalletInTemporaryZone = useCallback(
    (params: {
      id: string;
      createdAtSimSec: number;
      label: string;
      camionAsignado: string | null;
    }) => {
      const tempZone = PALLET_SPAWN_POINTS.find(
        (z) => z.id === 'temporary-zone'
      );
      if (!tempZone) {
        console.warn(
          'usePallets: no se encontró la zona "temporary-zone" en PALLET_SPAWN_POINTS'
        );
        return;
      }

      if (!tempZone.slots || tempZone.slots.length === 0) {
        console.warn('usePallets: "temporary-zone" no tiene slots definidos');
        return;
      }

      const randomSlot =
        tempZone.slots[Math.floor(Math.random() * tempZone.slots.length)];

      const newPallet: RuntimePallet = {
        id: params.id,
        zoneId: tempZone.id,
        slotId: randomSlot.id,
        createdAtSimSec: params.createdAtSimSec,
        label: params.label,
        camionAsignado: params.camionAsignado,
      };

      setPallets((prev) => [...prev, newPallet]);
    },
    []
  );

  // 4) Efecto: cuando simTimeSec alcanza fireAtSec, generar pallet
  useEffect(() => {
    if (!palletEvents.length) return;

    palletEvents.forEach((ev) => {
      if (firedEventsRef.current.has(ev.palletId)) return;

      if (simTimeSec >= ev.fireAtSec) {
        spawnPalletInTemporaryZone({
          id: ev.palletId,
          createdAtSimSec: simTimeSec,
          label: ev.label,
          camionAsignado: ev.camionId,
        });

        firedEventsRef.current.add(ev.palletId);
      }
    });
  }, [simTimeSec, palletEvents, spawnPalletInTemporaryZone]);

  useEffect(() => {
  if (!cranePalletEvents.length) return;

  cranePalletEvents.forEach((ev) => {
    // ya finalizado
    if (firedCraneEventsRef.current.has(ev.id)) return;

    // todavía no empieza el evento de grúa
    if (simTimeSec < ev.startAtSec) return;

    // 1) mirar si el pallet YA existe en el estado actual
    let runtimePallet = palletsRef.current.find(
      (p) => p.id === ev.palletId
    );

    // 👇 Si es un despacho de pallet completo y aún no existe, lo creamos en zona "completo"
    if (!runtimePallet && ev.kind === 'despacho' && ev.operacion === 'despacho_completo') {
      const completeZone = PALLET_SPAWN_POINTS.find(
        (z) => z.zone === 'completo'
      );

      if (!completeZone || !completeZone.slots?.length) {
        console.warn(
          '[usePallets] No se encontró zona "completo" para despacho_completo',
          ev
        );
        firedCraneEventsRef.current.add(ev.id);
        return;
      }

      const randomSlot =
        completeZone.slots[
          Math.floor(Math.random() * completeZone.slots.length)
        ];

      const newPallet: RuntimePallet = {
        id: ev.palletId,
        zoneId: completeZone.id,
        slotId: randomSlot.id,
        createdAtSimSec: simTimeSec,
        label: ev.label,
        camionAsignado: ev.camionId ?? null,
      };


      setPallets((prev) => [...prev, newPallet]);
      // Esperamos al siguiente tick para iniciar el movimiento
      return;
    }

    // 👇 Si es carga_pallet y aún no existe un pallet con ese id,
    //     elegimos cualquiera de la load-zone del camión y lo "asignamos" a este id.
    if (!runtimePallet && ev.operacion === 'carga_pallet' && ev.camionId) {
      const loadZoneId = findLoadZoneForCamion(ev.camionId, actorStates);
      if (!loadZoneId) {
        // todavía no sabemos dónde está el camión → reintentar más tarde
        return;
      }

      // buscamos candidatos en esa load-zone
      const candidates = palletsRef.current
        .map((p, idx) => ({ p, idx }))
        .filter(
          ({ p }) =>
            p.camionAsignado === ev.camionId &&
            p.zoneId === loadZoneId &&
            !p.inTransit
        );

      if (!candidates.length) {
        // no hay pallets disponibles todavía → reintentar luego
        return;
      }

      // elegimos cualquiera (por ejemplo el primero)
      const chosen = candidates[0];

      setPallets((prev) => {
        const copy = [...prev];
        const current = copy[chosen.idx];

        copy[chosen.idx] = {
          ...current,
          id: ev.palletId, // 👈 lo "bautizamos" con el id del backend
        };

        return copy;
      });

      // actualizamos ref local también
      runtimePallet = {
        ...chosen.p,
        id: ev.palletId,
      };
    }

    // Si sigue sin existir (ej: todavía no llegó el pallet a load-zone), salimos
    runtimePallet = palletsRef.current.find((p) => p.id === ev.palletId);
    if (!runtimePallet) {
      return;
    }

    // 2) resolver camionId: runtime -> planificación
    const camionId =
      runtimePallet.camionAsignado ?? ev.camionId ?? null;
    if (!camionId) {
      // sin camión todavía, se reintenta en el próximo tick
      return;
    }

    // 3) ver si el camión ya está en un slot-load-X
    const loadZoneId = findLoadZoneForCamion(camionId, actorStates);
    if (!loadZoneId) {
      // camión todavía no estacionado, se reintenta luego
      return;
    }

    const zone = PALLET_SPAWN_POINTS.find((z) => z.id === loadZoneId);
    if (!zone || !zone.slots || zone.slots.length === 0) {
      console.warn(
        `[usePallets] No se encontró zona de carga "${loadZoneId}" para evento de grúa ${ev.id}`
      );
      firedCraneEventsRef.current.add(ev.id);
      return;
    }

    // 3.a) Si aún NO iniciamos el movimiento, fijamos origen/destino y marcamos inTransit
    if (!startedCraneEventsRef.current.has(ev.id)) {
      setPallets((prev) => {
        const idx = prev.findIndex((p) => p.id === ev.palletId);
        if (idx === -1) return prev;

        const current = prev[idx];

        // slots ocupados SOLO por pallets ya estacionados (no en tránsito)
        const occupiedSlotIds = new Set(
          prev
            .filter((p) => p.zoneId === zone.id && !p.inTransit)
            .map((p) => p.slotId)
        );
        const emptySlots = zone.slots.filter(
          (slot) => !occupiedSlotIds.has(slot.id)
        );
        const candidateSlots =
          emptySlots.length > 0 ? emptySlots : zone.slots;

        const chosenSlot =
          candidateSlots[
            Math.floor(Math.random() * candidateSlots.length)
          ];

        const fromPos = getSlotNormPosition(
          current.zoneId,
          current.slotId
        );
        const toPos = getSlotNormPosition(zone.id, chosenSlot.id);

        const path = aStarPathfinding(
          fromPos,
          toPos,
          PREDEFINED_OBSTACLES
        );

        const pathNorm: Point[] =
          path && path.length > 1 ? path : [fromPos, toPos];

        const updated = [...prev];
        updated[idx] = {
          ...current,
          inTransit: true,
          fromZoneId: current.zoneId,
          fromSlotId: current.slotId,
          toZoneId: zone.id,
          toSlotId: chosenSlot.id,
          transitStartSimSec: ev.startAtSec,
          transitEndSimSec: ev.endAtSec,
          pathNorm,
          // 👇 para despacho completo *y* carga_pallet, lo cargamos al camión
          dropOnTruck: ev.kind === 'despacho',
          dropTruckId: camionId,
        };

        return updated;
      });

      startedCraneEventsRef.current.add(ev.id);
    }

    // 3.b) Si ya pasó el final del evento, terminamos el movimiento
    if (simTimeSec >= ev.endAtSec) {
      setPallets((prev) => {
        const idx = prev.findIndex((p) => p.id === ev.palletId);
        if (idx === -1) return prev;

        const current = prev[idx];

        // 👇 Para cualquier 'despacho' (despacho completo o carga_pallet),
        //     dejamos que el pallet desaparezca después de cargar
        if (ev.kind === 'despacho') {
          const copy = [...prev];
          copy.splice(idx, 1);
          return copy;
        }

        // Para acomodo normal, lo dejamos estacionado en la load-zone
        const finalZoneId = current.toZoneId ?? current.zoneId;
        const finalSlotId = current.toSlotId ?? current.slotId;

        const updated = [...prev];
        updated[idx] = {
          ...current,
          zoneId: finalZoneId,
          slotId: finalSlotId,
          inTransit: false,
          fromZoneId: undefined,
          fromSlotId: undefined,
          toZoneId: undefined,
          toSlotId: undefined,
          transitStartSimSec: undefined,
          transitEndSimSec: undefined,
        };

        return updated;
      });

      firedCraneEventsRef.current.add(ev.id);
    }
  });
}, [simTimeSec, cranePalletEvents, actorStates]);

useEffect(() => {
  if (!parrilleroEvents.length) return;

  parrilleroEvents.forEach((ev) => {
    // ya aplicado
    if (firedParrilleroEventsRef.current.has(ev.id)) return;

    // esperamos a que termine el ajuste
    if (simTimeSec < ev.endAtSec) return;

    const diff = ev.palletsIniciales - ev.palletsFinales;
    if (diff <= 0) {
      // nada que reducir
      firedParrilleroEventsRef.current.add(ev.id);
      return;
    }

    // Buscar la load-zone del camión en el estado actual
    const loadZoneId = findLoadZoneForCamion(ev.camionId, actorStates);
    if (!loadZoneId) {
      // el camión aún no está en posición; puedes decidir reintentar más tarde
      return;
    }

    setPallets((prev) => {
      // candidatos: pallets asignados a este camión, en su load-zone y NO en tránsito
      const candidates = prev
        .map((p, idx) => ({ p, idx }))
        .filter(
          ({ p }) =>
            p.camionAsignado === ev.camionId &&
            p.zoneId === loadZoneId &&
            !p.inTransit
        );

      if (!candidates.length) {
        return prev;
      }

      const toRemoveCount = Math.min(diff, candidates.length);

      // Estrategia simple: remover aleatoriamente `toRemoveCount` pallets de esa load-zone
      const indicesToRemove = new Set<number>();
      const pool = [...candidates];

      while (indicesToRemove.size < toRemoveCount && pool.length > 0) {
        const r = Math.floor(Math.random() * pool.length);
        indicesToRemove.add(pool[r].idx);
        pool.splice(r, 1);
      }

      const next = prev.filter((_, idx) => !indicesToRemove.has(idx));

      return next;
    });

    // marcar evento como aplicado
    firedParrilleroEventsRef.current.add(ev.id);
  });
}, [simTimeSec, parrilleroEvents, actorStates, setPallets]);


  // 6) Mapa slotId -> cantidad de pallets (para el layer)
  // Función auxiliar: obtener la posición (normalizada) de un slot
function getSlotNormPosition(zoneId: string | null | undefined, slotId: string | null | undefined) {
  if (!zoneId || !slotId) {
    return { x: 0, y: 0 };
  }

  const zone = PALLET_SPAWN_POINTS.find((z) => z.id === zoneId);
  const slot = zone?.slots?.find((s) => s.id === slotId);

  if (!slot) {
    return { x: 0, y: 0 };
  }

  // Asumo que slot.x y slot.y ya vienen normalizados (0–1)
  return { x: slot.x, y: slot.y };
}

// 6) Calcular posición de cada pallet (incluyendo los que están en tránsito)
const palletsWithPosition = useMemo(() => {
  return pallets.map((p) => {
    const { x, y } = getSlotNormPosition(p.zoneId, p.slotId);

    // 🔹 Buscar eventos de chequeo para este pallet
    const eventsForPallet = checkPalletEvents.filter(
      (ev) => ev.palletId === p.id
    );

    let isBeingChecked = false;
    let isCheckedOk = false;
    let lastCheckStartSimSec: number | undefined;
    let lastCheckEndSimSec: number | undefined;

    if (eventsForPallet.length > 0) {
      // Como están ordenados por startAtSec, el último es el más reciente
      const lastEv = eventsForPallet[eventsForPallet.length - 1];
      lastCheckStartSimSec = lastEv.startAtSec;
      lastCheckEndSimSec = lastEv.endAtSec;

      if (simTimeSec >= lastEv.startAtSec && simTimeSec <= lastEv.endAtSec) {
        // ⏳ En chequeo (durante el evento)
        isBeingChecked = true;
      } else if (simTimeSec > lastEv.endAtSec) {
        // ✅ Chequeo terminado OK
        isCheckedOk = true;
      }
    }

    return {
      ...p,
      xNorm: x,
      yNorm: y,
      isBeingChecked,
      isCheckedOk,
      lastCheckStartSimSec,
      lastCheckEndSimSec,
    };
  });
}, [pallets, simTimeSec, craneTransitOverrides, checkPalletEvents]);


// 7) Mapa slotId -> cantidad de pallets (para el layer de contadores)
//    Omitimos los pallets que están en tránsito
const palletCountsBySlot = useMemo(() => {
  const map: Record<string, number> = {};
  for (const p of palletsWithPosition) {
    if (p.inTransit) continue;
    map[p.slotId] = (map[p.slotId] ?? 0) + 1;
  }
  return map;
}, [palletsWithPosition]);




return {
  pallets: palletsWithPosition,
  palletCountsBySlot,
  
};

}