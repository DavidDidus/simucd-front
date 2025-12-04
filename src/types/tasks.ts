// Tipos básicos para el sistema de tareas de simulación

// Tipo de estado de la tarea
export type SimTaskStatus = 'pending' | 'running' | 'completed' | 'cancelled' | 'waiting-load-slot';

// Tipo de tarea (podemos extender con más strings específicos)
export type SimTaskType = 'followRoute' | 'moveToPoint' | 'wait' | 'craneMoveWithPallet' | string;

// Payload genérico de una tarea.
// Se puede extender más adelante con campos específicos por tipo.
export interface SimTaskPayload {
  routeId?: string;
  targetPoint?: {
    x: number;
    y: number;
  };
  waitSeconds?: number;
  palletId?: string;
  targetZoneId?: string;
  targetSlotId?: string;
  targetZone?: string;
}

// Modelo genérico de tarea de simulación
export interface SimTask {
  id: string;

  // A qué actor aplica esta tarea
  actorId: string;
  actorType: string; // luego podemos reemplazar por ActorType

  // Tipo y estado
  type: SimTaskType;
  status: SimTaskStatus;

  // Control de orden / scheduling
  priority: number; // 0 = más baja prioridad, números mayores = más prioridad
  startAtSimTime?: number; // en segundos de tiempo de simulación

  // Dependencias: esta tarea no puede iniciar hasta que todas estén completadas
  dependsOn?: string[];

  // Datos específicos del tipo de tarea
  payload?: SimTaskPayload;

  // (Opcional) timestamp de creación para desempate, si quieres
  createdAtSimTime?: number;
}

// Parámetros para crear una tarea base con helper
export interface CreateBaseTaskParams {
  id: string;
  actorId: string;
  actorType: string;
  type: SimTaskType;
  priority?: number;
  startAtSimTime?: number;
  dependsOn?: string[];
  payload?: SimTaskPayload;
  createdAtSimTime?: number;
}

/**
 * Helper para crear una tarea con valores por defecto consistentes.
 * Útil para no repetir siempre status, priority, etc.
 */
export function createBaseTask(params: CreateBaseTaskParams): SimTask {
  const {
    id,
    actorId,
    actorType,
    type,
    priority = 1,
    startAtSimTime,
    dependsOn,
    payload,
    createdAtSimTime,
  } = params;

  return {
    id,
    actorId,
    actorType,
    type,
    status: 'pending',
    priority,
    startAtSimTime,
    dependsOn,
    payload,
    createdAtSimTime,
  };
}
