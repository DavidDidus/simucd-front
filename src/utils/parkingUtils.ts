import type { ActorType } from '../types/actors';
import type { ParkingZone } from '../types/parkingSlot';


export function assignParkingSlots(
  actorTypes: { type: ActorType; count: number }[],
  zones: ParkingZone[]
): Map<string, { x: number; y: number; rotation: number;slotId?:string }> {
  const assignments = new Map<string, { x: number; y: number; rotation: number;slotId?:string }>();
  const zonesState = JSON.parse(JSON.stringify(zones)) as ParkingZone[]; // Deep copy

  let actorIndex = 0;

  for (const { type, count } of actorTypes) {
    for (let i = 0; i < count; i++) {
      const actorId = `${type}-${i}`;
      
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