// src/components/simulation/Simulation2D.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './modals/SaveRouteModal';
import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import type { Point, ShiftResources } from '../../types';
import type { PathPx } from '../../utils/path';
import type { ActorType } from '../../types/actors';
import { CAN_EDIT } from '../../utils/env';
import { buildPathPx, toNorm } from '../../utils/path';
import { formatHM, shiftForSecond, shiftLabel as labelOf } from '../../utils/time';
import { getScheduleWithRouteDetails } from '../../utils/routes/scheduledRoutes';
import { PREDEFINED_ROUTES } from '../../utils/routes/routes';
import { useHTMLImage } from '../../hooks/useHTMLImage';
import { useStageSize } from '../../hooks/useStageSize';
import { useRoute } from '../../hooks/useRoute';
import { useObstacle } from '../../hooks/useObstacle';
import { PREDEFINED_OBSTACLES } from '../../utils/routes/obstacles';
import { aStarPathfinding } from '../../utils/routes/pathfinding';
import { createFollowRouteTaskForTruck } from '../../utils/routes/scheduledRoutes';
import PalletSpawnPointsLayer from './layers/PalletSpawnPointsLayer';
import ParkingSlotsLayer from './layers/ParkingSlotLayer';
import SaveObstacleModal from './modals/SaveObstacleModal';
import ObstaclesLayer from './layers/ObstaclesLayer';
import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorShape from './layers/ActorsLayer';
import DevToolbar from './DevToolbar';
import { useSimulationEngine } from '../../hooks/useSimulationEngine';

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

