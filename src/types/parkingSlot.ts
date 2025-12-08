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
    //    { id: 'slot-15', x: 0.340, y: 0.999, rotation: 305, occupied: false },

    ],
    allowedTypes: ['truck1', 'truck2', 'truck3', 'truck4']
  },
  {
    id: 'zone-secondary',
    name: 'Zona Secundaria',
    slots: [
        { id: 'slot-16', x: 0.788, y: 0.810, rotation: 90, occupied: false },
        { id: 'slot-15', x: 0.748, y: 0.810, rotation: 90, occupied: false },
        { id: 'slot-18', x: 0.788, y: 0.785, rotation: 90, occupied: false },
        { id: 'slot-17', x: 0.748, y: 0.785, rotation: 90, occupied: false },
        { id: 'slot-20', x: 0.788, y: 0.760, rotation: 90, occupied: false },
        { id: 'slot-19', x: 0.748, y: 0.760, rotation: 90, occupied: false },
        { id: 'slot-22', x: 0.788, y: 0.735, rotation: 90, occupied: false },
        { id: 'slot-21', x: 0.748, y: 0.735, rotation: 90, occupied: false },
        { id: 'slot-24', x: 0.788, y: 0.710, rotation: 90, occupied: false },
        { id: 'slot-23', x: 0.748, y: 0.710, rotation: 90, occupied: false },
        { id: 'slot-26', x: 0.788, y: 0.685, rotation: 90, occupied: false },
        { id: 'slot-25', x: 0.748, y: 0.685, rotation: 90, occupied: false },
        { id: 'slot-28', x: 0.788, y: 0.660, rotation: 90, occupied: false },
        { id: 'slot-27', x: 0.748, y: 0.660, rotation: 90, occupied: false },
        { id: 'slot-30', x: 0.788, y: 0.635, rotation: 90, occupied: false },
        { id: 'slot-29', x: 0.748, y: 0.635, rotation: 90, occupied: false },

    ],
  },
  {
    id: 'zone-load',
    name: 'Zona de Carga',
    slots: [
        { id: 'slot-load-1', x: 0.130, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-2', x: 0.170, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-3', x: 0.210, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-4', x: 0.250, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-5', x: 0.290, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-6', x: 0.330, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-7', x: 0.370, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-8', x: 0.410, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-9', x: 0.450, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-10', x: 0.490, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-11', x: 0.530, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-12', x: 0.570, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-13', x: 0.610, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-14', x: 0.650, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-15', x: 0.690, y: 0.640, rotation: 0, occupied: false },
        { id: 'slot-load-16', x: 0.730, y: 0.640, rotation: 0, occupied: false },
    ],
    allowedTypes: ['truck1', 'truck2']
  },
  {
    id: 'zone-parking-crane',
    name: 'Zona parking Grúa',
    slots: [
        { id: 'slot-crane-1', x: 0.025, y: 0.580, rotation: 90, occupied: false },
        { id: 'slot-crane-2', x: 0.025, y: 0.600, rotation: 90, occupied: false },
        { id: 'slot-crane-3', x: 0.025, y: 0.620, rotation: 90, occupied: false },
        { id: 'slot-crane-4', x: 0.025, y: 0.640, rotation: 90, occupied: false },
        { id: 'slot-crane-5', x: 0.025, y: 0.660, rotation: 90, occupied: false },
    ],
    allowedTypes: ['crane1']
  },
  {
  id: 'zone-exit',
  name: 'Zona de Salida',
  slots: [
    {
      id: 'slot-exit-1',
      x: 0.340,
      y: 0.999,
      rotation: 0,
      occupied: false,
    },
  ],
  allowedTypes: ['truck1', 'truck2'],
},

];