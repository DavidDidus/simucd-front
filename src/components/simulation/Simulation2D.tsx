import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage,Layer } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './modals/SaveRouteModal';
import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import type { Point, ShiftResources } from '../../types';
import type { PathPx } from '../../utils/path';
import type { ActorType, ActorState } from '../../types/actors';
import { CAN_EDIT } from '../../utils/env';
import { buildPathPx, toNorm } from '../../utils/path';
import { formatHM, shiftForSecond, shiftLabel as labelOf } from '../../utils/time';
import { getActiveScheduledRoute, getScheduleWithRouteDetails, createRouteTransition, type RouteTransition } from '../../utils/routes/scheduledRoutes';
import { poseAlongPath } from '../../utils/path';
import { PREDEFINED_ROUTES } from '../../utils/routes/routes';
import { useHTMLImage } from '../../hooks/useHTMLImage';
import { useStageSize } from '../../hooks/useStageSize';
import { useRoute } from '../../hooks/useRoute';
import { useActorImages } from '../../hooks/useActorImages';
import { useActorStates } from '../../hooks/useActorStates';
import { useObstacle} from '../../hooks/useObstacle';
import { PREDEFINED_OBSTACLES } from '../../utils/routes/obstacles';
import { aStarPathfinding } from '../../utils/routes/pathfinding';
import ParkingSlotsLayer from './layers/ParkingSlotLayer';
import SaveObstacleModal from './modals/SaveObstacleModal';
import ObstaclesLayer from './layers/ObstaclesLayer';
import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorShape from './layers/ActorsLayer';
import DevToolbar from './DevToolbar';


type EditMode = 'route' | 'obstacle';

type Props = {
  running?: boolean;
  resources?: Partial<ShiftResources>;
};

const DEFAULT_ROUTE: Point[] = [
  { x: 0.06, y: 0.76 },
  { x: 0.94, y: 0.76 },
];

const toUrl = (m: any) => (typeof m === 'string' ? m : m?.src || '');