export default function Simulation2D({
  running = true,
  resources: resourcesProp,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startupTasksCreatedRef = useRef(false);

  // Imágenes
  const bgImg = useHTMLImage(toUrl(BG_IMPORT));

  // Dimensiones del Stage
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [editMode, setEditMode] = useState<EditMode>('route');
  const [showSaveObstacleModal, setShowSaveObstacleModal] = useState(false);
  const { obstacle, setObstacle, clearObstacle } = useObstacle([]);

  useEffect(() => {
    if (!CAN_EDIT) setEditing(false);
  }, []);

  const { route, setRoute, saveRoute, loadRoute, clearRoute } =
    useRoute(DEFAULT_ROUTE);

  const [activeRouteId, setActiveRouteId] = useState<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const initialRouteIdRef = useRef<string>(
    PREDEFINED_ROUTES[0]?.id || 'route-default'
  );

  const [showPalletSpawnPoints, setShowPalletSpawnPoints] = useState(false);

  // Zoom / Pan (por ahora manual)
  const [stageScale, setStageScale] = useState(1);
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });

  // Recursos por turno (UI)
  const [resources, setResources] = useState<ShiftResources>({
    noche: 0,
    turnoA: 0,
    turnoB: 0,
  });

  useEffect(() => {
    if (!resourcesProp) return;
    setResources(prev => ({
      noche: Math.max(0, Math.floor(resourcesProp.noche ?? prev.noche)),
      turnoA: Math.max(0, Math.floor(resourcesProp.turnoA ?? prev.turnoA)),
      turnoB: Math.max(0, Math.floor(resourcesProp.turnoB ?? prev.turnoB)),
    }));
  }, [resourcesProp]);

  // Configuración de actores
  const [actorCounts] = useState<Record<ActorType, number>>({
    truck1: 26,
    truck2: 0,
    truck3: 0,
    truck4: 0,
    crane1: 1,
  });

  // 🔥 Engine de simulación (tiempo + actores + tareas + parking)
  const {
    simTimeSec,
    speedMult,
    setSpeedMult,
    addTask,
    actorStates,
    setActorStates,
    actorsLoading,
  } = useSimulationEngine({
    running,
    editing,
    actorCounts,
    initialRouteId: initialRouteIdRef.current,
    stageWidth: stageDims.w,
    stageHeight: stageDims.h,
  });

  // Selección manual de ruta para visualización / edición
  const handleRouteSelect = (routeId: string) => {
    if (editing) {
      alert('Termina de editar la ruta actual primero');
      return;
    }

    const selectedRoute = PREDEFINED_ROUTES.find(r => r.id === routeId);
    if (selectedRoute) {
      console.log(`🎯 Ruta seleccionada manualmente: "${selectedRoute.name}"`);
      setActiveRouteId(routeId);

      const safePoints = applyAvoidObstaclesToRoute(selectedRoute.points);
      setRoute(safePoints);

      // Opcional: actualizar ruta de actores móviles si quieres que sigan esta ruta
      setActorStates(prevStates =>
        prevStates.map(actor => {
          if (actor.behavior === 'mobile') {
            return {
              ...actor,
              routeId: routeId,
              cursor: 0,
              direction: 1,
            };
          }
          return actor;
        })
      );
    }
  };

  // Shift actual y recursos activos
  const currentShift = useMemo(
    () => shiftForSecond(simTimeSec),
    [simTimeSec]
  );
  const activeCount = useMemo(
    () => Math.min(20, Math.max(0, resources[currentShift])),
    [resources, currentShift]
  );

  // 🧠 Tareas iniciales para camiones en parking (secuencial por dependsOn)
  useEffect(() => {
    if (startupTasksCreatedRef.current) return;
    if (actorStates.length === 0) return;

    const trucksInParking = actorStates.filter(
      a => a.type === 'truck1' && a.parkingSlotId
    );

    if (trucksInParking.length === 0) return;

    let previousTaskId: string | undefined;

    trucksInParking.forEach(actor => {
      try {
        const task = createFollowRouteTaskForTruck(
          actor.id,
          actor.type,
          actor.parkingSlotId!,
          {
            startAtSimTime: '00:00',
            dependsOn: previousTaskId ? [previousTaskId] : undefined,
          }
        );

        addTask(task);
        previousTaskId = task.id;
      } catch (error) {
        console.error(`Error creando tarea para actor ${actor.id}:`, error);
      }
    });

    startupTasksCreatedRef.current = true;
  }, [actorStates, addTask]);

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

  // Guardar obstáculo
  const handleSaveObstacle = () => {
    if (obstacle.length < 3) {
      alert('El obstáculo debe tener al menos 3 puntos');
      return;
    }
    setShowSaveObstacleModal(true);
  };

  // Guardar ruta
  const handleSaveRoute = () => {
    if (route.length < 2) {
      alert('La ruta debe tener al menos 2 puntos');
      return;
    }
    setShowSaveModal(true);
  };

  // Info de horarios programados (para el panel inferior derecho)
  const scheduleDetails = getScheduleWithRouteDetails();

  // Aplicar A* entre puntos de la ruta para evitar obstáculos
  function applyAvoidObstaclesToRoute(routePoints: Point[]): Point[] {
    if (routePoints.length < 2) return routePoints;

    const safeRoute: Point[] = [routePoints[0]];

    for (let i = 1; i < routePoints.length; i++) {
      const start = safeRoute[safeRoute.length - 1];
      const end = routePoints[i];

      const segmentPath = aStarPathfinding(start, end, PREDEFINED_OBSTACLES);
      safeRoute.push(...segmentPath.slice(1)); // evitar duplicar start
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
          // Si quieres que el botón resetee el tiempo,
          // expón una función resetSimTime en useSimulationEngine y llámala aquí.
          // Por ahora, solo reseteamos visualmente si quieres:
          // setSimTimeSec(0);  <-- simTimeSec ahora vive en el hook
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
            <div
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '5px 10px',
                borderRadius: 4,
                zIndex: 1000,
              }}
            >
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
            <BackgroundLayer
              w={stageDims.w}
              h={stageDims.h}
              bgImg={bgImg}
              scale={stageDims.scale}
            />

            <ObstaclesLayer
              w={stageDims.w}
              h={stageDims.h}
              obstacles={PREDEFINED_OBSTACLES}
              editingObstacle={editMode === 'obstacle' ? obstacle : undefined}
              editing={editing && editMode === 'obstacle'}
              canEdit={CAN_EDIT}
              setObstacle={setObstacle}
              showObstacles={editing && editMode === 'obstacle'}
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

            {
            <PalletSpawnPointsLayer
              stageWidth={stageDims.w}
              stageHeight={stageDims.h}
              showLabels={false}
              showEmptySlots={true}
            />
            }

            <Layer>
              {actorStates.map(actor => {
                let pathToRender: PathPx;

                if (actor.currentTransition?.isTransitioning) {
                  // Transición (ej: ruta → slot de carga)
                  pathToRender = buildPathPx(
                    actor.currentTransition.transitionPath,
                    stageDims.w,
                    stageDims.h
                  );
                } else if (
                  actor.parkingPosition &&
                  actor.cursor === 0 &&
                  !actor.currentTransition?.isTransitioning
                ) {
                  // Actor estacionado en parking
                  const parkingRoute: Point[] = [
                    { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
                    { x: actor.parkingPosition.x, y: actor.parkingPosition.y },
                  ];
                  pathToRender = buildPathPx(
                    parkingRoute,
                    stageDims.w,
                    stageDims.h
                  );
                } else {
                  // Movimiento normal por ruta
                  const actorRoute = PREDEFINED_ROUTES.find(
                    r => r.id === actor.routeId
                  );
                  if (!actorRoute) return null;
                  pathToRender = buildPathPx(
                    actorRoute.points,
                    stageDims.w,
                    stageDims.h
                  );
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

      {/* Panel de información de rutas */}
      <div
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'white',
          padding: 10,
          border: '1px solid #ccc',
          borderRadius: 8,
          fontSize: '12px',
          maxWidth: 280,
        }}
      >
        <h4>📍 Estado de Rutas:</h4>

        {actorStates.some(a => a.currentTransition?.isTransitioning) ? (
          <div
            style={{
              background: '#fff3cd',
              padding: '5px',
              borderRadius: '4px',
              marginBottom: '8px',
            }}
          >
            {actorStates
              .filter(a => a.currentTransition?.isTransitioning)
              .map(actor => (
                <div key={actor.id} style={{ marginBottom: '8px' }}>
                  <div>
                    <strong>🔄 {actor.id} transicionando...</strong>
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    De: {actor.currentTransition?.fromRoute?.name}
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    A: {actor.currentTransition?.toRoute.name}
                  </div>
                  <div style={{ fontSize: '10px' }}>
                    Progreso:{' '}
                    {Math.round(
                      (actor.currentTransition?.progress || 0) * 100
                    )}
                    %
                  </div>
                  <div
                    style={{
                      background: '#007bff',
                      height: '4px',
                      borderRadius: '2px',
                      marginTop: '4px',
                      marginBottom: '4px',
                    }}
                  >
                    <div
                      style={{
                        background: '#28a745',
                        height: '100%',
                        width: `${
                          (actor.currentTransition?.progress || 0) * 100
                        }%`,
                        borderRadius: '2px',
                        transition: 'width 0.1s',
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div>
            <strong>Ruta activa:</strong>{' '}
            {PREDEFINED_ROUTES.find(r => r.id === activeRouteId)?.name ||
              'N/A'}
          </div>
        )}

        <div>🚛 Estacionados: {stationaryActors.length}</div>
        <div>🏃 Móviles: {mobileActors.length}</div>
        <hr style={{ margin: '8px 0' }} />
        <div>Hora actual: {formatHM(simTimeSec)}</div>
        <hr style={{ margin: '8px 0' }} />
        <div>Horarios programados:</div>
        {scheduleDetails.map(({ schedule, route }) => (
          <div
            key={schedule.routeId}
            style={{
              fontSize: '10px',
              opacity: route.id === activeRouteId ? 1 : 0.6,
              fontWeight: route.id === activeRouteId ? 'bold' : 'normal',
              padding: '2px 0',
            }}
          >
            {schedule.startTime} - {route.name}
          </div>
        ))}
      </div>
    </div>
  );
}
