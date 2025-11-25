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
    actorIdsByType         // 👈 hay que actualizar parkingUtils para esto
  );

  const craneZone = PARKING_ZONES.find(zone => zone.id === 'zone-parking-crane');
  const craneSlots = craneZone?.slots ?? [];
  let craneSlotIndex = 0;

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

      const state: ActorState = {
        id: actorId, // 👈 ahora será "E44" si viene del backend
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
      };

      states.push(state);
    }
  }

  setActorStates(states);
}, [actors, actorsLoading, actorCounts, selectedRouteId, truckIdsFromBackend]);

  return { actorStates, setActorStates };
}