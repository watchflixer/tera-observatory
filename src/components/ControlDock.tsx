import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import {
  ATMOSPHERE_LAYERS,
  HISTORY_ERAS,
  INTERIOR_LAYERS,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
  type ObservatoryMode,
} from '../data/earthData';

interface ControlDockProps {
  mode: ObservatoryMode;
  onModeChange: (mode: ObservatoryMode) => void;
  cutawayDegrees: number;
  onCutawayChange: (deg: number) => void;
  explodeFactor: number;
  onExplodeChange: (val: number) => void;
  selectedInterior: InteriorLayerId;
  onSelectInterior: (id: InteriorLayerId) => void;
  selectedAtmosphere: AtmosphereLayerId;
  onSelectAtmosphere: (id: AtmosphereLayerId) => void;
  selectedHistory: HistoryEraId;
  onSelectHistory: (id: HistoryEraId) => void;
  showLeafletLabels: boolean;
  onToggleLeafletLabels: () => void;
  showClouds: boolean;
  onToggleClouds: () => void;
  showTectonics: boolean;
  onToggleTectonics: () => void;
  showMagnetosphere: boolean;
  onToggleMagnetosphere: () => void;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  showSatellites: boolean;
  onToggleSatellites: () => void;
  showAsteroids: boolean;
  onToggleAsteroids: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  dockCollapsed: boolean;
  onToggleDockCollapsed: () => void;
  zenMode: boolean;
  onToggleZenMode: () => void;
  dossierOpen?: boolean;
  onOpenLifeAtlas?: () => void;
  onOpenExtinctAtlas?: () => void;
}

const MODE_LABELS: Array<{ id: ObservatoryMode; label: string }> = [
  { id: 'systems', label: '3D Globe' },
  { id: 'interior', label: 'Interior' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'history', label: 'History' },
];

