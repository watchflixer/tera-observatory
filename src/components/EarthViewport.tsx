import { Compass, Crosshair, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ATMOSPHERE_LAYERS,
  HISTORY_ERAS,
  INTERIOR_LAYERS,
  LEAFLET_BASE_LAYERS,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
  type ObservatoryMode,
} from '../data/earthData';
import { EarthScene, type SceneControlState } from '../three/EarthScene';
import type { InspectedLocation } from '../utils/geocoding';

interface EarthViewportProps {
  sceneState: SceneControlState;
  sceneRef: React.MutableRefObject<EarthScene | null>;
  onSelectInterior: (id: InteriorLayerId) => void;
  onSelectAtmosphere: (id: AtmosphereLayerId) => void;
  onSelectLandmark: (id: string) => void;
  onInspectLocation: (coords: { lat: number; lon: number }) => void;
  onSelectSpaceObject: (obj: { kind: 'satellite' | 'asteroid'; id: string }) => void;
  onCameraZoomUpdate: (info: {
    centerCoords: { lat: number; lon: number };
    altitudeKm: number;
    leafletZoom: number;
  }) => void;
  cameraTelemetry: {
    altitudeKm: number;
    leafletZoom: number;
    focusedLabel: string | null;
  } | null;
  inspectedLocation: InspectedLocation | null;
  onZoomToInspected: () => void;
  onClearInspected: () => void;
  dossierOpen: boolean;
  zenMode: boolean;
}

