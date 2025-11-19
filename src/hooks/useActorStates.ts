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
  selectedRouteId: string
) {
  const [actorStates, setActorStates] = useState<ActorState[]>([]);

  useEffect(() => {
    if (actorsLoading || actors.length === 0) return;

    // 🅿️ Paso 1: Preparar datos para asignación de parking
    const actorTypesData = Object.entries(actorCounts)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({ type: type as ActorType, count }));

    // 🅿️ Paso 2: Asignar slots automáticamente
    const parkingAssignments = assignParkingSlots(actorTypesData, PARKING_ZONES);

    // 🎬 Paso 3: Crear estados para cada actor
    const states: ActorState[] = [];

    for (const [actorType, count] of Object.entries(actorCounts)) {
      if (count <= 0) continue;

      const definition = ACTOR_DEFINITIONS[actorType as ActorType];
      const actorConfig = actors.find(a => a.id === actorType);
      
      if (!definition || !actorConfig?.image) continue;

      // Crear múltiples instancias según count
      for (let i = 0; i < count; i++) {
        const actorId = `${actorType}-${i}`;
        
        // 🅿️ Obtener posición asignada automáticamente
        const assignedPosition = parkingAssignments.get(actorId);

        const state: ActorState = {
          id: actorId,
          type: actorType as ActorType,
          image: actorConfig.image,
          routeId: selectedRouteId || PREDEFINED_ROUTES[0]?.id ,
          cursor: 0,
          speed: definition.speed,
          behavior: definition.behavior,
          size: definition.size,
          parkingPosition: assignedPosition || definition.parkingPosition,
          parkingSlotId: assignedPosition?.slotId,
          direction: 1,
          operationState: 'idle'
        };

        states.push(state);
      }
    }

    console.log(`✅ Inicializados ${states.length} actores independientes con parking automático`);
    console.log(`🅿️ Asignaciones de parking:`, parkingAssignments);
    setActorStates(states);
  }, [actors, actorsLoading, actorCounts, selectedRouteId]);

  return { actorStates, setActorStates };
}