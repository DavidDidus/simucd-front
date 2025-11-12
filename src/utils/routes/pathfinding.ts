import type { Point } from '../../types';

export interface PathNode {
  point: Point;
  g: number; // Costo desde el inicio
  h: number; // Heurística (distancia estimada al objetivo)
  f: number; // g + h
  parent?: PathNode;
}

// Calcular distancia euclidiana entre dos puntos
function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 🆕 Algoritmo mejorado para ir específicamente al inicio de la nueva ruta
export function findTransitionToRouteStart(
  currentPoint: Point,
  targetRoute: Point[]
): Point[] {
  if (targetRoute.length === 0) return [];
  
  // El objetivo es SIEMPRE el primer punto de la nueva ruta
  const targetStart = targetRoute[0];

  // Si estamos muy cerca del inicio de la ruta objetivo, ir directamente
  if (distance(currentPoint, targetStart) < 0.02) {
    return [currentPoint, targetStart];
  }

  // Generar una transición suave hacia el INICIO de la ruta
  const transitionPoints = generateSmoothTransition(currentPoint, targetStart);
  
  return transitionPoints;
}

// Generar puntos intermedios para una transición suave
export function generateSmoothTransition(start: Point, end: Point): Point[] {
  const points: Point[] = [start];
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalDistance = Math.sqrt(dx * dx + dy * dy);
  
  // Número de puntos intermedios basado en la distancia
  const numPoints = Math.max(3, Math.floor(totalDistance * 15)); // Más resolución para transiciones suaves
  
  for (let i = 1; i < numPoints; i++) {
    const t = i / numPoints;
    // Usar interpolación cúbica para suavizar la curva
    const smoothT = t * t * (3 - 2 * t); // Función de suavizado
    
    points.push({
      x: start.x + dx * smoothT,
      y: start.y + dy * smoothT
    });
  }
  
  points.push(end);
  return points;
}

// 🆕 Versión alternativa con curva más natural (usando spline)
export function generateCurvedTransition(start: Point, end: Point): Point[] {
  const points: Point[] = [start];
  
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Crear punto de control para hacer una curva más natural
  const midX = start.x + dx * 0.5;
  const midY = start.y + dy * 0.5;
  
  // Agregar un poco de curvatura perpendicular
  const perpX = -dy * 0.1; // 10% de curvatura
  const perpY = dx * 0.1;
  
  const controlPoint = {
    x: midX + perpX,
    y: midY + perpY
  };
  
  // Generar puntos usando curva cuadrática de Bézier
  const numPoints = Math.max(5, Math.floor(distance * 20));
  
  for (let i = 1; i < numPoints; i++) {
    const t = i / numPoints;
    
    // Fórmula de curva cuadrática de Bézier
    const x = Math.pow(1 - t, 2) * start.x + 
              2 * (1 - t) * t * controlPoint.x + 
              Math.pow(t, 2) * end.x;
              
    const y = Math.pow(1 - t, 2) * start.y + 
              2 * (1 - t) * t * controlPoint.y + 
              Math.pow(t, 2) * end.y;
    
    points.push({ x, y });
  }
  
  points.push(end);
  return points;
}

// Función principal actualizada
export function findTransitionPath(
  currentPoint: Point,
  targetRoute: Point[],
  useCurvedPath: boolean = false
): Point[] {
  if (useCurvedPath) {
    return generateCurvedTransition(currentPoint, targetRoute[0]);
  } else {
    return findTransitionToRouteStart(currentPoint, targetRoute);
  }
}