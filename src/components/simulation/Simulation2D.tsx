import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './modals/SaveRouteModal';
import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import type { Point, ShiftResources } from '../../types';
import type { ActorType } from '../../types/actors';
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
import { useObstacle} from '../../hooks/useObstacle';
import { PREDEFINED_OBSTACLES } from '../../utils/routes/obstacles';
import { aStarPathfinding } from '../../utils/routes/pathfinding';
import SaveObstacleModal from './modals/SaveObstacleModal';
import ObstaclesLayer from './layers/ObstaclesLayer';
import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorsLayer from './layers/ActorsLayer';
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

  const [routeTransition, setRouteTransition] = useState<RouteTransition | null>(null);

  useEffect(() => { if (!CAN_EDIT) setEditing(false); }, []);
  const { route, setRoute, saveRoute, loadRoute, clearRoute } = useRoute(DEFAULT_ROUTE);

  // 🆕 Estado para seguimiento de ruta programada
  const [currentScheduledRouteId, setCurrentScheduledRouteId] = useState<string>('');

  // Simulación: reloj + cursor
  const [simTimeSec, setSimTimeSec] = useState(0);
  const [cursor, setCursor] = useState(0);
  const dirRef = useRef<1 | -1>(1);
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

  // 🆕 Cambio automático de ruta basado en horario usando rutas del JSON
  useEffect(() => {
    if (editing) return;

    const { route: activeRoute, schedule } = getActiveScheduledRoute(simTimeSec);
    
    if (activeRoute.id !== currentScheduledRouteId && !routeTransition) {
      console.log(`🔄 Iniciando transición a ruta: "${activeRoute.name}" considerando obstáculos`);
      
      // Obtener posición actual del actor
      let currentPosition: Point;
      if (pathPx.total > 0 && cursor >= 0) {
        const pose = poseAlongPath(pathPx, cursor);
        currentPosition = {
          x: pose.x / stageDims.w,
          y: pose.y / stageDims.h
        };
      } else {
        currentPosition = route[0] || { x: 0.5, y: 0.5 };
      }

      // Crear transición con obstáculos
      const currentRoute = PREDEFINED_ROUTES.find(r => r.id === currentScheduledRouteId);
      if (currentRoute) {
        const transition = createRouteTransition(
          currentPosition, 
          currentRoute, 
          activeRoute,
          PREDEFINED_OBSTACLES // 🆕 Pasar obstáculos
        );
        setRouteTransition(transition);
      } else {
        setCurrentScheduledRouteId(activeRoute.id);
        setRoute(applyAvoidObstaclesToRoute(activeRoute.points));
        setCursor(0);
      }
    }
  }, [simTimeSec, editing, currentScheduledRouteId, routeTransition, pathPx, cursor, stageDims]);

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
    truck1: 4,
    truck2: 0,
    truck3: 0,
    truck4: 0,
    crane1: 1,
  });

  // Hook para cargar imágenes de actores
  const { actors, loading: actorsLoading } = useActorImages(actorCounts);

  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const handleRouteSelect = (routeId: string) => {
    if (editing) {
      alert('Termina de editar la ruta actual primero');
      return;
    }
    
    const selectedRoute = PREDEFINED_ROUTES.find((r) => r.id === routeId);
    if (selectedRoute) {
      setSelectedRouteId(routeId);
      const safePoints = applyAvoidObstaclesToRoute(selectedRoute.points);
      setRoute(safePoints);
    }
  };

  const currentShift = useMemo(() => shiftForSecond(simTimeSec), [simTimeSec]);
  const activeCount = useMemo(() => Math.min(20, Math.max(0, resources[currentShift])), [resources, currentShift]);

  //Borrame despues de configurar los obstaculos
  const handleWheel = (e: any) => {
  // Solo permitir zoom cuando estás editando obstáculos (opcional)
  if (!editing || editMode !== 'obstacle') return;

  e.evt.preventDefault();

  const scaleBy = 1.05;
  const stage = e.target.getStage();
  const oldScale = stageScale;
  const pointer = stage.getPointerPosition();
  if (!pointer) return;

  // Coordenadas del mouse en el “mundo” antes de cambiar escala
  const mousePointTo = {
    x: (pointer.x - stagePosition.x) / oldScale,
    y: (pointer.y - stagePosition.y) / oldScale,
  };

  // Rueda arriba = zoom in, abajo = zoom out
  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const newScale =
    direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

  // Limitar un poco el zoom
  const finalScale = Math.max(0.5, Math.min(4, newScale));

  // Ajustar posición para que el punto bajo el cursor se mantenga
  const newPos = {
    x: pointer.x - mousePointTo.x * finalScale,
    y: pointer.y - mousePointTo.y * finalScale,
  };

  setStageScale(finalScale);
  setStagePosition(newPos);
};

 // 🆕 Manejar progreso de transición actualizado
  useEffect(() => {
    if (!routeTransition || !running || editing) return;

    const transitionSpeed = 0.015; // Velocidad de transición más lenta para que se vea mejor
    const interval = setInterval(() => {
      setRouteTransition(prev => {
        if (!prev) return null;

        const newProgress = prev.progress + transitionSpeed;
        
        if (newProgress >= 1) {
          // 🆕 Transición completada - actor ahora está en el INICIO de la nueva ruta
          console.log(`✅ Transición completada. Actor llegó al inicio de: ${prev.toRoute.name}`);
          setCurrentScheduledRouteId(prev.toRoute.id);
          setRoute(applyAvoidObstaclesToRoute(prev.toRoute.points));
          
          // 🆕 CRUCIAL: Establecer cursor en 0 para que comience desde el inicio
          // Sin resetear cursor, porque ya está en el inicio correcto
          const initialCursor = 0;
          setCursor(initialCursor);
          
          return null; // Finalizar transición
        }

        return { ...prev, progress: newProgress, targetReached: newProgress > 0.95 };
      });
    }, 50); // Actualizar cada 50ms

    return () => clearInterval(interval);
  }, [routeTransition, running, editing, setRoute]);

  // 🆕 Usar ruta de transición si está activa, sino usar la ruta normal
  const effectiveRoute = useMemo(() => {
    if (routeTransition) {
      return routeTransition.transitionPath;
    }
    return route;
  }, [routeTransition, route]);

  const effectivePathPx = useMemo(
    () => buildPathPx(effectiveRoute, stageDims.w, stageDims.h),
    [effectiveRoute, stageDims.w, stageDims.h]
  );

  // 🆕 Cursor especial para transiciones
  const effectiveCursor = useMemo(() => {
    if (routeTransition) {
      // Durante la transición, el cursor sigue el progreso de la transición
      return routeTransition.progress * effectivePathPx.total;
    }
    return cursor;
  }, [routeTransition, effectivePathPx.total, cursor]);

  // Ticker actualizado para usar cursor efectivo
  useEffect(() => {
    const active = running && !editing && effectivePathPx.total > 0 && !actorsLoading && actors.length > 0;
    if (!active) return;

    // 🆕 No actualizar cursor durante transición
    if (routeTransition) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dtReal = (now - last) / 1000;
      last = now;
      const dtSim = dtReal * speedMult;

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

      const SPEED_PX_PER_SIM_SEC = stageDims.w * 0.03;
      setCursor(prev => {
        let next = prev + dirRef.current * SPEED_PX_PER_SIM_SEC * dtSim;
        if (next > effectivePathPx.total) { next = effectivePathPx.total; dirRef.current = -1; }
        if (next < 0) { next = 0; dirRef.current = 1; }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, editing, effectivePathPx.total, stageDims.w, actorsLoading, actors.length, speedMult, routeTransition]);

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
  const currentRouteInfo = PREDEFINED_ROUTES.find(r => r.id === currentScheduledRouteId);
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
          setCurrentScheduledRouteId('');
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
            onWheel={handleWheel}
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
              route={effectiveRoute}
              editing={editing}
              canEdit={CAN_EDIT}
              setRoute={setRoute}
            />
            <ActorsLayer
              actors={actors}
              path={effectivePathPx}
              cursor={effectiveCursor}
              scale={actorScale}
              editing={editing}
            />
          </Stage>
        </div>

        <SimSidebar 
          simTimeSec={simTimeSec}
          speedMult={speedMult}
          onSpeedChange={setSpeedMult}
          resources={resources}
          currentShift={currentShift}
          selectedRouteId={selectedRouteId}
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
        
        {routeTransition ? (
          <div style={{ background: '#fff3cd', padding: '5px', borderRadius: '4px', marginBottom: '8px' }}>
            <div><strong>🔄 Transicionando...</strong></div>
            <div>De: {routeTransition.fromRoute?.name}</div>
            <div>A: {routeTransition.toRoute.name}</div>
            <div>Progreso: {Math.round(routeTransition.progress * 100)}%</div>
            <div style={{ 
              background: '#007bff', 
              height: '4px', 
              borderRadius: '2px',
              marginTop: '4px'
            }}>
              <div style={{
                background: '#28a745',
                height: '100%',
                width: `${routeTransition.progress * 100}%`,
                borderRadius: '2px',
                transition: 'width 0.1s'
              }} />
            </div>
          </div>
        ) : currentRouteInfo && (
          <>
            <div><strong>{currentRouteInfo.name}</strong></div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>{currentRouteInfo.description}</div>
          </>
        )}
        
        <div>Hora actual: {formatHM(simTimeSec)}</div>
        <hr style={{ margin: '8px 0' }} />
        <div>Horarios programados:</div>
        {scheduleDetails.map(({ schedule, route }) => (
          <div key={schedule.routeId} style={{ 
            fontSize: '10px', 
            opacity: route.id === currentScheduledRouteId ? 1 : 0.6,
            fontWeight: route.id === currentScheduledRouteId ? 'bold' : 'normal',
            padding: '2px 0'
          }}>
            {schedule.startTime} - {route.name}
          </div>
        ))}
      </div>
    </div>
  );
}