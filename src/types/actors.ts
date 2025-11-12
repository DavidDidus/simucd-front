import grua_horquilla from '../assets/Simulacion/GRUA_HORQUILLA.png';
export type ActorType = 'truck1' | 'truck2' | 'truck3' | 'truck4' | 'crane1';

export type ActorConfig = {
  id: string;
  name: string;
  imagePath: string;
  count: number;
  speed: number;
  size: { width: number; height: number };
  image?: HTMLImageElement | null;
};

export const ACTOR_DEFINITIONS: Record<ActorType, Omit<ActorConfig, 'count'>> = {
  truck1: {
    id: 'truck1',
    name: 'Camión Tipo 1',
    imagePath: '/images/truck1.png',
    speed: 0.8,
    size: { width: 80, height: 120 }
  },
  truck2: {
    id: 'truck2',
    name: 'Camión Tipo 2',
    imagePath: '/images/truck2.png',
    speed: 0.9,
    size: { width: 85, height: 125 }
  },
  truck3: {
    id: 'truck3',
    name: 'Camión Tipo 3',
    imagePath: '/images/truck3.png',
    speed: 0.7,
    size: { width: 90, height: 130 }
  },
  truck4: {
    id: 'truck4',
    name: 'Camión Tipo 4',
    imagePath: '/images/truck4.png',
    speed: 0.85,
    size: { width: 88, height: 128 }
  },
  crane1: {
    id: 'crane1',
    name: 'Grúa Tipo 1',
    imagePath: grua_horquilla,
    speed: 1,
    size: { width: 60, height: 80 }
  },
};