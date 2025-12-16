import type { Point } from '../types';
export type ObstacleType = 'building' | 'container' | 'machinery' | 'zone' | 'custom';

export type PredefinedObstacle = {
  id: string;
  name: string;
  description: string;
  type: ObstacleType;
  points: Point[];
  color?: string; // Color para visualización
  radius?: number; // Radio de influencia del obstáculo
};