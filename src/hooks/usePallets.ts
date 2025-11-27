// src/hooks/usePallets.ts
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { PALLET_SPAWN_POINTS } from '../types/pallets';
import type { ActorState } from '../types/actors';
import type { RuntimePallet } from '../types/pallets';

export type EventoRecurso = {
  recurso: string;
  id_recurso: number;
  hora_comienzo: string;
  hora_fin: string;
  duracion_min: number;
  label: string;
  operacion: string;
};

// Estructuras mínimas para leer planificacion_detalle del backend
type PalletPlan = {
  mixto: boolean;
  cajas: number;
  id: string; // "MX25", "CP1", etc.
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

export function usePallets({ backendResponse, simTimeSec, actorStates }: UsePalletsArgs) {
  const [pallets, setPallets] = useState<RuntimePallet[]>([]);
  const palletsRef = useRef<RuntimePallet[]>([]);

  useEffect(() => {
    palletsRef.current = pallets;
  }, [pallets]);


  // Para no disparar el mismo evento de pallet dos veces
  const firedEventsRef = useRef<Set<string>>(new Set());

  // Para no disparar el mismo evento de grúa dos veces
  const firedCraneEventsRef = useRef<Set<string>>(new Set());

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

    console.log(
      '[usePallets] linea_tiempo_recursos:',
      linea.length,
      ' eventos. pallet->camion:',
      Object.keys(palletMap).length
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

    console.log('[usePallets] palletEvents:', events);
    return events;
  }, [lineaTiempoRecursos, palletToCamionMap]);

  // 3) Eventos de grúa que acomodan pallets en la load-zone correspondiente
  type CranePalletEvent = {
    id: string;
    palletId: string;
    // camionId inicial según planificación (fallback)
    camionId: string | null;
    fireAtSec: number;
  };

  const cranePalletEvents = useMemo<CranePalletEvent[]>(() => {
    const events = (lineaTiempoRecursos ?? [])
      .filter(
        (e) =>
          e.recurso === 'grua' &&
          e.operacion === 'acomodo_pallet' &&
          e.label.startsWith('Acomodando pallet')
      )
      .map((e) => {
        const match = e.label.match(/Acomodando\s+pallet\s+([A-Za-z0-9_-]+)/i);
        const palletIdFromLabel = match?.[1];
        const palletId =
          palletIdFromLabel ?? `pallet-${e.id_recurso}-${e.hora_fin}`;

        const camionId = palletToCamionMap[palletId] ?? null;

        // Usamos hora_comienzo + duracion_min (consistente con picker)
        const fireAtSec =
          hmToSeconds(e.hora_comienzo) + e.duracion_min * 60;

        return {
          id: `crane-${e.id_recurso}-${e.hora_comienzo}-${palletId}`,
          palletId,
          camionId,
          fireAtSec,
        };
      });

    // orden temporal
    events.sort((a, b) => a.fireAtSec - b.fireAtSec);
    console.log('[usePallets] cranePalletEvents:', events);
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

      console.log(
        `Spawning pallet ${newPallet.id} (camión ${newPallet.camionAsignado}) en temporary-zone, slot ${newPallet.slotId} at sim sec ${newPallet.createdAtSimSec}`
      );

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

  // 5) Efecto: mover pallets según eventos de grúa
  // - Se dispara cuando simTimeSec >= fireAtSec
  // - Reintenta mientras no encuentre loadZoneId
  // - Usa el camionAsignado del pallet runtime si existe
  useEffect(() => {
  if (!cranePalletEvents.length) return;

  cranePalletEvents.forEach((ev) => {
    // ya procesado
    if (firedCraneEventsRef.current.has(ev.id)) return;
    // aún no llega su tiempo
    if (simTimeSec < ev.fireAtSec) return;

    // 1) mirar si el pallet YA existe en el estado actual
    const runtimePallet = palletsRef.current.find(
      (p) => p.id === ev.palletId
    );
    if (!runtimePallet) {
      // el picker aún no lo spawnea, no hacemos setPallets
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
      // este evento ya no tiene sentido
      firedCraneEventsRef.current.add(ev.id);
      return;
    }

    // 4) ahora sí, movemos el pallet UNA sola vez
    setPallets((prev) => {
      const idx = prev.findIndex((p) => p.id === ev.palletId);
      if (idx === -1) return prev; // por si cambió entre medio

      const occupiedSlotIds = new Set(
        prev.filter((p) => p.zoneId === zone.id).map((p) => p.slotId)
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

      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        zoneId: zone.id,
        slotId: chosenSlot.id,
      };

      console.log(
        `[usePallets] Moviendo pallet ${ev.palletId} a ${zone.id} / ${chosenSlot.id} (camión ${camionId})`
      );

      return updated;
    });

    // 5) lo marcamos como disparado
    firedCraneEventsRef.current.add(ev.id);
  });
}, [simTimeSec, cranePalletEvents, actorStates]);

  // 6) Mapa slotId -> cantidad de pallets (para el layer)
  const palletCountsBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pallets) {
      map[p.slotId] = (map[p.slotId] ?? 0) + 1;
    }
    return map;
  }, [pallets]);

  return {
    pallets,
    palletCountsBySlot,
  };
}