export function ControlDock(props: ControlDockProps) {
  const {
    mode,
    onModeChange,
    cutawayDegrees,
    onCutawayChange,
    explodeFactor,
    onExplodeChange,
    selectedInterior,
    onSelectInterior,
    selectedAtmosphere,
    onSelectAtmosphere,
    selectedHistory,
    onSelectHistory,
    showLeafletLabels,
    onToggleLeafletLabels,
    showClouds,
    onToggleClouds,
    showTectonics,
    onToggleTectonics,
    showMagnetosphere,
    onToggleMagnetosphere,
    showLandmarks,
    onToggleLandmarks,
    showSatellites,
    onToggleSatellites,
    showAsteroids,
    onToggleAsteroids,
    autoRotate,
    onToggleAutoRotate,
    dockCollapsed,
    onToggleDockCollapsed,
    zenMode,
    onToggleZenMode,
    dossierOpen = false,
    onOpenLifeAtlas,
    onOpenExtinctAtlas,
  } = props;

  if (zenMode) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30">
        <button
          type="button"
          onClick={onToggleZenMode}
          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#141414]/95 border border-neutral-800 rounded-lg hover:border-[#e0a43b]/70 transition-colors whitespace-nowrap"
        >
          <Eye className="w-3.5 h-3.5 text-[#e0a43b]" />
          Show Controls
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-3 md:bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(920px,95vw)] flex-col items-center pointer-events-none ${
        dossierOpen ? 'hidden md:flex' : 'flex'
      }`}
    >
      {/* Collapse / Zen toggle strip */}
      <div className="flex items-center gap-2 mb-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={onToggleDockCollapsed}
          aria-expanded={!dockCollapsed}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-neutral-300 bg-[#141414]/95 border border-neutral-800 rounded-md hover:text-white hover:border-neutral-600 transition-colors whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#e0a43b]" />
              Show Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#e0a43b]" />
              Hide Controls
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleZenMode}
          title="Toggle Full-Screen 3D View (H)"
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-neutral-300 bg-[#141414]/95 border border-neutral-800 rounded-md hover:text-white hover:border-neutral-600 transition-colors whitespace-nowrap"
        >
          <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
          Full View
        </button>
      </div>

      {!dockCollapsed && (
        <div className="w-full bg-[#141414]/95 border border-neutral-800 rounded-xl p-3 md:px-4 md:py-3 pointer-events-auto shadow-2xl">
          {/* Mobile mode switcher */}
          <div className="flex md:hidden items-center gap-1 mb-2.5 pb-2 border-b border-neutral-800 overflow-x-auto">
            {MODE_LABELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  mode === m.id
                    ? 'bg-white text-black font-semibold'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === 'interior' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Layer Selector Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {INTERIOR_LAYERS.map((layer) => {
                    const active = selectedInterior === layer.id;
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => onSelectInterior(layer.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#222222] text-white border-[#e0a43b]'
                            : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: layer.colorHex }}
                        />
                        {layer.name.replace(' & Asthenosphere', '').replace(' & Lithosphere', '')}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Layer Toggles */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <ToggleButton active={showMagnetosphere} onClick={onToggleMagnetosphere} label="Magnetosphere" />
                  <ToggleButton active={showTectonics} onClick={onToggleTectonics} label="Tectonics" />
                  <ToggleButton active={showClouds} onClick={onToggleClouds} label="Clouds" />
                </div>
              </div>

              {/* Cutaway & Explode Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
                <label className="flex items-center gap-3 text-xs text-neutral-300">
                  <span className="whitespace-nowrap shrink-0 w-24">Cutaway Slice</span>
                  <input
                    type="range"
                    min={0}
                    max={145}
                    step={1}
                    value={cutawayDegrees}
                    onChange={(e) => onCutawayChange(Number(e.target.value))}
                    className="terra-slider flex-1"
                    aria-label="Cutaway Slice Angle"
                  />
                  <span className="font-mono-tabular text-[#e0a43b] w-10 text-right">
                    {Math.round(cutawayDegrees)}°
                  </span>
                </label>

                <label className="flex items-center gap-3 text-xs text-neutral-300">
                  <span className="whitespace-nowrap shrink-0 w-24">Explode Shells</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(explodeFactor * 100)}
                    onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
                    className="terra-slider flex-1"
                    aria-label="Explode Concentric Shells"
                  />
                  <span className="font-mono-tabular text-[#e0a43b] w-10 text-right">
                    {Math.round(explodeFactor * 100)}%
                  </span>
                </label>
              </div>
            </div>
          )}

          {mode === 'atmosphere' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {ATMOSPHERE_LAYERS.map((layer) => {
                    const active = selectedAtmosphere === layer.id;
                    return (
                      <button
                        key={layer.id}
                        type="button"
                        onClick={() => onSelectAtmosphere(layer.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#222222] text-white border-[#e0a43b]'
                            : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="w-2 h-2 rounded-sm shrink-0"
                          style={{ backgroundColor: layer.colorHex }}
                        />
                        <span>{layer.name}</span>
                        <span className="font-mono-tabular text-[10px] text-neutral-400">
                          {layer.minKm}–{layer.maxKm > 999 ? '10k' : layer.maxKm}km
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <ToggleButton active={showMagnetosphere} onClick={onToggleMagnetosphere} label="Magnetosphere" />
                  <ToggleButton active={showClouds} onClick={onToggleClouds} label="Clouds" />
                  <ToggleButton active={autoRotate} onClick={onToggleAutoRotate} label="Spin" />
                </div>
              </div>
            </div>
          )}

          {mode === 'history' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                <span>Deep Time Planetary Evolution (4.54 Billion Years Ago → Present)</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono-tabular text-neutral-300">
                    {HISTORY_ERAS.find((e) => e.id === selectedHistory)?.timeRange}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenLifeAtlas && (
                      <button
                        type="button"
                        onClick={onOpenLifeAtlas}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#e0a43b] text-black rounded-md hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
                      >
                        Terapedia - Wikipedia
                      </button>
                    )}
                    {onOpenExtinctAtlas && (
                      <button
                        type="button"
                        onClick={onOpenExtinctAtlas}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#222222] text-white border border-[#e0a43b]/80 rounded-md hover:bg-[#2c2c2c] hover:border-[#e0a43b] transition-colors whitespace-nowrap shrink-0"
                      >
                        Extinct
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                {HISTORY_ERAS.map((era) => {
                  const active = selectedHistory === era.id;
                  return (
                    <button
                      key={era.id}
                      type="button"
                      onClick={() => onSelectHistory(era.id)}
                      className={`flex flex-col items-start px-2.5 py-1.5 text-left rounded-md border transition-colors ${
                        active
                          ? 'bg-[#222222] text-white border-[#e0a43b]'
                          : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <span className="text-xs font-medium truncate w-full">{era.name.replace(' & Present', '')}</span>
                      <span className="font-mono-tabular text-[10px] text-neutral-400 whitespace-nowrap">
                        {era.timeRange.split(' ')[0]} {era.timeRange.includes('Ga') ? 'Ga' : 'Ma'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'systems' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <ToggleButton
                  active={showLeafletLabels}
                  onClick={onToggleLeafletLabels}
                  label="Borders & Labels"
                />
                <ToggleButton active={showLandmarks} onClick={onToggleLandmarks} label="3D Landmarks" />
                <ToggleButton active={showSatellites} onClick={onToggleSatellites} label="Satellites" />
                <ToggleButton active={showAsteroids} onClick={onToggleAsteroids} label="Asteroids" />
                <ToggleButton active={showTectonics} onClick={onToggleTectonics} label="Tectonic Plates" />
                <ToggleButton active={showMagnetosphere} onClick={onToggleMagnetosphere} label="Magnetosphere" />
                <ToggleButton active={showClouds} onClick={onToggleClouds} label="Cloud Cover" />
                <ToggleButton active={autoRotate} onClick={onToggleAutoRotate} label="Earth Rotation" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
        active
          ? 'bg-[#242424] text-white border-[#e0a43b]/80'
          : 'bg-[#181818] text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-600'
      }`}
    >
      {label}
    </button>
  );
}
