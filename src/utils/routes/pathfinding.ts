import type { Point } from '../../types';
import type { PredefinedObstacle } from '../../types/obstacles';
import { isPointInObstacle } from '../routes/obstacles';

export interface PathNode {
  point: Point;
  g: number;
  h: number;
  f: number;
  parent?: PathNode;
}

// Calcular distancia euclidiana entre dos puntos
function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Verificar si un punto está demasiado cerca de obstáculos
function isPointNearObstacles(point: Point, obstacles: PredefinedObstacle[]): boolean {
  for (const obstacle of obstacles) {
    // Verificar si está dentro del obstáculo
    if (isPointInObstacle(point, obstacle)) {
      return true;
    }
    
    // Verificar si está dentro del radio de influencia de cualquier punto del obstáculo
    const minDistance = obstacle.radius || 0.05;
    for (const obstaclePoint of obstacle.points) {
      if (distance(point, obstaclePoint) < minDistance) {
        return true;
      }
    }
  }
  
  return false;
}

// Encontrar el punto más cercano en la ruta que no esté bloqueado
function findSafeTargetPoint(targetRoute: Point[], obstacles: PredefinedObstacle[]): Point {
  
  // Buscar el primer punto de la ruta que no esté bloqueado
  for (let i = 0; i < targetRoute.length; i++) {
    const point = targetRoute[i];
    
    if (!isPointNearObstacles(point, obstacles)) {
      return point;
    }
  }
  
  // Si todos los puntos están bloqueados, devolver el primero
  return targetRoute[0];
}

// Algoritmo mejorado para ir al inicio de la ruta evitando obstáculos
export function findTransitionToRouteStart(
  currentPoint: Point,
  targetRoute: Point[],
  obstacles: PredefinedObstacle[] = []
): Point[] {
  
  if (targetRoute.length === 0) {
    return [];
  }
  
  // Encontrar un punto seguro en la ruta objetivo
  const safeTarget = findSafeTargetPoint(targetRoute, obstacles);
  
  // Si no hay obstáculos o estamos muy cerca, ir directamente
  if (obstacles.length === 0 || distance(currentPoint, safeTarget) < 0.02) {
    return [currentPoint, safeTarget];
  }

  // Si hay obstáculos, usar A* para encontrar un camino seguro
  return aStarPathfinding(currentPoint, safeTarget, obstacles);
}

// 🆕 Algoritmo A* mejorado con más iteraciones y optimizaciones
export function aStarPathfinding(
  start: Point,
  goal: Point,
  obstacles: PredefinedObstacle[] = [],
  maxIterations: number = 3000 // Reduced from 5000 to 3000 for better performance
): Point[] {
  
  const openList: PathNode[] = [];
  const closedList: PathNode[] = [];
  
  // Nodo inicial
  const startNode: PathNode = {
    point: start,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal)
  };
  
  openList.push(startNode);
  
  let iterations = 0;
  
  while (openList.length > 0 && iterations < maxIterations) {
    iterations++;
        
    // Obtener el nodo con menor f
    const currentNode = getLowestFNode(openList);
    
    // Remover de la lista abierta y agregar a la cerrada
    const openIndex = openList.indexOf(currentNode);
    openList.splice(openIndex, 1);
    closedList.push(currentNode);
    
    // Si llegamos al objetivo (con tolerancia ajustable)
    const goalTolerance = 0.02;
    if (distance(currentNode.point, goal) < goalTolerance) {
      return reconstructPath(currentNode);
    }
    
    // Generar nodos vecinos
    const neighbors = generateNeighbors(currentNode.point);
    
    for (const neighborPoint of neighbors) {
      // Verificar si el vecino está en la lista cerrada
      if (pointExistsInList(neighborPoint, closedList)) continue;
      
      // Verificar si el vecino está demasiado cerca de obstáculos
      if (isPointNearObstacles(neighborPoint, obstacles)) continue;
      
      const g = currentNode.g + distance(currentNode.point, neighborPoint);
      const existingNode = pointExistsInList(neighborPoint, openList);
      
      if (existingNode) {
        if (g < existingNode.g) {
          existingNode.g = g;
          existingNode.f = g + existingNode.h;
          existingNode.parent = currentNode;
        }
      } else {
        const neighborNode: PathNode = {
          point: neighborPoint,
          g,
          h: heuristic(neighborPoint, goal),
          f: g + heuristic(neighborPoint, goal),
          parent: currentNode
        };
        openList.push(neighborNode);
      }
    }
  }
  
  // 🆕 Intentar encontrar el nodo más cercano al objetivo como plan B
  const closestNode = findClosestNodeToGoal(closedList, goal);
  if (closestNode && distance(closestNode.point, goal) < 0.1) {
    return reconstructPath(closestNode);
  }
  
  return generateSmoothTransition(start, goal);
}

// 🆕 Encontrar el nodo más cercano al objetivo
function findClosestNodeToGoal(nodes: PathNode[], goal: Point): PathNode | null {
  if (nodes.length === 0) return null;
  
  return nodes.reduce((closest, node) => {
    const distToGoal = distance(node.point, goal);
    const closestDist = distance(closest.point, goal);
    return distToGoal < closestDist ? node : closest;
  });
}

// Funciones auxiliares
function heuristic(a: Point, b: Point): number {
  return distance(a, b);
}

function getLowestFNode(openList: PathNode[]): PathNode {
  return openList.reduce((lowest, node) => 
    node.f < lowest.f ? node : lowest
  );
}

function pointExistsInList(point: Point, list: PathNode[]): PathNode | null {
  return list.find(node => 
    Math.abs(node.point.x - point.x) < 0.01 && 
    Math.abs(node.point.y - point.y) < 0.01
  ) || null;
}

function reconstructPath(node: PathNode): Point[] {
  const path: Point[] = [];
  let current: PathNode | undefined = node;
  
  while (current) {
    path.unshift(current.point);
    current = current.parent;
  }
  
  return path;
}

function generateNeighbors(point: Point): Point[] {
  const step = 0.03; // Paso para la búsqueda
  return [
    { x: point.x + step, y: point.y },
    { x: point.x - step, y: point.y },
    { x: point.x, y: point.y + step },
    { x: point.x, y: point.y - step },
    { x: point.x + step, y: point.y + step },
    { x: point.x - step, y: point.y - step },
    { x: point.x + step, y: point.y - step },
    { x: point.x - step, y: point.y + step }
  ].filter(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
}

export function generateSmoothTransition(start: Point, end: Point): Point[] {
  const points: Point[] = [start];
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalDistance = Math.sqrt(dx * dx + dy * dy);
  
  const numPoints = Math.max(3, Math.floor(totalDistance * 15));
  
  for (let i = 1; i < numPoints; i++) {
    const t = i / numPoints;
    const smoothT = t * t * (3 - 2 * t);
    
    points.push({
      x: start.x + dx * smoothT,
      y: start.y + dy * smoothT
    });
  }
  
  points.push(end);
  return points;
}

// Función principal
export function findTransitionPath(
  currentPoint: Point,
  targetRoute: Point[],
  obstacles: PredefinedObstacle[] = []
): Point[] {
  
  return findTransitionToRouteStart(currentPoint, targetRoute, obstacles);
}