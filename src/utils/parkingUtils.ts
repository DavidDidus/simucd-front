import type { ActorType } from '../types/actors';
import type { Point } from '../types';
import { PARKING_ZONES, type ParkingZone } from '../types/parkingSlot';

export interface ParkingSlot {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  occupied: boolean;
  assignedTo?: string;
}

/**
 * Devuelve una referencia al array global de zonas.
 * OJO: sigue siendo mutable, pero lo encapsulamos tras funciones.
 */
export function getParkingZones(): ParkingZone[] {
  return PARKING_ZONES as ParkingZone[];
}

export function getZoneById(zoneId: string): ParkingZone | undefined {
  return getParkingZones().find(z => z.id === zoneId);
}

export function getSlotById(slotId: string): ParkingSlot | undefined {
  for (const zone of getParkingZones()) {
    const slot = zone.slots.find(s => s.id === slotId);
    if (slot) return slot;
  }
  return undefined;
}

/**
 * Verifica si hay slots de carga disponibles
 * @returns true si hay al menos un slot-load libre
 */
export function hasAvailableLoadSlots(): boolean {
  const loadZone = PARKING_ZONES.find(zone => zone.id === 'zone-load');
  if (!loadZone) return false;
  
  return loadZone.slots.some(slot => !slot.occupied);
}

/**
 * Obtiene el primer slot de carga disponible
 * @returns ParkingSlot | null
 */
export function getNextAvailableLoadSlot(): ParkingSlot | null {
  const loadZone = PARKING_ZONES.find(zone => zone.id === 'zone-load');
  if (!loadZone) return null;
  
  return loadZone.slots.find(slot => !slot.occupied) || null;
}

/**
 * Cuenta cuántos slots de carga están disponibles
 */
export function countAvailableLoadSlots(): number {
  const loadZone = PARKING_ZONES.find(zone => zone.id === 'zone-load');
  if (!loadZone) return 0;
  
  return loadZone.slots.filter(slot => !slot.occupied).length;
}

/**
 * Busca el slot LIBRE más cercano.
 *
 * 💡 Soporta el alias "zone-parking" = [ "zone-main", "zone-secondary" ]
 */
export function findNearestFreeSlotInZone(
  zoneId: string,
  from: Point
): ParkingSlot | null {
  const zones = getParkingZones();

  // 🔁 Función auxiliar para buscar slots libres en una lista de zonas
  const collectFreeSlots = (zonesToScan: ParkingZone[]): ParkingSlot[] => {
    const free: ParkingSlot[] = [];
    for (const zone of zonesToScan) {
      for (const slot of zone.slots) {
        if (!slot.occupied) {
          free.push(slot);
        }
      }
    }
    return free;
  };

  let freeSlots: ParkingSlot[] = [];

  if (zoneId === 'zone-parking') {
    // 🎯 Priorizar primero zone-main
    const mainZones = zones.filter(z => z.id === 'zone-main');
    const secondaryZones = zones.filter(z => z.id === 'zone-secondary');

    freeSlots = collectFreeSlots(mainZones);

    // Si no hay huecos en zone-main, pasamos a zone-secondary
    if (freeSlots.length === 0) {
      freeSlots = collectFreeSlots(secondaryZones);
    } 

  } else {
    // 🔎 Comportamiento normal para otras zonas
    const zonesToSearch = zones.filter(z => z.id === zoneId);
    freeSlots = collectFreeSlots(zonesToSearch);
  }

  if (freeSlots.length === 0) {
    return null;
  }

  // 🧮 Elegir el slot más cercano al punto `from`
  let bestSlot = freeSlots[0];
  let bestDist = Infinity;

  for (const slot of freeSlots) {
    const dx = slot.x - from.x;
    const dy = slot.y - from.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) {
      bestDist = d2;
      bestSlot = slot;
    }
  }

  return bestSlot;
}


/**
 * Marca un slot como ocupado. Si no existe, no hace nada.
 */
