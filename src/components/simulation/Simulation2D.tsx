import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from 'react-konva';
import SimSidebar from './SimSidebar';
import SaveRouteModal from './SaveRouteModal'; // 🆕

import BG_IMPORT from '../../assets/Simulacion/PATIO.png';
import FORKLIFT_IMPORT from '../../assets/Simulacion/GRUA_HORQUILLA.png';

import type { Point, ShiftResources } from '../../types';
import { CAN_EDIT } from '../../utils/env';
import { buildPathPx, toNorm } from '../../utils/path';
import { formatHM, shiftForSecond, shiftLabel as labelOf } from '../../utils/time';

import { useHTMLImage } from '../../hooks/useHTMLImage';
import { useStageSize } from '../../hooks/useStageSize';
import { useRoute } from '../../hooks/useRoute';

import BackgroundLayer from './layers/BackgroundLayer';
import HUDLayer from './layers/HudLayer';
import RouteLayer from './layers/RouteLayer';
import ActorsLayer from './layers/ActorsLayer';
import DevToolbar from './DevToolbar';
import { PREDEFINED_ROUTES } from '../../utils/routes';

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
  const forkliftImg = useHTMLImage(toUrl(FORKLIFT_IMPORT));

  // Dimensiones del Stage (escala por ancho)
  const stageDims = useStageSize(wrapRef, bgImg?.width, bgImg?.height);

  // Ruta + edición
  const [editing, setEditing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false); // 🆕
  useEffect(() => { if (!CAN_EDIT) setEditing(false); }, []);
  const { route, setRoute, saveRoute, loadRoute, clearRoute } = useRoute(DEFAULT_ROUTE);

  // Path en píxeles
  const pathPx = useMemo(
    () => buildPathPx(route, stageDims.w, stageDims.h),
    [route, stageDims.w, stageDims.h]
  );

  // Simulación: reloj + cursor
  const [simTimeSec, setSimTimeSec] = useState(0);
  const [cursor, setCursor] = useState(0);
  const dirRef = useRef<1 | -1>(1);
  const [speedMult, setSpeedMult] = useState<number>(1);

  const SIM_DAY_SECONDS = 24*60*60; 
  const LOOP_DAY = false;

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
      setRoute(selectedRoute.points);
    }
  };

  const currentShift = useMemo(() => shiftForSecond(simTimeSec), [simTimeSec]);
  const activeCount = useMemo(() => Math.min(20, Math.max(0, resources[currentShift])), [resources, currentShift]);

  // Ticker (mientras corre la simulación y no editas)
  useEffect(() => {
    const active = running && !editing && pathPx.total > 0 && !!forkliftImg;
    if (!active) return;

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
        if (next > pathPx.total) { next = pathPx.total; dirRef.current = -1; }
        if (next < 0) { next = 0; dirRef.current = 1; }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, editing, pathPx.total, stageDims.w, forkliftImg, speedMult]);

  // Escala sprite
  const forkliftScale = useMemo(() => {
    if (!forkliftImg) return 1;
    const targetW = stageDims.w * 0.025;
    return targetW / forkliftImg.width;
  }, [forkliftImg, stageDims.w]);

  // Click para añadir puntos (solo en dev + edición)
  const onStageClick = (e: any) => {
    if (!CAN_EDIT || !editing) return;
    if (e.evt?.button !== 0) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    setRoute((r: Point[]) => [...r, toNorm(pos.x, pos.y, stageDims.w, stageDims.h)]);
  };

  // 🆕 Handler para guardar ruta
  const handleSaveRoute = () => {
    if (route.length < 2) {
      alert("La ruta debe tener al menos 2 puntos");
      return;
    }
    setShowSaveModal(true);
  };

  return (
    <div>
      <DevToolbar
        editing={editing}
        setEditing={setEditing}
        saveRoute={handleSaveRoute} // 🆕 Cambiar a handleSaveRoute
        clearRoute={clearRoute}
        loadRoute={loadRoute}
        resources={resources}
        setResources={setResources}
        resetClock={() => setSimTimeSec(0)}
      />

      {/* 🆕 Modal para guardar ruta */}
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
          <Stage
            width={stageDims.w}
            height={stageDims.h}
            onMouseDown={onStageClick}
            style={{ cursor: CAN_EDIT && editing ? 'crosshair' : 'default' }}
          >
            <BackgroundLayer w={stageDims.w} h={stageDims.h} bgImg={bgImg} scale={stageDims.scale} />
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
            <ActorsLayer
              count={activeCount}
              path={pathPx}
              cursor={cursor}
              forkliftImg={forkliftImg}
              scale={forkliftScale}
              editing={editing}
            />
          </Stage>
        </div>

         {/* ✅ Sidebar separado */}
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
    </div>
  );
}