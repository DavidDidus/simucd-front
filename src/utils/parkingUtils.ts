import type { ActorType } from '../types/actors';
import type { Point } from '../types';
import { PARKING_ZONES, type ParkingZone } from '../types/parkingSlot';

export interface ParkingSlot {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  occupied: boolean;
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
 * Busca el slot LIBRE más cercano dentro de una zona, medido en distancia euclidiana
 * sobre coordenadas normalizadas [0..1].
 */
export function findNearestFreeSlotInZone(
  zoneId: string,
  from: Point
): ParkingSlot | null {
  const zone = getZoneById(zoneId);
  if (!zone) return null;

  const freeSlots = zone.slots.filter(s => !s.occupied);
  if (freeSlots.length === 0) return null;

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
  }
}

/**
 * Libera un slot ocupado. Si no existe, no hace nada.
 */
export function releaseSlot(slotId: string): void {
  const slot = getSlotById(slotId);
  if (slot) {
    slot.occupied = false;
  }
}
export function assignParkingSlots(
  actorTypes: { type: ActorType; count: number }[],
  zones: ParkingZone[],
  actorIdsByType?: Record<ActorType, string[]>
): Map<string, { x: number; y: number; rotation: number;slotId?:string }> {
  const assignments = new Map<string, { x: number; y: number; rotation: number;slotId?:string }>();
  const zonesState = JSON.parse(JSON.stringify(zones)) as ParkingZone[]; // Deep copy

  let actorIndex = 0;

  for (const { type, count } of actorTypes) {
    const idsForType = actorIdsByType?.[type] ?? [];

    for (let i = 0; i < count; i++) {
      const actorId = idsForType[i] ?? `${type}-${i}`;
      
      // 🔍 Buscar un slot disponible para este tipo de actor
      let assigned = false;

      for (const zone of zonesState) {
        // Verificar si esta zona permite este tipo de actor
        if (zone.allowedTypes && !zone.allowedTypes.includes(type)) {
          continue;
        }

        // Buscar primer slot disponible en esta zona
        const availableSlot = zone.slots.find(slot => !slot.occupied);
        
        if (availableSlot) {
          // Asignar slot
          assignments.set(actorId, {
            x: availableSlot.x,
            y: availableSlot.y,
            rotation: availableSlot.rotation,
            slotId: availableSlot.id
          });

          // Marcar como ocupado
          availableSlot.occupied = true;
          occupySlot(availableSlot.id);
          availableSlot.assignedTo = actorId;
          
          assigned = true;
          console.log(`✅ ${actorId} asignado a ${availableSlot.id} en ${zone.name}`);
          break;
        }
      }

      if (!assigned) {
        console.warn(`⚠️ No hay slots disponibles para ${actorId}`);
        // Posición por defecto si no hay slots
        assignments.set(actorId, {
          x: 0.5 + (actorIndex * 0.1),
          y: 0.5,
          rotation: 0
        });
      }

      actorIndex++;
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