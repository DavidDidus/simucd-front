import type { Point } from "../types";
import routesData from "../data/routes.json";

export interface PredefinedRoute {
  id: string;
  name: string;
  description: string;
  points: Point[];
  eventTypes?: string[];
  shifts?: string[];
  priority?: number;
}

// Importar rutas desde JSON

export const PREDEFINED_ROUTES: PredefinedRoute[] = routesData.routes;

// Helper: Obtener ruta por ID
export function getRouteById(id: string): PredefinedRoute | undefined {
  return PREDEFINED_ROUTES.find((r) => r.id === id);
}

// Helper: Ruta por defecto
export function getDefaultRoute(): PredefinedRoute {
  return PREDEFINED_ROUTES[0] || {
    id: "fallback",
    name: "Ruta básica",
    description: "Ruta de respaldo",
    points: [
      { x: 0.06, y: 0.76 },
      { x: 0.94, y: 0.76 },
    ],
    priority: 999,
  };
}

// Helper: Generar JSON para copiar al portapapeles
export function generateRouteJSON(
  name: string,
  description: string,
  points: Point[],
  options?: {
    eventTypes?: string[];
    shifts?: string[];
    priority?: number;
  }
): string {
  const route: PredefinedRoute = {
    id: `route-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
    name,
    description,
    points,
    ...options,
  };

  return JSON.stringify(route, null, 2);
}

// Helper: Formatear para agregar al archivo routes.json
export function formatForRoutesFile(routeJSON: string): string {
  return `
// 👇 Copia esto y agrégalo al array "routes" en src/data/routes.json

${routeJSON},

// 👆 No olvides la coma al final si hay más rutas después
`;
}