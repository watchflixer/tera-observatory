import { BookOpen, ChevronRight, Crosshair, MapPin, Orbit, Search, Sparkles, X, ZoomIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  ATMOSPHERE_COMPOSITION,
  ATMOSPHERE_LAYERS,
  EARTH_LANDMARKS,
  HISTORY_ERAS,
  HYDROSPHERE_BREAKDOWN,
  INTERIOR_LAYERS,
  NEAR_EARTH_ASTEROIDS,
  PLANETARY_METRICS,
  SPACE_SATELLITES,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
  type ObservatoryMode,
} from '../data/earthData';
import type { InspectedLocation } from '../utils/geocoding';
import {
  LIFE_CATEGORY_META,
  LIFE_HISTORY_CATALOG,
  type LifeCategory,
} from '../data/lifeHistoryData';
import type { EarthOverviewWikiTopic } from '../data/wikiTopicMap';
import {
  AtmosphereProfileChart,
  HistoryOxygenChart,
  InteriorDepthChart,
} from './ScientificCharts';

interface DossierPanelProps {
  mode: ObservatoryMode;
  selectedInterior: InteriorLayerId;
  selectedAtmosphere: AtmosphereLayerId;
  selectedHistory: HistoryEraId;
  selectedLandmarkId: string | null;
  onSelectLandmark: (id: string) => void;
  inspectedLocation: InspectedLocation | null;
  onSearchLocation: (query: string) => Promise<boolean>;
  onZoomToInspected: () => void;
  onClearInspected: () => void;
  selectedSpaceObject: { kind: 'satellite' | 'asteroid'; id: string } | null;
  onSelectSpaceObject: (obj: { kind: 'satellite' | 'asteroid'; id: string } | null) => void;
  onOpenLifeAtlas: (opts?: {
    entryId?: string;
    eraTopicId?: EarthOverviewWikiTopic['id'];
    category?: LifeCategory | 'all';
  }) => void;
  open: boolean;
  onToggleOpen: () => void;
  zenMode: boolean;
}