export default function Simulation2D({ running = true, resources: resourcesProp }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Imágenes
  const bgImg = useHTMLImage(toUrl(BG_IMPORT));

  // Dimensiones del Stage (escala por ancho)
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('route');
  const [showSaveObstacleModal, setShowSaveObstacleModal] = useState(false);
  const { obstacle, setObstacle, clearObstacle } = useObstacle([]);


  useEffect(() => { if (!CAN_EDIT) setEditing(false); }, []);
  const { route, setRoute, saveRoute, loadRoute, clearRoute } = useRoute(DEFAULT_ROUTE);

  const [activeRouteId, setActiveRouteId] = useState<string>(
  PREDEFINED_ROUTES[0]?.id || 'route-default'
);

const initialRouteIdRef = useRef<string>(
  PREDEFINED_ROUTES[0]?.id || 'route-default'
);


  // 🆕 Estado para seguimiento de ruta programada

  // Simulación: reloj + cursor
  const [simTimeSec, setSimTimeSec] = useState(0);
  const [speedMult, setSpeedMult] = useState<number>(1);
  
  //Borrar estos dos despues de configurar los obstaculos
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  const SIM_DAY_SECONDS = 24*60*60; 
  const LOOP_DAY = false;

   const pathPx = useMemo(
    () => buildPathPx(route, stageDims.w, stageDims.h),
    [route, stageDims.w, stageDims.h]
  );

  // Recursos por turno
  const [resources, setResources] = useState<ShiftResources>({ noche: 0, turnoA: 0, turnoB: 0 });
  useEffect(() => {
    if (!resourcesProp) return;
    setResources((prev) => ({
      noche: Math.max(0, Math.floor(resourcesProp.noche ?? prev.noche)),
      turnoA: Math.max(0, Math.floor(resourcesProp.turnoA ?? prev.turnoA)),
      turnoB: Math.max(0, Math.floor(resourcesProp.turnoB ?? prev.turnoB)),
    }));
  }, [resourcesProp]);

  
  // Configuración de actores - solo grúas
  const [actorCounts] = useState<Record<ActorType, number>>({
    truck1: 26,
    truck2: 0,
    truck3: 0,
    truck4: 0,
    crane1: 1,
  });

  // Hook para cargar imágenes de actores
  const { actors, loading: actorsLoading } = useActorImages(actorCounts);

  const { actorStates, setActorStates } = useActorStates(actors, actorsLoading, actorCounts, initialRouteIdRef.current);
  
  const handleRouteSelect = (routeId: string) => {
    if (editing) {
      alert('Termina de editar la ruta actual primero');
      return;
    }
    
    const selectedRoute = PREDEFINED_ROUTES.find((r) => r.id === routeId);
    if (selectedRoute) {
      console.log(`🎯 Ruta seleccionada manualmente: "${selectedRoute.name}"`);
      setActiveRouteId(routeId);
      
      const safePoints = applyAvoidObstaclesToRoute(selectedRoute.points);
      setRoute(safePoints);
      
      // Actualizar actores móviles
      setActorStates(prevStates =>
        prevStates.map(actor => {
          if (actor.behavior === 'mobile') {
            return {
              ...actor,
              routeId: routeId,
              cursor: 0,
              direction: 1
            };
          }
          return actor;
        })
      );
    }
  };

  const currentShift = useMemo(() => shiftForSecond(simTimeSec), [simTimeSec]);
  const activeCount = useMemo(() => Math.min(20, Math.max(0, resources[currentShift])), [resources, currentShift]);
   
  useEffect(() => {
  if (editing) return;

  const { route: scheduledRoute } = getActiveScheduledRoute(simTimeSec);
  
  if (scheduledRoute.id !== activeRouteId) {
    console.log(`⏰ Iniciando transición a ruta programada: "${scheduledRoute.name}"`);
    
    // 🔑 Para cada actor móvil, crear transición individual
    setActorStates(prevStates =>
      prevStates.map(actor => {
        if (actor.behavior !== 'mobile') return actor;

        // Obtener posición actual del actor
        const currentRoute = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
        if (!currentRoute) return actor;

        const currentPathPx = buildPathPx(currentRoute.points, stageDims.w, stageDims.h);
        if (currentPathPx.total === 0) return actor;

        // Calcular posición actual en coordenadas normalizadas
        const pose = poseAlongPath(currentPathPx, actor.cursor);
        const currentPosition: Point = {
          x: pose.x / stageDims.w,
          y: pose.y / stageDims.h
        };

        // 🆕 Crear transición usando A* hacia el inicio de la nueva ruta
        const targetPosition = scheduledRoute.points[0]; // Primer punto de la nueva ruta
        
        // 🔑 Usar A* para encontrar camino evitando obstáculos
        const transitionPath = aStarPathfinding(
          currentPosition,
          targetPosition,
          PREDEFINED_OBSTACLES
        );

        console.log(`🔄 Actor ${actor.id}: Transición de "${currentRoute.name}" a "${scheduledRoute.name}"`);
        console.log(`   Posición actual: (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)})`);
        console.log(`   Destino: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)})`);
        console.log(`   Puntos de transición: ${transitionPath.length}`);

        // Crear objeto de transición
        const transition: RouteTransition = {
          isTransitioning: true,
          transitionPath: transitionPath,
          fromRoute: currentRoute,
          toRoute: scheduledRoute,
          progress: 0,
          targetReached: false
        };

        return {
          ...actor,
          currentTransition: transition,
          cursor: 0, // Cursor de transición comienza en 0
          direction: 1 // Siempre hacia adelante en transiciones
        };
      })
    );

    setActiveRouteId(scheduledRoute.id);
  }
}, [simTimeSec, editing, activeRouteId, stageDims.w, stageDims.h, setActorStates]);



  useEffect(() => {
  const active = running && !editing && !actorsLoading && actorStates.length > 0;
  if (!active) return;

  let raf = 0;
  let last = performance.now();

  const tick = (now: number) => {
    const dtReal = (now - last) / 1000;
    last = now;
    const dtSim = dtReal * speedMult;

    // Actualizar reloj
    if (LOOP_DAY) {
      setSimTimeSec(t => (t + dtSim) % SIM_DAY_SECONDS);
    } else {
      let stop = false;
      setSimTimeSec(t => {
        const next = t + dtSim;
        if (next >= SIM_DAY_SECONDS) { stop = true; return SIM_DAY_SECONDS; }
        return next;
      });
      if (stop) return;
    }

    // 🔑 ACTUALIZAR ACTORES (transiciones Y movimiento normal)
    setActorStates(prevStates => 
      prevStates.map(actor => {
        if (actor.behavior !== 'mobile') return actor;

        // 🆕 CASO 1: Actor en transición
        if (actor.currentTransition?.isTransitioning) {
          const transition = actor.currentTransition;
          const transitionPathPx = buildPathPx(transition.transitionPath, stageDims.w, stageDims.h);
          
          if (transitionPathPx.total === 0) {
            console.warn('⚠️ Path de transición vacío, finalizando transición');
            return {
              ...actor,
              currentTransition: undefined,
              routeId: transition.toRoute.id,
              cursor: 0,
              direction: 1
            };
          }

          const SPEED = stageDims.w * 0.02; // Velocidad para transiciones
          let newCursor = actor.cursor + (SPEED * dtSim);
          
          // 🔑 Si llegó al final de la transición
          if (newCursor >= transitionPathPx.total) {
            console.log(`✅ Actor ${actor.id}: Transición completada a "${transition.toRoute.name}"`);
            return {
              ...actor,
              currentTransition: undefined,
              routeId: transition.toRoute.id,
              cursor: 0,
              direction: 1
            };
          }

          // Continuar transición
          return {
            ...actor,
            cursor: newCursor,
            currentTransition: {
              ...transition,
              progress: newCursor / transitionPathPx.total,
              targetReached: newCursor > transitionPathPx.total * 0.95
            }
          };
        }

        // 🆕 CASO 2: Movimiento normal (sin transición)
        const actorRoute = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
        if (!actorRoute) {
          console.warn(`⚠️ Actor ${actor.id} tiene routeId inválido: ${actor.routeId}`);
          return actor;
        }

        const actorPathPx = buildPathPx(actorRoute.points, stageDims.w, stageDims.h);
        if (actorPathPx.total === 0) {
          console.warn(`⚠️ Ruta "${actorRoute.name}" no tiene puntos válidos`);
          return actor;
        }

        const SPEED = stageDims.w * 0.03 * actor.speed;
        const currentDirection = actor.direction || 1;
        
        let newCursor = actor.cursor + (SPEED * dtSim * currentDirection);
        let newDirection = currentDirection;
        
        // Rebote en los extremos
        if (newCursor >= actorPathPx.total) {
          newCursor = actorPathPx.total;
          newDirection = -1;
        } else if (newCursor <= 0) {
          newCursor = 0;
          newDirection = 1;
        }
        
        return { 
          ...actor, 
          cursor: newCursor,
          direction: newDirection
        };
      })
    );

    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
 }, [running, editing, actorStates.length, stageDims.w, stageDims.h, speedMult, actorsLoading]);

 
  // Escala dinámica basada en el tamaño del stage
  const actorScale = useMemo(() => {
    const targetScale = stageDims.w * 0.00008;
    return Math.max(0.3, Math.min(1.2, targetScale));
  }, [stageDims.w]);

  // Click para añadir puntos (solo en dev + edición)
  const onStageClick = (e: any) => {
  if (!CAN_EDIT || !editing) return;
  if (e.evt?.button !== 0) return; // solo click izquierdo

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  // Pasar de coordenadas de pantalla -> coordenadas del mundo (sin zoom ni pan)
  const localPos = {
    x: (pointer.x - stagePosition.x) / stageScale,
    y: (pointer.y - stagePosition.y) / stageScale,
  };

  const point = toNorm(localPos.x, localPos.y, stageDims.w, stageDims.h);

  if (editMode === 'route') {
    setRoute((r: Point[]) => [...r, point]);
  } else {
    setObstacle((o: Point[]) => [...o, point]);
  }
};

  // Handler para guardar obstáculo
  const handleSaveObstacle = () => {
    if (obstacle.length < 3) {
      alert("El obstáculo debe tener al menos 3 puntos");
      return;
    }
    setShowSaveObstacleModal(true);
  };

  // Handler para guardar ruta
  const handleSaveRoute = () => {
    if (route.length < 2) {
      alert("La ruta debe tener al menos 2 puntos");
      return;
    }
    setShowSaveModal(true);
  };

  // 🆕 Información de ruta actual y horarios programados
  const scheduleDetails = getScheduleWithRouteDetails();

  function applyAvoidObstaclesToRoute(route: Point[]): Point[] {
  if (route.length < 2) return route;

  const safeRoute: Point[] = [route[0]];

  for (let i = 1; i < route.length; i++) {
    const start = safeRoute[safeRoute.length - 1];
    const end = route[i];

    // Encontrar un camino seguro entre start y end
    const segmentPath = aStarPathfinding(start, end, PREDEFINED_OBSTACLES);

    // segmentPath incluye start, así que evitamos duplicarlo
    safeRoute.push(...segmentPath.slice(1));
  }

  return safeRoute;
}

const mobileActors = actorStates.filter(a => a.behavior === 'mobile');
const stationaryActors = actorStates.filter(a => a.behavior === 'stationary');


  return (
    <div>
      <DevToolbar
        editing={editing}
        setEditing={setEditing}
        saveRoute={handleSaveRoute}
        clearRoute={clearRoute}
        loadRoute={loadRoute}
        resources={resources}
        setResources={setResources}
        resetClock={() => {
          setSimTimeSec(0);
        }}
        editMode={editMode}
        onEditModeChange={setEditMode}
        saveObstacle={handleSaveObstacle}
        clearObstacle={clearObstacle}
      />

      {/* Modal para guardar obstáculo */}
      {showSaveObstacleModal && (
        <SaveObstacleModal
          points={obstacle}
          onClose={() => setShowSaveObstacleModal(false)}
        />
      )}

      {/* Modal para guardar ruta */}
      {showSaveModal && (
        <SaveRouteModal
          points={route}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 260px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div ref={wrapRef} style={{ borderRadius: 8, overflow: 'hidden' }}>
          {actorsLoading && (
            <div style={{ 
              position: 'absolute', 
              top: 10, 
              left: 10, 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '5px 10px', 
              borderRadius: 4,
              zIndex: 1000
            }}>
              Cargando actores...
            </div>
          )}
          
          <Stage
            width={stageDims.w}
            height={stageDims.h}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePosition.x}
            y={stagePosition.y}
            onMouseDown={onStageClick}
            style={{ cursor: CAN_EDIT && editing ? 'crosshair' : 'default' }}
          >
            <BackgroundLayer w={stageDims.w} h={stageDims.h} bgImg={bgImg} scale={stageDims.scale} />
            <ObstaclesLayer
              w={stageDims.w}
              h={stageDims.h}
              obstacles={PREDEFINED_OBSTACLES}
              editingObstacle={editMode === 'obstacle' ? obstacle : undefined}
              editing={editing && editMode === 'obstacle'}
              canEdit={CAN_EDIT}
              setObstacle={setObstacle}
              showObstacles={editing && editMode === 'obstacle'} // 🆕 Mostrar solo en edición de obstáculos
            />
            <HUDLayer
              w={stageDims.w}
              clock={formatHM(simTimeSec)}
              shiftLabel={labelOf(currentShift)}
              resources={resources}
              activeCount={activeCount}
            />
            <RouteLayer
              w={stageDims.w}
              h={stageDims.h}
              route={route}
              editing={editing}
              canEdit={CAN_EDIT}
              setRoute={setRoute}
            />
            <ParkingSlotsLayer
              stageWidth={stageDims.w}
              stageHeight={stageDims.h}
              showLabels={editing}
            />

            <Layer>
              {actorStates.map(actor => {
                let pathToRender: PathPx;
                
                if (actor.currentTransition?.isTransitioning) {
                  pathToRender = buildPathPx(
                    actor.currentTransition.transitionPath, 
                    stageDims.w, 
                    stageDims.h
                  );
                } else {
                  const route = PREDEFINED_ROUTES.find(r => r.id === actor.routeId);
                  if (!route) return null;
                  pathToRender = buildPathPx(route.points, stageDims.w, stageDims.h);
                }
                
                return (
                  <ActorShape
                    key={actor.id}
                    actor={actor}
                    path={pathToRender}
                    cursor={actor.cursor}
                    scale={actorScale}
                    editing={editing}
                    stageWidth={stageDims.w}
                    stageHeight={stageDims.h}
                  />
                );
              })}
            </Layer>
          </Stage>
        </div>

        <SimSidebar 
          simTimeSec={simTimeSec}
          speedMult={speedMult}
          onSpeedChange={setSpeedMult}
          resources={resources}
          currentShift={currentShift}
          selectedRouteId={activeRouteId}
          onRouteSelect={handleRouteSelect} 
        />
      </div>

      {/* 🆕 Panel de información mejorado con rutas del JSON */}
      <div style={{ 
  position: 'fixed', 
  bottom: 10, 
  right: 10, 
  background: 'white', 
  padding: 10, 
  border: '1px solid #ccc',
  borderRadius: 8,
  fontSize: '12px',
  maxWidth: 280
}}>
  <h4>📍 Estado de Rutas:</h4>
  
  {/* 🆕 Mostrar transiciones activas de los actores */}
  {actorStates.some(a => a.currentTransition?.isTransitioning) ? (
    <div style={{ background: '#fff3cd', padding: '5px', borderRadius: '4px', marginBottom: '8px' }}>
      {actorStates
        .filter(a => a.currentTransition?.isTransitioning)
        .map(actor => (
          <div key={actor.id} style={{ marginBottom: '8px' }}>
            <div><strong>🔄 {actor.id} transicionando...</strong></div>
            <div style={{ fontSize: '10px' }}>
              De: {actor.currentTransition?.fromRoute?.name}
            </div>
            <div style={{ fontSize: '10px' }}>
              A: {actor.currentTransition?.toRoute.name}
            </div>
            <div style={{ fontSize: '10px' }}>
              Progreso: {Math.round((actor.currentTransition?.progress || 0) * 100)}%
            </div>
            <div style={{ 
              background: '#007bff', 
              height: '4px', 
              borderRadius: '2px',
              marginTop: '4px',
              marginBottom: '4px'
            }}>
              <div style={{
                background: '#28a745',
                height: '100%',
                width: `${(actor.currentTransition?.progress || 0) * 100}%`,
                borderRadius: '2px',
                transition: 'width 0.1s'
              }} />
            </div>
          </div>
        ))}
    </div>
  ) : (
    <div>
      <strong>Ruta activa:</strong> {PREDEFINED_ROUTES.find(r => r.id === activeRouteId)?.name || 'N/A'}
    </div>
  )}
  
  <div>🚛 Estacionados: {stationaryActors.length}</div>
  <div>🏃 Móviles: {mobileActors.length}</div>
  <hr style={{ margin: '8px 0' }} />
  <div>Hora actual: {formatHM(simTimeSec)}</div>
  <hr style={{ margin: '8px 0' }} />
  <div>Horarios programados:</div>
  {scheduleDetails.map(({ schedule, route }) => (
    <div key={schedule.routeId} style={{ 
      fontSize: '10px', 
      opacity: route.id === activeRouteId ? 1 : 0.6,
      fontWeight: route.id === activeRouteId ? 'bold' : 'normal',
      padding: '2px 0'
    }}>
      {schedule.startTime} - {route.name}
    </div>
  ))}
</div>
    </div>
  );
}