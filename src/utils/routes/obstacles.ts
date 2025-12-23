import type { PredefinedObstacle } from '../../types/obstacles';
import obstaclesData from '../../data/obstacles.json';

export const PREDEFINED_OBSTACLES: PredefinedObstacle[] = (obstaclesData.obstacles as unknown) as PredefinedObstacle[];

export function getObstacleById(id: string): PredefinedObstacle | undefined {
  return PREDEFINED_OBSTACLES.find(obstacle => obstacle.id === id);
}

export function getObstaclesByType(type: string): PredefinedObstacle[] {
  return PREDEFINED_OBSTACLES.filter(obstacle => obstacle.type === type);
}

// Función para guardar un nuevo obstáculo (para desarrollo)
export function saveObstacle(obstacle: Omit<PredefinedObstacle, 'id'>): PredefinedObstacle {
  const id = `obstacle-${Date.now()}`;
  const newObstacle: PredefinedObstacle = {
    id,
    ...obstacle
  };
  
  return newObstacle;
}

// Función para verificar si un punto está dentro de un obstáculo
export function isPointInObstacle(point: { x: number; y: number }, obstacle: PredefinedObstacle): boolean {
  if (obstacle.points.length < 3) return false;
  
  // Algoritmo de ray casting para determinar si el punto está dentro del polígono
  let inside = false;
  const { points } = obstacle;
  
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    if (((points[i].y > point.y) !== (points[j].y > point.y)) &&
        (point.x < (points[j].x - points[i].x) * (point.y - points[i].y) / (points[j].y - points[i].y) + points[i].x)) {
      inside = !inside;
    }
  }
  
  return inside;
}