export function DossierPanel({
  mode,
  selectedInterior,
  selectedAtmosphere,
  selectedHistory,
  selectedLandmarkId,
  onSelectLandmark,
  inspectedLocation,
  onSearchLocation,
  onZoomToInspected,
  onClearInspected,
  selectedSpaceObject,
  onSelectSpaceObject,
  onOpenLifeAtlas,
  open,
  onToggleOpen,
  zenMode,
}: DossierPanelProps) {
  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  if (zenMode) return null;

  if (!open) {
    return (
      <div className="fixed top-16 right-3 md:right-4 z-20">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#141414]/95 border border-neutral-800 rounded-lg hover:border-[#e0a43b]/70 transition-colors whitespace-nowrap"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#e0a43b]" />
          Field Guide
        </button>
      </div>
    );
  }

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchText.trim() || searching) return;
    setSearching(true);
    setSearchError(null);
    const ok = await onSearchLocation(searchText.trim());
    setSearching(false);
    if (!ok) {
      setSearchError('Location not found — try a city, island, or country.');
    }
  };

  const interior = INTERIOR_LAYERS.find((l) => l.id === selectedInterior) ?? INTERIOR_LAYERS[0];
  const atmo = ATMOSPHERE_LAYERS.find((l) => l.id === selectedAtmosphere) ?? ATMOSPHERE_LAYERS[0];
  const era = HISTORY_ERAS.find((e) => e.id === selectedHistory) ?? HISTORY_ERAS[5];
  const activeLandmark =
    EARTH_LANDMARKS.find((l) => l.id === selectedLandmarkId) ?? EARTH_LANDMARKS[0];

  const activeSatellite =
    selectedSpaceObject?.kind === 'satellite'
      ? SPACE_SATELLITES.find((s) => s.id === selectedSpaceObject.id) ?? null
      : null;
  const activeAsteroid =
    selectedSpaceObject?.kind === 'asteroid'
      ? NEAR_EARTH_ASTEROIDS.find((a) => a.id === selectedSpaceObject.id) ?? null
      : null;

  return (
    <aside
      aria-label="Earth Scientific Field Guide"
      className="fixed top-16 right-3 md:right-4 z-30 w-[calc(100vw-24px)] sm:w-[376px] max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-170px)] flex flex-col bg-[#141414]/95 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Dossier Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-medium text-[#e0a43b]">
            {mode === 'interior'
              ? 'Planetary Interior'
              : mode === 'atmosphere'
                ? 'Atmospheric Envelope'
                : mode === 'history'
                  ? 'Geological Deep Time'
                  : 'Leaflet 3D Globe'}
          </span>
          <span aria-hidden="true">·</span>
          <span>Field Guide</span>
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="Collapse Field Guide"
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-white rounded transition-colors"
        >
          Hide
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="p-4 overflow-y-auto terra-scroll space-y-4">
        {mode === 'interior' && (
          <>
            <div>
              <h2 className="font-display text-lg font-bold text-white leading-tight">
                {interior.name}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">{interior.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MetricBox label="Depth" value={interior.depthKm} />
              <MetricBox label="Temperature" value={interior.temperature} />
              <MetricBox label="Pressure" value={interior.pressure} />
              <MetricBox label="Density" value={interior.density} />
            </div>

            <p className="text-[13px] leading-relaxed text-neutral-300">{interior.summary}</p>

            <InteriorDepthChart selectedId={interior.id} />

            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">Elemental & Mineral Makeup</h3>
              <div className="space-y-2">
                {interior.composition.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300">{item.label}</span>
                      <span className="font-mono-tabular text-neutral-400">{item.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 space-y-1.5">
              <div className="text-xs font-semibold text-neutral-200">Seismic & Physical Notes</div>
              <p className="text-xs text-[#e0a43b] leading-relaxed">{interior.seismicNote}</p>
              <ul className="space-y-1.5 pt-1">
                {interior.facts.map((fact) => (
                  <li key={fact} className="text-xs text-neutral-400 leading-relaxed">
                    — {fact}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {mode === 'atmosphere' && (
          <>
            <div>
              <h2 className="font-display text-lg font-bold text-white leading-tight">
                {atmo.name}
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">{atmo.subtitle}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MetricBox label="Altitude" value={atmo.altitudeKm} />
              <MetricBox label="Temperature" value={atmo.temperatureRange} />
            </div>

            <div className="text-xs text-neutral-400 bg-[#1a1a1a] border border-neutral-800 rounded-md px-3 py-2">
              {atmo.pressureFraction}
            </div>

            <p className="text-[13px] leading-relaxed text-neutral-300">{atmo.summary}</p>

            <AtmosphereProfileChart selectedId={atmo.id} />

            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">Key Altitude Benchmarks</h3>
              <div className="space-y-1.5">
                {atmo.keyBenchmarks.map((b) => (
                  <div
                    key={b.label}
                    className="flex items-center justify-between text-xs border border-neutral-800 rounded-md px-2.5 py-1.5 bg-[#1a1a1a]"
                  >
                    <span className="text-neutral-300">{b.label}</span>
                    <span className="font-mono-tabular text-[#e0a43b]">{b.altitude}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">
                Bulk Air Composition (Dry Air)
              </h3>
              <div className="space-y-1.5">
                {ATMOSPHERE_COMPOSITION.map((c) => (
                  <div key={c.label} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300">{c.label}</span>
                    <span className="font-mono-tabular text-neutral-400">{c.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

            <ul className="space-y-1.5 pt-2 border-t border-neutral-800">
              {atmo.phenomena.map((p) => (
                <li key={p} className="text-xs text-neutral-400 leading-relaxed">
                  — {p}
                </li>
              ))}
            </ul>
          </>
        )}

        {mode === 'history' && (
          <>
            <div>
              <div className="text-xs text-neutral-400 font-mono-tabular">{era.timeRange}</div>
              <h2 className="font-display text-lg font-bold text-white leading-tight mt-0.5">
                {era.name}
              </h2>
              <p className="text-xs text-[#e0a43b] mt-0.5">{era.headline}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="O₂ Level" value={`${era.oxygenPercent}%`} />
              <MetricBox label="Mean Temp" value={`${era.meanTempC} °C`} />
              <MetricBox label="Day Length" value={`${era.dayLengthHours} h`} />
            </div>

            <p className="text-[13px] leading-relaxed text-neutral-300">{era.summary}</p>
            {era.id === 'cenozoic' && (
              <p className="text-[11px] leading-relaxed text-neutral-500">The globe shows present-day Earth, not a reconstruction of the entire Cenozoic Era.</p>
            )}
            {era.id === 'paleozoic' && (
              <p className="text-[11px] leading-relaxed text-neutral-500">The globe illustrates Pangaea in the late Paleozoic; continents were arranged differently earlier in the era.</p>
            )}
            {era.id === 'mesozoic' && (
              <p className="text-[11px] leading-relaxed text-neutral-500">Globe depicts an illustrative snapshot, not a precise reconstruction of the entire era.</p>
            )}

            <HistoryOxygenChart selectedEra={era.id} />

            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-neutral-200">Geological Events</h3>
              <ul className="space-y-1.5">
                {era.geologyHighlights.map((item) => (
                  <li key={item} className="text-xs text-neutral-400 leading-relaxed">
                    — {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <h3 className="text-xs font-semibold text-neutral-200">Biosphere & Life</h3>
              <ul className="space-y-1.5">
                {era.biologyHighlights.map((item) => (
                  <li key={item} className="text-xs text-neutral-400 leading-relaxed">
                    — {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Wikipedia-Style Earth & Biosphere Encyclopedia Access */}
            <div className="pt-3 border-t border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-neutral-200">
                  TerraPedia · Wikipedia + Photos
                </h3>
                <span className="font-mono-tabular text-[11px] text-[#e0a43b]">
                  {LIFE_HISTORY_CATALOG.length + 7} articles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenLifeAtlas({ eraTopicId: era.id })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-[#e0a43b] text-black rounded-md hover:bg-[#ebb758] transition-colors"
                >
                  Open Wikipedia: {era.name.replace(' & Present', '')} & All Life
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {LIFE_CATEGORY_META.filter((c) => c.id !== 'all').map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onOpenLifeAtlas({ category: cat.id })}
                    className="px-2.5 py-1.5 text-left text-[11px] text-neutral-200 bg-[#1a1a1a] border border-neutral-800 rounded-md hover:border-[#e0a43b]/70 transition-colors truncate"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {(() => {
                const matching = LIFE_HISTORY_CATALOG.filter((e) => e.eraId === era.id);
                const picked: typeof matching = [];
                const seenCats = new Set<string>();
                for (const item of [...matching].reverse()) {
                  if (!seenCats.has(item.category)) {
                    picked.push(item);
                    seenCats.add(item.category);
                  }
                  if (picked.length >= 6) break;
                }
                for (const item of matching) {
                  if (picked.length >= 6) break;
                  if (!picked.some((p) => p.id === item.id)) picked.push(item);
                }
                if (picked.length === 0) return null;
                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] text-neutral-400">
                      Featured in {era.name.replace(' & Present', '')} (Photos + Wiki)
                    </div>
                    {picked.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => onOpenLifeAtlas({ entryId: sp.id })}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs bg-[#1a1a1a] border border-neutral-800 rounded-md hover:border-[#e0a43b]/70 transition-colors"
                      >
                        <span className="text-neutral-200 truncate">{sp.name}</span>
                        <span
                          className={`font-mono-tabular text-[10px] shrink-0 ${
                            sp.status === 'extant' ? 'text-white' : 'text-neutral-400'
                          }`}
                        >
                          {sp.status === 'extant' ? 'Living' : 'Extinct'}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {mode === 'systems' && (
          <>
            <div>
              <h2 className="font-display text-lg font-bold text-white leading-tight">
                Planet Earth (Sol III)
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Click any point on the 3D globe or search a place
              </p>
            </div>

            {/* Google-Earth Place Search */}
            <form onSubmit={handleSearchSubmit} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Jump to city or country (e.g. Manila)..."
                    aria-label="Search Earth location"
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 bg-[#1a1a1a] border border-neutral-800 rounded-md focus:outline-none focus:border-[#e0a43b]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !searchText.trim()}
                  className="px-3 py-1.5 text-xs font-semibold bg-white text-black rounded-md hover:bg-neutral-200 disabled:opacity-50 transition-colors shrink-0"
                >
                  {searching ? '...' : 'Fly'}
                </button>
              </div>
              {searchError && <p className="text-[11px] text-[#e0a43b]">{searchError}</p>}
            </form>

            {/* Clicked / Searched Google-Earth Location Card */}
            {inspectedLocation && (
              <div className="border border-[#e0a43b]/55 bg-[#191919] rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e0a43b]">
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{inspectedLocation.title}</span>
                    </div>
                    <div className="text-[11px] text-neutral-300 mt-0.5 truncate">
                      {inspectedLocation.loading ? 'Resolving place name…' : inspectedLocation.subtitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClearInspected}
                    title="Clear location pin"
                    className="p-1 text-neutral-400 hover:text-white rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono-tabular pt-1 border-t border-neutral-800">
                  <span className="text-neutral-400">
                    {Math.abs(inspectedLocation.lat).toFixed(3)}°
                    {inspectedLocation.lat >= 0 ? 'N' : 'S'},{' '}
                    {Math.abs(inspectedLocation.lon).toFixed(3)}°
                    {inspectedLocation.lon >= 0 ? 'E' : 'W'}
                  </span>
                  <button
                    type="button"
                    onClick={onZoomToInspected}
                    className="inline-flex items-center gap-1 text-[#e0a43b] hover:text-white font-sans font-medium"
                  >
                    <ZoomIn className="w-3 h-3" />
                    Zoom Closer
                  </button>
                </div>
              </div>
            )}

            {/* Selected Satellite or Asteroid Inspection Card */}
            {activeSatellite && (
              <div className="border border-neutral-600 bg-[#191919] rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <Orbit className="w-3.5 h-3.5 text-[#e0a43b] shrink-0" />
                    <span>{activeSatellite.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSpaceObject(null)}
                    className="p-0.5 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-[#e0a43b]">{activeSatellite.agency}</div>
                <p className="text-xs text-neutral-300 leading-relaxed">{activeSatellite.summary}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono-tabular pt-1 border-t border-neutral-800">
                  <span className="text-neutral-300">Alt: {activeSatellite.altitudeKm}</span>
                  <span className="text-[#e0a43b] text-right">{activeSatellite.velocityKmS}</span>
                </div>
              </div>
            )}

            {activeAsteroid && (
              <div className="border border-[#e0a43b]/55 bg-[#191919] rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#e0a43b]">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeAsteroid.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectSpaceObject(null)}
                    className="p-0.5 text-neutral-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-[#e0a43b]/90">{activeAsteroid.spectralClass}</div>
                <p className="text-xs text-neutral-300 leading-relaxed">{activeAsteroid.summary}</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono-tabular pt-1 border-t border-neutral-800">
                  <span className="text-neutral-300">Size: {activeAsteroid.diameter}</span>
                  <span className="text-[#e0a43b] text-right">{activeAsteroid.velocityKmS}</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Closest: {activeAsteroid.closestApproachKm}
                </div>
              </div>
            )}

            {/* Active Landmark Spotlight */}
            <div className="border border-neutral-800 bg-[#1a1a1a] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <MapPin className="w-3.5 h-3.5 text-[#e0a43b] shrink-0" />
                  <span>{activeLandmark.name}</span>
                </div>
                <span className="font-mono-tabular text-[11px] text-neutral-400">
                  {activeLandmark.category}
                </span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">{activeLandmark.summary}</p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-800 font-mono-tabular">
                <span className="text-neutral-400">{activeLandmark.elevationOrDepth}</span>
                <span className="text-[#e0a43b]">
                  {activeLandmark.metricLabel}: {activeLandmark.metricValue}
                </span>
              </div>
            </div>

            {/* Orbiting Satellites & Asteroids Quick Selector */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">
                Satellites & Near-Earth Asteroids
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {SPACE_SATELLITES.map((s) => {
                  const selected =
                    selectedSpaceObject?.kind === 'satellite' && selectedSpaceObject.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectSpaceObject({ kind: 'satellite', id: s.id })}
                      className={`px-2 py-1.5 text-left text-[11px] rounded-md border truncate transition-colors ${
                        selected
                          ? 'bg-[#242424] text-white border-[#e0a43b]'
                          : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      {s.name.replace(' (ISS)', '').replace(' (HST)', '')}
                    </button>
                  );
                })}
                {NEAR_EARTH_ASTEROIDS.map((a) => {
                  const selected =
                    selectedSpaceObject?.kind === 'asteroid' && selectedSpaceObject.id === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectSpaceObject({ kind: 'asteroid', id: a.id })}
                      className={`px-2 py-1.5 text-left text-[11px] rounded-md border truncate transition-colors ${
                        selected
                          ? 'bg-[#242424] text-white border-[#e0a43b]'
                          : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clickable Landmark List */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">
                Explore Planetary Wonders
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {EARTH_LANDMARKS.map((lm) => {
                  const selected = activeLandmark.id === lm.id;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => onSelectLandmark(lm.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 text-left text-xs rounded-md border transition-colors ${
                        selected
                          ? 'bg-[#242424] text-white border-[#e0a43b]'
                          : 'bg-[#1a1a1a] text-neutral-300 border-neutral-800 hover:border-neutral-600'
                      }`}
                    >
                      <span className="truncate pr-2">{lm.name}</span>
                      <span className="font-mono-tabular text-[10px] text-neutral-400 shrink-0">
                        {lm.lat.toFixed(1)}°, {lm.lon.toFixed(1)}°
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hydrosphere Breakdown */}
            <div>
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">
                Hydrosphere & Global Water Budget
              </h3>
              <div className="space-y-1.5">
                {HYDROSPHERE_BREAKDOWN.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-300">{item.label}</span>
                      <span className="font-mono-tabular text-neutral-400">{item.percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(2, item.percentage)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Planetary Telemetry Grid */}
            <div className="pt-2 border-t border-neutral-800">
              <h3 className="text-xs font-semibold text-neutral-200 mb-2">
                Orbital & Physical Reference
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {PLANETARY_METRICS.map((m) => (
                  <div key={m.label} className="border border-neutral-800 bg-[#1a1a1a] rounded-md p-2">
                    <div className="text-[10px] text-neutral-400">{m.label}</div>
                    <div className="font-mono-tabular text-xs font-semibold text-white mt-0.5">
                      {m.value}{' '}
                      <span className="text-[10px] font-normal text-neutral-400">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 bg-[#1a1a1a] rounded-md px-2.5 py-2">
      <div className="text-[10px] text-neutral-400">{label}</div>
      <div className="font-mono-tabular text-xs font-semibold text-white mt-0.5">{value}</div>
    </div>
  );
}
