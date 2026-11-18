import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { DossierPanel } from './components/DossierPanel';
import { EarthViewport } from './components/EarthViewport';
import { ExtinctAtlasModal } from './components/ExtinctAtlasModal';
import { LifeHistoryAtlas, type AtlasSectionTab } from './components/LifeHistoryAtlas';
import { TopBar } from './components/TopBar';
import {
  EARTH_LANDMARKS,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
  type ObservatoryMode,
} from './data/earthData';
import type { LifeCategory, LifeStatus } from './data/lifeHistoryData';
import type { EarthOverviewWikiTopic } from './data/wikiTopicMap';
import type { EarthScene, SceneControlState } from './three/EarthScene';
import { classifyOceanOrRegion } from './utils/earthMath';
import {
  getInstantLocationFallback,
  reverseGeocodeLocation,
  searchLocationByName,
  type InspectedLocation,
} from './utils/geocoding';

export default function App() {
  const sceneRef = useRef<EarthScene | null>(null);
  const clickGeocodeAbortRef = useRef<AbortController | null>(null);
  const zoomGeocodeAbortRef = useRef<AbortController | null>(null);
  const zoomTimerRef = useRef<number>(0);

  const [mode, setMode] = useState<ObservatoryMode>('systems');
  const [cutawayDegrees, setCutawayDegrees] = useState<number>(0);
  const [explodeFactor, setExplodeFactor] = useState<number>(0);

  const [selectedInterior, setSelectedInterior] = useState<InteriorLayerId>('inner-core');
  const [selectedAtmosphere, setSelectedAtmosphere] = useState<AtmosphereLayerId>('troposphere');
  const [selectedHistory, setSelectedHistory] = useState<HistoryEraId>('cenozoic');
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | null>('everest');

  const [inspectedCoords, setInspectedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [inspectedLocation, setInspectedLocation] = useState<InspectedLocation | null>(null);
  const [selectedSpaceObject, setSelectedSpaceObject] = useState<{
    kind: 'satellite' | 'asteroid';
    id: string;
  } | null>(null);
  const [cameraTelemetry, setCameraTelemetry] = useState<{
    altitudeKm: number;
    leafletZoom: number;
    focusedLabel: string | null;
  } | null>(null);

  const leafletBaseLayer = 'satellite' as const;
  const [showLeafletLabels, setShowLeafletLabels] = useState<boolean>(true);

  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [showTectonics, setShowTectonics] = useState<boolean>(false);
  const [showMagnetosphere, setShowMagnetosphere] = useState<boolean>(false);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(false);
  const [showSatellites, setShowSatellites] = useState<boolean>(false);
  const [showAsteroids, setShowAsteroids] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);

  const [dossierOpen, setDossierOpen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [lifeAtlasOpen, setLifeAtlasOpen] = useState<boolean>(false);
  const [lifeAtlasEntryId, setLifeAtlasEntryId] = useState<string | null>(null);
  const [lifeAtlasEraTopicId, setLifeAtlasEraTopicId] = useState<
    EarthOverviewWikiTopic['id'] | null
  >(null);
  const [lifeAtlasCategory, setLifeAtlasCategory] = useState<LifeCategory | 'all'>('all');
  const [lifeAtlasStatus, setLifeAtlasStatus] = useState<LifeStatus | 'all'>('all');
  const [lifeAtlasTab, setLifeAtlasTab] = useState<AtlasSectionTab>('article');
  const [extinctModalOpen, setExtinctModalOpen] = useState<boolean>(false);

  // Keyboard shortcut 'H' for Zen Mode (Full View) and responsive mobile dossier behavior
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'h') {
        setZenMode((z) => !z);
      }
    };
    const onResize = () => {
      if (window.innerWidth < 768) {
        setDossierOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      clickGeocodeAbortRef.current?.abort();
      zoomGeocodeAbortRef.current?.abort();
      clearTimeout(zoomTimerRef.current);
    };
  }, []);

  const handleModeChange = useCallback((nextMode: ObservatoryMode) => {
    setMode(nextMode);
    if (nextMode !== 'history') {
      setLifeAtlasOpen(false);
      setExtinctModalOpen(false);
    }
    if (nextMode === 'interior') {
      setCutawayDegrees((deg) => (deg < 20 ? 95 : deg));
      sceneRef.current?.focusCameraPreset('cutaway');
    } else if (nextMode === 'atmosphere') {
      setCutawayDegrees(0);
      setExplodeFactor(0);
      sceneRef.current?.focusCameraPreset('atmosphere');
    } else if (nextMode === 'history') {
      setCutawayDegrees(0);
      setExplodeFactor(0);
      setSelectedHistory((prev) => (prev === 'cenozoic' ? 'hadean' : prev));
      sceneRef.current?.focusCameraPreset('reset');
    } else {
      setCutawayDegrees(0);
      setExplodeFactor(0);
      sceneRef.current?.focusCameraPreset('systems');
    }
  }, []);

  const handleOpenLifeAtlas = useCallback(
    (opts?: {
      entryId?: string;
      eraTopicId?: EarthOverviewWikiTopic['id'];
      category?: LifeCategory | 'all';
      status?: LifeStatus | 'all';
      tab?: AtlasSectionTab;
    }) => {
      setMode('history');
      setLifeAtlasStatus(opts?.status ?? 'all');
      setLifeAtlasTab(opts?.tab ?? 'article');
      if (opts?.entryId) {
        setLifeAtlasEntryId(opts.entryId);
        setLifeAtlasEraTopicId(null);
        setLifeAtlasCategory('all');
      } else if (opts?.eraTopicId) {
        setLifeAtlasEraTopicId(opts.eraTopicId);
        setLifeAtlasEntryId(null);
        setLifeAtlasCategory('all');
      } else if (opts?.category) {
        setLifeAtlasCategory(opts.category);
        setLifeAtlasEntryId(null);
        setLifeAtlasEraTopicId(null);
      } else {
        setLifeAtlasCategory('all');
        setLifeAtlasEraTopicId('history-of-earth');
        setLifeAtlasEntryId(null);
      }
      setLifeAtlasOpen(true);
    },
    []
  );

  const handleSelectEraFromAtlas = useCallback((eraId: HistoryEraId, closeAtlas = false) => {
    setMode('history');
    setSelectedHistory(eraId);
    if (closeAtlas) {
      setLifeAtlasOpen(false);
    }
  }, []);

  const handleResetView = useCallback(() => {
    if (mode === 'interior') {
      setCutawayDegrees(95);
      setExplodeFactor(0);
      sceneRef.current?.focusCameraPreset('cutaway');
    } else if (mode === 'atmosphere') {
      sceneRef.current?.focusCameraPreset('atmosphere');
    } else if (mode === 'systems') {
      sceneRef.current?.focusCameraPreset('systems');
    } else {
      sceneRef.current?.focusCameraPreset('reset');
    }
  }, [mode]);

  const handleSelectInterior = useCallback((id: InteriorLayerId) => {
    setMode('interior');
    setSelectedInterior(id);
    if (id !== 'crust') {
      setCutawayDegrees((deg) => (deg < 45 ? 95 : deg));
    }
  }, []);

  const handleSelectAtmosphere = useCallback((id: AtmosphereLayerId) => {
    setMode('atmosphere');
    setSelectedAtmosphere(id);
  }, []);

  const handleSelectLandmark = useCallback((id: string) => {
    setMode('systems');
    setCutawayDegrees(0);
    setExplodeFactor(0);
    setAutoRotate(false);
    setSelectedLandmarkId(id);
    setSelectedSpaceObject(null);
    setDossierOpen(true);
    const lm = EARTH_LANDMARKS.find((item) => item.id === id);
    if (lm) {
      sceneRef.current?.focusCameraPreset('landmark', { lat: lm.lat, lon: lm.lon }, 3.4);
    }
  }, []);

  const handleInspectLocation = useCallback((coords: { lat: number; lon: number }) => {
    setMode('systems');
    setAutoRotate(false);
    setSelectedSpaceObject(null);
    setInspectedCoords(coords);
    setInspectedLocation(getInstantLocationFallback(coords.lat, coords.lon));
    if (window.innerWidth >= 768) {
      setDossierOpen(true);
    }

    clickGeocodeAbortRef.current?.abort();
    const ac = new AbortController();
    clickGeocodeAbortRef.current = ac;

    reverseGeocodeLocation(coords.lat, coords.lon, { zoom: 10, signal: ac.signal })
      .then((resolved) => {
        if (!ac.signal.aborted) {
          setInspectedLocation(resolved);
        }
      })
      .catch(() => {});
  }, []);

  const handleSearchLocation = useCallback(async (query: string): Promise<boolean> => {
    try {
      const hit = await searchLocationByName(query);
      if (!hit) return false;
      setMode('systems');
      setCutawayDegrees(0);
      setExplodeFactor(0);
      setAutoRotate(false);
      setSelectedSpaceObject(null);
      setInspectedCoords({ lat: hit.lat, lon: hit.lon });
      setInspectedLocation(hit);
      const label =
        hit.country && hit.title !== hit.country ? `${hit.title}, ${hit.country}` : hit.title;
      setCameraTelemetry({ altitudeKm: 2071, leafletZoom: 5, focusedLabel: label });
      sceneRef.current?.focusCameraPreset('location', { lat: hit.lat, lon: hit.lon }, 2.65);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleZoomToInspected = useCallback(() => {
    if (!inspectedCoords) return;
    setAutoRotate(false);
    sceneRef.current?.focusCameraPreset('location', inspectedCoords, 2.42);
  }, [inspectedCoords]);

  const handleClearInspected = useCallback(() => {
    clickGeocodeAbortRef.current?.abort();
    setInspectedCoords(null);
    setInspectedLocation(null);
  }, []);

  const handleSelectSpaceObject = useCallback(
    (obj: { kind: 'satellite' | 'asteroid'; id: string } | null) => {
      setSelectedSpaceObject(obj);
      if (obj) {
        setMode('systems');
        if (window.innerWidth >= 768) {
          setDossierOpen(true);
        }
      }
    },
    []
  );

  const handleCameraZoomUpdate = useCallback(
    (info: {
      centerCoords: { lat: number; lon: number };
      altitudeKm: number;
      leafletZoom: number;
    }) => {
      const immediateOcean = classifyOceanOrRegion(info.centerCoords.lat, info.centerCoords.lon);
      setCameraTelemetry((prev) => ({
        altitudeKm: info.altitudeKm,
        leafletZoom: info.leafletZoom,
        focusedLabel:
          info.leafletZoom >= 4 ? (prev?.focusedLabel ?? immediateOcean.title) : null,
      }));

      clearTimeout(zoomTimerRef.current);
      if (info.leafletZoom >= 4) {
        zoomTimerRef.current = window.setTimeout(() => {
          zoomGeocodeAbortRef.current?.abort();
          const ac = new AbortController();
          zoomGeocodeAbortRef.current = ac;
          reverseGeocodeLocation(info.centerCoords.lat, info.centerCoords.lon, {
            zoom: info.leafletZoom >= 5 ? 8 : 5,
            signal: ac.signal,
          })
            .then((loc) => {
              if (!ac.signal.aborted) {
                const label =
                  loc.country && loc.title !== loc.country
                    ? `${loc.title}, ${loc.country}`
                    : loc.title;
                setCameraTelemetry((prev) =>
                  prev ? { ...prev, focusedLabel: label } : prev
                );
              }
            })
            .catch(() => {});
        }, 420);
      }
    },
    []
  );

  const sceneState: SceneControlState = useMemo(
    () => ({
      mode,
      cutawayDegrees,
      explodeFactor,
      selectedInterior,
      selectedAtmosphere,
      selectedHistory,
      selectedLandmarkId,
      inspectedCoords,
      leafletBaseLayer,
      showLeafletLabels,
      showClouds,
      showTectonics,
      showMagnetosphere,
      showLandmarks,
      showSatellites,
      showAsteroids,
      autoRotate,
      dossierOpen,
      paused: extinctModalOpen || lifeAtlasOpen,
    }),
    [
      mode,
      cutawayDegrees,
      explodeFactor,
      selectedInterior,
      selectedAtmosphere,
      selectedHistory,
      selectedLandmarkId,
      inspectedCoords,
      leafletBaseLayer,
      showLeafletLabels,
      showClouds,
      showTectonics,
      showMagnetosphere,
      showLandmarks,
      showSatellites,
      showAsteroids,
      autoRotate,
      dossierOpen,
      extinctModalOpen,
      lifeAtlasOpen,
    ]
  );

  return (
    <main
      className="relative w-screen h-screen overflow-hidden bg-[#000000]"
      data-mode={mode}
      data-interior={selectedInterior}
      data-atmosphere={selectedAtmosphere}
      data-history={selectedHistory}
      data-map-layer={leafletBaseLayer}
    >
      <TopBar
        mode={mode}
        onModeChange={handleModeChange}
        onResetView={handleResetView}
        zenMode={zenMode}
      />

      <EarthViewport
        sceneState={sceneState}
        sceneRef={sceneRef}
        onSelectInterior={handleSelectInterior}
        onSelectAtmosphere={handleSelectAtmosphere}
        onSelectLandmark={handleSelectLandmark}
        onInspectLocation={handleInspectLocation}
        onSelectSpaceObject={(obj) => handleSelectSpaceObject(obj)}
        onCameraZoomUpdate={handleCameraZoomUpdate}
        cameraTelemetry={cameraTelemetry}
        inspectedLocation={inspectedLocation}
        onZoomToInspected={handleZoomToInspected}
        onClearInspected={handleClearInspected}
        dossierOpen={dossierOpen}
        zenMode={zenMode}
      />

      <DossierPanel
        mode={mode}
        selectedInterior={selectedInterior}
        selectedAtmosphere={selectedAtmosphere}
        selectedHistory={selectedHistory}
        selectedLandmarkId={selectedLandmarkId}
        onSelectLandmark={handleSelectLandmark}
        inspectedLocation={inspectedLocation}
        onSearchLocation={handleSearchLocation}
        onZoomToInspected={handleZoomToInspected}
        onClearInspected={handleClearInspected}
        selectedSpaceObject={selectedSpaceObject}
        onSelectSpaceObject={handleSelectSpaceObject}
        onOpenLifeAtlas={handleOpenLifeAtlas}
        open={dossierOpen}
        onToggleOpen={() => setDossierOpen((o) => !o)}
        zenMode={zenMode}
      />

      <ControlDock
        dossierOpen={dossierOpen}
        mode={mode}
        onModeChange={handleModeChange}
        cutawayDegrees={cutawayDegrees}
        onCutawayChange={setCutawayDegrees}
        explodeFactor={explodeFactor}
        onExplodeChange={setExplodeFactor}
        selectedInterior={selectedInterior}
        onSelectInterior={handleSelectInterior}
        selectedAtmosphere={selectedAtmosphere}
        onSelectAtmosphere={handleSelectAtmosphere}
        selectedHistory={selectedHistory}
        onSelectHistory={setSelectedHistory}
        showLeafletLabels={showLeafletLabels}
        onToggleLeafletLabels={() => setShowLeafletLabels((v) => !v)}
        showClouds={showClouds}
        onToggleClouds={() => setShowClouds((v) => !v)}
        showTectonics={showTectonics}
        onToggleTectonics={() => setShowTectonics((v) => !v)}
        showMagnetosphere={showMagnetosphere}
        onToggleMagnetosphere={() => setShowMagnetosphere((v) => !v)}
        showLandmarks={showLandmarks}
        onToggleLandmarks={() => setShowLandmarks((v) => !v)}
        showSatellites={showSatellites}
        onToggleSatellites={() => setShowSatellites((v) => !v)}
        showAsteroids={showAsteroids}
        onToggleAsteroids={() => setShowAsteroids((v) => !v)}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => setAutoRotate((v) => !v)}
        dockCollapsed={dockCollapsed}
        onToggleDockCollapsed={() => setDockCollapsed((v) => !v)}
        zenMode={zenMode}
        onToggleZenMode={() => setZenMode((v) => !v)}
        onOpenLifeAtlas={() => handleOpenLifeAtlas()}
        onOpenExtinctAtlas={() => {
          setExtinctModalOpen(true);
        }}
      />

      <ExtinctAtlasModal
        open={extinctModalOpen}
        onClose={() => setExtinctModalOpen(false)}
        onOpenInTerapedia={(entryId) => {
          setExtinctModalOpen(false);
          handleOpenLifeAtlas({ entryId });
        }}
      />

      {lifeAtlasOpen && (
        <LifeHistoryAtlas
          open
          onClose={() => setLifeAtlasOpen(false)}
          selectedEra={selectedHistory}
          onSelectEraOnGlobe={handleSelectEraFromAtlas}
          initialEntryId={lifeAtlasEntryId}
          initialEraTopicId={lifeAtlasEraTopicId}
          initialCategory={lifeAtlasCategory}
          initialStatus={lifeAtlasStatus}
          initialTab={lifeAtlasTab}
        />
      )}
    </main>
  );
}
