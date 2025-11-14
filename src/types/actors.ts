import grua_horquilla from '../assets/Simulacion/GRUA_HORQUILLA.png';
import camion_1 from '../assets/Simulacion/T2 VERDE OSCURO.png';
import type { RouteTransition } from '../utils/routes/scheduledRoutes';

export type ActorType = 'truck1' | 'truck2' | 'truck3' | 'truck4' | 'crane1';

export type ActorBehavior = 'mobile' | 'stationary';

export type ActorConfig = {
  id: string;
  name: string;
  imagePath: string;
  count: number;
  speed: number;
  size: { width: number; height: number };
  behavior: ActorBehavior;          
  parkingPosition?: {               
    x: number;
    y: number;
    rotation: number;
  };
  image?: HTMLImageElement | null;
};

export type ActorState = {
  id: string;
  type: ActorType;
  image: HTMLImageElement;
  routeId: string;
  cursor: number;
  speed: number;
  behavior: ActorBehavior;
  size: { width: number; height: number };
  parkingPosition?: { x: number; y: number; rotation: number };
  currentTransition?: RouteTransition;
  direction?: 1 | -1;
  operationState?: 'idle' | 'moving' | 'loading' | 'unloading';
  taskQueue?: string[]; // Cola de tareas pendientes
};


export const ACTOR_DEFINITIONS: Record<ActorType, Omit<ActorConfig, 'count'>> = {
  truck1: {
    id: 'truck1',
    name: 'Camión Tipo 1',
    imagePath: camion_1,
    speed: 0.8,
    size: { width: 80, height: 120 },
    behavior: 'stationary', // 🆕 Estacionado por defecto
    //parkingPosition: { x: 0.643, y: 0.425, rotation: 305 } // 🆕 Posición normalizada
  },
  truck2: {
    id: 'truck2',
    name: 'Camión Tipo 2',
    imagePath: '/images/truck2.png',
    speed: 0.9,
    size: { width: 85, height: 125 },
    behavior: 'stationary',
  },
  truck3: {
    id: 'truck3',
    name: 'Camión Tipo 3',
    imagePath: '/images/truck3.png',
    speed: 0.7,
    size: { width: 90, height: 130 },
    behavior: 'stationary',
  },
  truck4: {
    id: 'truck4',
    name: 'Camión Tipo 4',
    imagePath: '/images/truck4.png',
    speed: 0.85,
    size: { width: 88, height: 128 },
    behavior: 'stationary',
  },
  crane1: {
    id: 'crane1',
    name: 'Grúa Tipo 1',
    imagePath: grua_horquilla,
    speed: 1,
    size: { width: 60, height: 80 },
    behavior: 'mobile' // 🆕 Móvil
  },
};