// src/hooks/usePallets.ts
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { PALLET_SPAWN_POINTS } from '../types/pallets';
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
  // ...otros campos
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

export function usePallets({ backendResponse, simTimeSec }: UsePalletsArgs) {
  const [pallets, setPallets] = useState<RuntimePallet[]>([]);

  // Para no disparar el mismo evento de pallet dos veces
  const firedEventsRef = useRef<Set<string>>(new Set());

  // 1) Normalizar datos del backend (SOLO turno_noche por ahora)
  const { lineaTiempoRecursos, palletToCamionMap } = useMemo(() => {
    if (!backendResponse) {
      return {
        lineaTiempoRecursos: [] as EventoRecurso[],
        palletToCamionMap: {} as Record<string, string>,
      };
    }

    // 👇 Soporta tanto { data: { turno_noche } } como { turno_noche }
    const root: any = (backendResponse as any).data ?? backendResponse;

    const turnoNoche: TurnoNocheBackend | undefined | null =
      root?.turno_noche ?? null;

    const linea: EventoRecurso[] =
      turnoNoche?.linea_tiempo_recursos ?? [];

    const map = buildPalletToCamionMap(
      turnoNoche?.planificacion_detalle
    );

    console.log(
      '[usePallets] linea_tiempo_recursos:',
      linea.length,
      ' eventos. planificacion_detalle map size:',
      Object.keys(map).length
    );

    return {
      lineaTiempoRecursos: linea,
      palletToCamionMap: map,
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

  // 3) Función para generar un pallet en temporary-zone en un slot aleatorio
  const spawnPalletInTemporaryZone = useCallback(
    (params: {
      id: string;
      createdAtSimSec: number;
      label: string;
      camionAsignado: string | null;
    }) => {
      const tempZone = PALLET_SPAWN_POINTS.find((z) => z.id === 'temporary-zone');
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
        `Spawning pallet ${newPallet.id} (camión ${newPallet.camionAsignado ?? 'N/A'}) en slot ${newPallet.slotId} at sim sec ${newPallet.createdAtSimSec}`
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

  // 5) Mapa slotId -> cantidad de pallets (para el layer)
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