export function occupySlot(slotId: string): void {
  const slot = getSlotById(slotId);
  if (slot) {
    slot.occupied = true;
  } else {
    console.warn('[Parking] occupySlot: slot no encontrado', slotId);
  }
}

/**
 * Libera un slot ocupado. Si no existe, no hace nada.
 */
export function releaseSlot(slotId: string): void {
  const slot = getSlotById(slotId);
  if (slot) {
    slot.occupied = false;
  } else {
    console.warn('[Parking] releaseSlot: slot no encontrado', slotId);
  }
}

export function assignParkingSlots(
  actorTypes: { type: ActorType; count: number }[],
  zones: ParkingZone[],
  actorIdsByType: Record<ActorType, string[]>
): Map<string, { x: number; y: number; rotation: number; slotId?: string }> {
  const assignments = new Map<string, { x: number; y: number; rotation: number; slotId?: string }>();

  // Copia local, NO tocamos PARKING_ZONES global aquí
  const zonesState: ParkingZone[] = zones.map(zone => ({
    ...zone,
    slots: zone.slots.map(slot => ({ ...slot }))
  }));

  for (const { type, count } of actorTypes) {
    // 1️⃣ Sacamos los IDs para este tipo
    const idsFromCaller = actorIdsByType[type] ?? [];

    // Si no hay IDs definidos para este tipo, generamos tantos como "count"
    const idsForType =
      idsFromCaller.length > 0
        ? idsFromCaller
        : Array.from({ length: count }, (_, i) => `${type}-${i}`);

    for (const actorId of idsForType) {
      let assigned = false;

      // 2️⃣ Buscamos un slot válido para este actor
      for (const zone of zonesState) {
        // Saltar zona de carga
        if (zone.id === 'zone-load') continue;

        // Verificar allowedTypes si existe
        if (zone.allowedTypes && !zone.allowedTypes.includes(type)) {
          continue;
        }

        const availableSlot = zone.slots.find(slot => !slot.occupied);
        if (!availableSlot) continue;

        assignments.set(actorId, {
          x: availableSlot.x,
          y: availableSlot.y,
          rotation: availableSlot.rotation ?? 0,
          slotId: availableSlot.id
        });

        // Marcar ocupado SOLO en la copia local
        availableSlot.occupied = true;
        availableSlot.assignedTo = actorId;

        assigned = true;
        break;
      }

      // 3️⃣ Si no hay slots disponibles, posición por defecto
      if (!assigned) {
        console.warn(`⚠️ No hay slots disponibles para ${actorId}`);
        assignments.set(actorId, {
          x: 0.5,
          y: 0.5,
          rotation: 0
        });
      }
    }
  }

  return assignments;
}

// 🔄 Función para reasignar un actor a otro slot
export function reassignActor(
  actorId: string,
  targetSlotId: string,
  zones: ParkingZone[]
): { x: number; y: number; rotation: number } | null {
  for (const zone of zones) {
    const slot = zone.slots.find(s => s.id === targetSlotId);
    if (slot && !slot.occupied) {
      slot.occupied = true;
      slot.assignedTo = actorId;
      return { x: slot.x, y: slot.y, rotation: slot.rotation };
    }
  }
  return null;
}

// 📊 Obtener estado del parking
export function getParkingStats(zones: ParkingZone[]): {
  total: number;
  occupied: number;
  available: number;
} {
  let total = 0;
  let occupied = 0;

  for (const zone of zones) {
    total += zone.slots.length;
    occupied += zone.slots.filter(s => s.occupied).length;
  }

  return {
    total,
    occupied,
    available: total - occupied
  };
}

/** Devuelve la load-zone que contiene el slot dado **/
export function getLoadZoneBySlotId(slotId: string): ParkingZone | null {
  for (const zone of PARKING_ZONES) {
    // 🔧 aquí el id real es "zone-load", no "load-zone"
    if (
      zone.id === 'zone-load' &&
      zone.slots.some(s => s.id === slotId)
    ) {
      return zone;
    }
  }
  return null;
}
