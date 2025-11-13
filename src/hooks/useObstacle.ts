import { useState, useCallback } from 'react';
import type { Point } from '../types';
import type { PredefinedObstacle, ObstacleType } from '../types/obstacles';
import { saveObstacle } from '../utils/routes/obstacles';

export function useObstacle(initialObstacle: Point[] = []) {
  const [obstacle, setObstacle] = useState<Point[]>(initialObstacle);

  const saveCurrentObstacle = useCallback((name: string, description: string, type: ObstacleType = 'custom') => {
    if (obstacle.length < 3) {
      throw new Error('El obstáculo debe tener al menos 3 puntos');
    }

    const savedObstacle = saveObstacle({
      name,
      description,
      type,
      points: [...obstacle],
      color: '#FF6B6B',
      radius: 0.05
    });

    return savedObstacle;
  }, [obstacle]);

  const loadObstacle = useCallback((obstacleData: PredefinedObstacle) => {
    setObstacle([...obstacleData.points]);
  }, []);

  const clearObstacle = useCallback(() => {
    setObstacle([]);
  }, []);

  return {
    obstacle,
    setObstacle,
    saveObstacle: saveCurrentObstacle,
    loadObstacle,
    clearObstacle
  };
}