export function EarthViewport({
  sceneState,
  sceneRef,
  onSelectInterior,
  onSelectAtmosphere,
  onSelectLandmark,
  onInspectLocation,
  onSelectSpaceObject,
  onCameraZoomUpdate,
  cameraTelemetry,
  inspectedLocation,
  onZoomToInspected,
  onClearInspected,
  dossierOpen,
  zenMode,
}: EarthViewportProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>(null);

  // Store callbacks in refs so React UI updates never tear down WebGL
  const callbacksRef = useRef({
    onSelectInterior,
    onSelectAtmosphere,
    onSelectLandmark,
    onInspectLocation,
    onSelectSpaceObject,
    onCameraZoomUpdate,
  });
  callbacksRef.current = {
    onSelectInterior,
    onSelectAtmosphere,
    onSelectLandmark,
    onInspectLocation,
    onSelectSpaceObject,
    onCameraZoomUpdate,
  };

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const engine = new EarthScene(el, sceneState, {
      onSelectInterior: (id) => callbacksRef.current.onSelectInterior(id),
      onSelectAtmosphere: (id) => callbacksRef.current.onSelectAtmosphere(id),
      onSelectLandmark: (id) => callbacksRef.current.onSelectLandmark(id),
      onInspectLocation: (coords) => callbacksRef.current.onInspectLocation(coords),
      onSelectSpaceObject: (obj) => callbacksRef.current.onSelectSpaceObject(obj),
      onCameraZoomUpdate: (info) => callbacksRef.current.onCameraZoomUpdate(info),
      onHoverCoords: (coords) => setHoverCoords(coords),
      onContextLost: () => setContextLost(true),
    });
    sceneRef.current = engine;

    return () => {
      engine.dispose();
      sceneRef.current = null;
    };
    // Mount WebGL once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.updateState(sceneState);
  }, [sceneState, sceneRef]);

  const activeHeadline = getActiveCaption(
    sceneState.mode,
    sceneState.selectedInterior,
    sceneState.selectedAtmosphere,
    sceneState.selectedHistory
  );

  const activeLeafletMeta =
    LEAFLET_BASE_LAYERS.find((b) => b.id === sceneState.leafletBaseLayer) ?? LEAFLET_BASE_LAYERS[0];

  return (
    <div className="relative w-full h-full">
      {/* Isolated WebGL mount container */}
      <div
        ref={mountRef}
        data-testid="earth-canvas-container"
        className="w-full h-full"
        aria-label="Interactive 3D Earth Observatory Viewport"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#000000] p-6">
          <div className="max-w-md border border-neutral-800 bg-[#141414] rounded-xl p-6 text-center space-y-3">
            <h2 className="font-display text-lg font-bold text-white">3D Viewport Suspended</h2>
            <p className="text-sm text-neutral-300">
              WebGL rendering context was interrupted by your browser. Reload the page to restore the 3D globe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-xs font-semibold bg-white text-black rounded-md hover:bg-neutral-200"
            >
              Restore 3D Viewport
            </button>
          </div>
        </div>
      )}

      {/* Minimal Top-Left Focus Caption & Google-Earth Altitude/Location Telemetry */}
      {!zenMode && (
        <div className="fixed top-16 left-3 md:left-6 z-10 pointer-events-none max-w-[235px] sm:max-w-md space-y-2">
          <div>
            <div className="text-[11px] font-medium text-[#e0a43b] tracking-wide truncate">
              {activeHeadline.kicker}
            </div>
            <h1 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight mt-0.5 text-balance leading-snug">
              {activeHeadline.title}
            </h1>
            <p className="text-xs text-neutral-400 mt-1 hidden sm:block">
              Drag to orbit · Scroll to zoom closer · Click any location, satellite, or asteroid
            </p>
          </div>

          {sceneState.mode === 'systems' && (cameraTelemetry || hoverCoords) && (
            <div className="hidden sm:flex flex-wrap items-center gap-1.5">
              {cameraTelemetry && (
                <div className="inline-flex items-center gap-2 text-[11px] font-mono-tabular text-neutral-200 bg-[#141414]/92 border border-neutral-800 rounded-md px-2.5 py-1">
                  <Compass className="w-3 h-3 text-[#e0a43b] shrink-0" />
                  <span>Alt {cameraTelemetry.altitudeKm.toLocaleString()} km</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-[#e0a43b]">z{cameraTelemetry.leafletZoom}</span>
                  {cameraTelemetry.focusedLabel && (
                    <>
                      <span className="text-neutral-600">·</span>
                      <span className="font-sans text-white truncate max-w-[175px]">
                        {cameraTelemetry.focusedLabel}
                      </span>
                    </>
                  )}
                </div>
              )}
              {hoverCoords && (
                <div className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular text-neutral-300 bg-[#141414]/92 border border-neutral-800 rounded-md px-2.5 py-1">
                  <span>
                    {Math.abs(hoverCoords.lat).toFixed(2)}°{hoverCoords.lat >= 0 ? 'N' : 'S'}
                  </span>
                  <span aria-hidden="true" className="text-neutral-600">
                    /
                  </span>
                  <span>
                    {Math.abs(hoverCoords.lon).toFixed(2)}°{hoverCoords.lon >= 0 ? 'E' : 'W'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Compact Location Pill when zoomed/clicked & Field Guide collapsed or on mobile */}
          {sceneState.mode === 'systems' && inspectedLocation && !dossierOpen && (
            <div className="pointer-events-auto inline-flex items-center gap-2 bg-[#141414]/95 border border-[#e0a43b]/60 rounded-lg px-3 py-1.5 shadow-lg">
              <Crosshair className="w-3.5 h-3.5 text-[#e0a43b] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[165px] sm:max-w-[240px]">
                  {inspectedLocation.title}
                </div>
                <div className="text-[10px] font-mono-tabular text-neutral-400 truncate">
                  {inspectedLocation.lat.toFixed(2)}°, {inspectedLocation.lon.toFixed(2)}°
                </div>
              </div>
              <button
                type="button"
                onClick={onZoomToInspected}
                title="Zoom closer to this location"
                className="p-1 text-[#e0a43b] hover:text-white rounded"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClearInspected}
                title="Clear location pin"
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subtle Leaflet Attribution (Bottom-Left Desktop, strictly bounded so it never touches ControlDock) */}
      {!zenMode && sceneState.mode !== 'history' && (
        <div className="fixed bottom-4 left-4 z-10 hidden xl:flex items-center pointer-events-none">
          <div className="text-[11px] text-neutral-400 bg-[#141414]/92 border border-neutral-800 rounded-md px-2.5 py-1 max-w-[235px] truncate">
            {activeLeafletMeta.attribution}
          </div>
        </div>
      )}
    </div>
  );
}

function getActiveCaption(
  mode: ObservatoryMode,
  interiorId: InteriorLayerId,
  atmoId: AtmosphereLayerId,
  eraId: HistoryEraId
): { kicker: string; title: string } {
  if (mode === 'interior') {
    const layer = INTERIOR_LAYERS.find((l) => l.id === interiorId) ?? INTERIOR_LAYERS[0];
    return {
      kicker: `Internal Structure · ${layer.depthKm}`,
      title: layer.name,
    };
  }
  if (mode === 'atmosphere') {
    const layer = ATMOSPHERE_LAYERS.find((l) => l.id === atmoId) ?? ATMOSPHERE_LAYERS[0];
    return {
      kicker: `Atmospheric Envelope · ${layer.altitudeKm}`,
      title: layer.name,
    };
  }
  if (mode === 'history') {
    const era = HISTORY_ERAS.find((e) => e.id === eraId) ?? HISTORY_ERAS[5];
    return {
      kicker: `Deep Time · ${era.timeRange}`,
      title: era.name,
    };
  }
  return {
    kicker: 'Leaflet 3D Globe · Sol III',
    title: 'Earth Systems & Orbital Space',
  };
}
