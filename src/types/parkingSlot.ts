import type { ActorType } from './actors';

export type ParkingSlot = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  occupied: boolean;
  assignedTo?: string; // ID del actor asignado
};

export type ParkingZone = {
  id: string;
  name: string;
  slots: ParkingSlot[];
  allowedTypes?: ActorType[]; // Tipos de actores permitidos (opcional)
};

// 🅿️ Definir zonas de parking
export const PARKING_ZONES: ParkingZone[] = [
  {
    id: 'zone-main',
    name: 'Zona Principal',
    slots: [
        { id: 'slot-1', x: 0.883, y: 0.425, rotation: 300, occupied: false },
        { id: 'slot-2', x: 0.883, y: 0.455, rotation: 300, occupied: false },
        { id: 'slot-3', x: 0.883, y: 0.485, rotation: 302, occupied: false },
        { id: 'slot-4', x: 0.880, y: 0.510, rotation: 302, occupied: false },
        { id: 'slot-5', x: 0.883, y: 0.541, rotation: 305, occupied: false },
        { id: 'slot-6', x: 0.883, y: 0.569, rotation: 305, occupied: false },
        { id: 'slot-7', x: 0.880, y: 0.595, rotation: 305, occupied: false },
        { id: 'slot-8', x: 0.880, y: 0.622, rotation: 305, occupied: false },
        { id: 'slot-9', x: 0.880, y: 0.650, rotation: 305, occupied: false },
        { id: 'slot-10', x: 0.878, y: 0.680, rotation: 305, occupied: false },
        { id: 'slot-11', x: 0.875, y: 0.705, rotation: 305, occupied: false },
        { id: 'slot-12', x: 0.875, y: 0.735 , rotation: 305, occupied: false },
        { id: 'slot-13', x: 0.873, y: 0.762, rotation: 305, occupied: false },
        { id: 'slot-14', x: 0.870, y: 0.792, rotation: 305, occupied: false },

    ],
    allowedTypes: ['truck1', 'truck2', 'truck3', 'truck4']
  }
];