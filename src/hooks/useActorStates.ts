import { useState, useEffect } from 'react';
import type { ActorType, ActorConfig, ActorState } from '../types/actors';
import { ACTOR_DEFINITIONS } from '../types/actors';
import { PREDEFINED_ROUTES } from '../utils/routes/routes';
import { assignParkingSlots } from '../utils/parkingUtils';
import { PARKING_ZONES } from '../types/parkingSlot';

export function useActorStates(
  actors: ActorConfig[],
  actorsLoading: boolean,
  actorCounts: Record<ActorType, number>,
  selectedRouteId: string,
  truckIdsFromBackend?: string[] | undefined
) {
  const [actorStates, setActorStates] = useState<ActorState[]>([]);

  useEffect(() => {
    if (actorsLoading) return;

    const actorTypesData = Object.entries(actorCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({ type: type as ActorType, count }));

    // 👇 SIEMPRE definimos arrays para todos los tipos
    const actorIdsByType: Record<ActorType, string[]> = {
      truck1: [],
      truck2: [],
      truck3: [],
      truck4: [],
      truckT1: [],
      truckDistribucion: [],
      crane1: [],
    };

    for (const [actorType, count] of Object.entries(actorCounts)) {
      const t = actorType as ActorType;

      if (t === 'truck1' && truckIdsFromBackend && truckIdsFromBackend.length) {
        // Usa los IDs del backend
        actorIdsByType[t] = truckIdsFromBackend.slice(0, count);
      } else {
        // Resto igual que antes
        actorIdsByType[t] = Array.from(
          { length: count },
          (_, i) => `${actorType}-${i}`
        );
      }
    }

    // 🅿️ Asignaciones de parking usando los IDs reales
    const parkingAssignments = assignParkingSlots(
      actorTypesData,
      PARKING_ZONES,
      actorIdsByType
    );

    const craneZone = PARKING_ZONES.find(zone => zone.id === 'zone-parking-crane');
    const craneSlots = craneZone?.slots ?? [];
    let craneSlotIndex = 0;

    // ⭐ Buscamos el slot de salida para el camión de distribución
    const exitZone = PARKING_ZONES.find(zone => zone.id === 'zone-exit');
    const exitSlot = exitZone?.slots.find(slot => slot.id === 'slot-exit-1');

    const states: ActorState[] = [];

    for (const [actorType, count] of Object.entries(actorCounts)) {
      if (count <= 0) continue;

      const definition = ACTOR_DEFINITIONS[actorType as ActorType];
      const actorConfig = actors.find(a => a.id === actorType);
      if (!definition || !actorConfig?.image) continue;

      const idsForType = actorIdsByType[actorType as ActorType] ?? [];

      for (let i = 0; i < count; i++) {
        const actorId = idsForType[i] ?? `${actorType}-${i}`; // 👈 AQUÍ se usa el E44, etc.

        let assignedPosition = parkingAssignments.get(actorId);

        // ⭐ Grúas → zona especial de grúas
        if (actorType === 'crane1' && craneSlots.length > 0) {
          const slot = craneSlots[craneSlotIndex % craneSlots.length];
          craneSlotIndex += 1;

          assignedPosition = {
            x: slot.x,
            y: slot.y,
            rotation: slot.rotation ?? 0,
            slotId: slot.id,
          } as any;
        }
        // ⭐ Camión de distribución → lo forzamos al slot-exit-1
        else if (actorType === 'truckDistribucion' && exitSlot) {
          assignedPosition = {
            x: exitSlot.x,
            y: exitSlot.y,
            rotation: exitSlot.rotation ?? 0,
            slotId: exitSlot.id,
          } as any;
        }

        const isDistributionTruck = actorType === 'truckDistribucion';

        const state: ActorState = {
          id: actorId,
          type: actorType as ActorType,
          image: actorConfig.image,
          routeId: selectedRouteId || PREDEFINED_ROUTES[0]?.id,
          cursor: 0,
          speed: definition.speed,
          behavior: definition.behavior,
          size: definition.size,
          parkingPosition: assignedPosition || definition.parkingPosition,
          parkingSlotId: assignedPosition?.slotId,
          direction: 1,
          operationState: 'idle',

          // ⭐ truco clave: el camión de distribución "existe" pero está oculto
          isExited: isDistributionTruck ? true : false,
        };

        states.push(state);
      }
    }

    setActorStates(states);
  }, [actors, actorsLoading, actorCounts, selectedRouteId, truckIdsFromBackend]);

  return { actorStates, setActorStates };
}
