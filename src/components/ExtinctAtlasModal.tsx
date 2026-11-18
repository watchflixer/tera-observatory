import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Menu,
  Image as ImageIcon,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXTINCT_CATEGORIES,
  EXTINCT_SPECIMENS,
  type ExtinctSidebarCategoryId,
  type ExtinctSpecimen,
} from '../data/extinctCatalog';
import carboniferousSwampUrl from '../assets/images/extinct-habitats/carboniferous-swamp.jpg';
import forestCanopySkyUrl from '../assets/images/extinct-habitats/forest-canopy-sky.jpg';
import iceAgeSteppeUrl from '../assets/images/extinct-habitats/ice-age-steppe.jpg';
import underwaterReefUrl from '../assets/images/extinct-habitats/underwater-reef.jpg';
import { prehistoricAudio } from '../utils/prehistoricAudio';

interface ExtinctAtlasModalProps {
  open: boolean;
  onClose: () => void;
  onOpenInTerapedia?: (entryId: string) => void;
}

export function ExtinctAtlasModal({
  open,
  onClose,
  onOpenInTerapedia,
}: ExtinctAtlasModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const preferredMutedRef = useRef(false);
  const playAttemptRef = useRef(0);

  const [expandedCategory, setExpandedCategory] = useState<ExtinctSidebarCategoryId | null>(
    'animals'
  );
  // Keep the selection keyed by ID so hot updates always resolve to the current catalog entry.
  // Accept a previous object value during Fast Refresh so the preview upgrades without losing selection.
  const [selectedSpecimenSelection, setSelectedSpecimenSelection] = useState<ExtinctSpecimen | string>(
    () => EXTINCT_SPECIMENS[0].id
  );
  const selectedSpecimenId =
    typeof selectedSpecimenSelection === 'string'
      ? selectedSpecimenSelection
      : selectedSpecimenSelection.id;
  const selectedSpecimen =
    EXTINCT_SPECIMENS.find((specimen) => specimen.id === selectedSpecimenId) ?? EXTINCT_SPECIMENS[0];

  const [muted, setMuted] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [videoError, setVideoError] = useState<boolean>(false);
  const isVideoShowcase = Boolean(selectedSpecimen.videoUrl);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Escape closes modal
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Each time the archive opens, start with sound enabled by default.
  useEffect(() => {
    if (!open) return;
    preferredMutedRef.current = false;
    setMuted(false);
    setAutoplayBlocked(false);
    setVideoError(false);
  }, [open]);

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !isVideoShowcase || !video) return;

    const attempt = ++playAttemptRef.current;
    video.muted = preferredMutedRef.current;
    setMuted(video.muted);
    setAutoplayBlocked(false);
    void video.play().catch((error: unknown) => {
      if (attempt !== playAttemptRef.current || videoRef.current !== video) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
        // Browsers can block sound until a user gesture; keep the video playing and explain how to unmute.
        video.muted = true;
        setMuted(true);
        setAutoplayBlocked(true);
        void video.play().catch(() => {
          if (attempt === playAttemptRef.current) setVideoError(true);
        });
      } else if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setVideoError(true);
      }
    });

    return () => {
      playAttemptRef.current++;
      video.pause();
    };
  }, [open, isVideoShowcase, selectedSpecimen.videoUrl]);

  const handleSelectCategory = useCallback((catId: ExtinctSidebarCategoryId) => {
    setExpandedCategory((prev) => (prev === catId ? null : catId));
  }, []);

  const handleSelectSpecimen = useCallback((specimen: ExtinctSpecimen) => {
    setSelectedSpecimenSelection(specimen.id);
    setVideoError(false);
    setExpandedCategory(specimen.category);
    setMobileSidebarOpen(false);
  }, []);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch(() => {});
  }, []);

  const handleCreatureSound = useCallback(() => {
    prehistoricAudio.setMuted(false);
    prehistoricAudio.playCreatureVoice(selectedSpecimen.soundProfile);
  }, [selectedSpecimen.soundProfile]);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    const attempt = ++playAttemptRef.current;
    preferredMutedRef.current = next;
    video.muted = next;
    setMuted(next);
    setAutoplayBlocked(false);
    if (!next) {
      void video.play().catch(() => {
        if (attempt !== playAttemptRef.current || videoRef.current !== video || video.muted) return;
        video.muted = true;
        setMuted(true);
        setAutoplayBlocked(true);
      });
    }
  }, []);

  if (!open) return null;

  const habitatImage = selectedSpecimen.category === 'marine'
    ? underwaterReefUrl
    : selectedSpecimen.category === 'plants'
      ? carboniferousSwampUrl
      : selectedSpecimen.category === 'humans'
        ? iceAgeSteppeUrl
        : forestCanopySkyUrl;
  const phaseLabel = isVideoShowcase
    ? `${selectedSpecimen.name} Field Video`
    : selectedSpecimen.imageUrl ? 'Field Illustration' : 'Habitat Illustration';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Extinct Species Cinematic Field Showcase"
      className="fixed inset-0 z-50 flex bg-[#000000] text-neutral-100 select-none"
    >
      {/* Left Sidebar: Categories -> Sublist of Extinct Species */}
      <aside
        aria-label="Extinct Categories Sidebar"
        className={`${
          mobileSidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden md:flex'
        } w-72 lg:w-80 shrink-0 flex-col bg-[#141414] border-r border-neutral-800 h-full`}
      >
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#e0a43b]">
              Deep Time Field Archive
            </div>
            <h2 className="text-sm font-semibold text-white">Extinct Species Archive</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Extinct Archive"
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Accordion List (Animals, Mammals, Flowers, Plants, Humans, Marine) */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 terra-scroll">
          {EXTINCT_CATEGORIES.map((cat) => {
            const isExpanded = expandedCategory === cat.id;
            const items = EXTINCT_SPECIMENS.filter((s) => s.category === cat.id);
            return (
              <div
                key={cat.id}
                className="rounded-lg border border-neutral-800 bg-[#1a1a1a] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  aria-expanded={isExpanded}
                  className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                    isExpanded
                      ? 'bg-[#222222] text-white border-b border-neutral-800'
                      : 'text-neutral-200 hover:bg-[#222222]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{cat.label}</div>
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {items.length} extinct entries
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#e0a43b] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                  )}
                </button>

                {/* Species names shown directly below clicked category */}
                {isExpanded && (
                  <div className="p-1.5 space-y-1 bg-[#121212]">
                    {items.map((item) => {
                      const active = selectedSpecimen.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectSpecimen(item)}
                          className={`w-full px-2.5 py-2 text-left rounded-md border transition-colors flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-[#262626] border-[#e0a43b] text-white'
                              : 'bg-[#181818] border-neutral-800/80 text-neutral-300 hover:text-white hover:border-neutral-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{item.name}</div>
                              <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                                {item.livedSpan}
                              </div>
                            </div>
                          </div>
                          {item.videoUrl ? <Play
                            className={`w-3.5 h-3.5 shrink-0 ${
                              active ? 'text-[#e0a43b]' : 'text-neutral-500'
                            }`}
                          /> : <ImageIcon className="w-3.5 h-3.5 shrink-0 text-neutral-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-3.5 py-2.5 border-t border-neutral-800 text-[11px] text-neutral-400 shrink-0">
          Choose a species to explore its video or illustration and learn about its habitat.
        </div>
      </aside>

      {/* Specimen video or still illustration */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden bg-[#0e140c]">
        {!isVideoShowcase && (
          <>
            <img
              src={selectedSpecimen.imageUrl ?? habitatImage}
              alt={selectedSpecimen.imageUrl
                ? `Illustration of ${selectedSpecimen.name}`
                : `Habitat illustration for ${selectedSpecimen.name}`}
              className="absolute inset-0 h-full w-full bg-black object-contain"
            />
            <div className="absolute top-28 left-1/2 z-20 -translate-x-1/2 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-center text-xs text-white">
              No video available for this species yet.
            </div>
          </>
        )}
        {isVideoShowcase && selectedSpecimen.videoUrl && (
          <video
            key={selectedSpecimen.videoUrl}
            ref={videoRef}
            src={selectedSpecimen.videoUrl}
            poster={selectedSpecimen.imageUrl}
            loop
            playsInline
            muted={muted}
            preload="auto"
            aria-label={`${selectedSpecimen.name} in ${selectedSpecimen.habitat}`}
            className="absolute inset-0 z-0 h-full w-full bg-black object-contain"
            onCanPlay={() => setVideoError(false)}
            onError={() => setVideoError(true)}
          />
        )}
        {isVideoShowcase && autoplayBlocked && !videoError && (
          <div
            role="status"
            className="pointer-events-none absolute bottom-48 left-1/2 z-20 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-center text-xs text-white"
          >
            Your browser blocked automatic sound. Tap the speaker icon to turn it on.
          </div>
        )}
        {isVideoShowcase && videoError && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-24 left-1/2 z-20 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-center text-xs text-white shadow-xl"
          >
            {selectedSpecimen.name} video did not start. Choose Replay Video to try again.
          </div>
        )}

        {/* Subtle 35mm lens vignette, static film grain & theatrical widescreen matte bars */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_46%,rgba(5,7,3,0.52)_100%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-7 sm:h-9 z-10 bg-black"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-7 sm:h-9 z-10 bg-black"
        />

        {/* Top Header Overlay (no backdrop-blur over WebGL) */}
        <div className="absolute top-9 sm:top-11 left-3 right-3 z-20 flex items-start justify-between gap-3 pointer-events-none">
          <div className="extinct-header-details pointer-events-auto flex min-w-0 max-w-xl items-start gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="Toggle Extinct Categories Sidebar"
              className="md:hidden p-2 rounded-lg bg-[#141414]/95 border border-neutral-800 text-white"
            >
              <Menu className="w-4 h-4" />
            </button>

            {!dockCollapsed && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#141414]/90 border border-neutral-800">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                  <span className="text-[#e0a43b] font-semibold uppercase tracking-wide">
                    {phaseLabel}
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="font-mono-tabular text-neutral-300">
                    {selectedSpecimen.livedSpan}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight mt-0.5">
                  {selectedSpecimen.name}
                </h1>
                <p className="text-xs text-neutral-400">
                  <span className="italic">{selectedSpecimen.scientificName}</span> —{' '}
                  {selectedSpecimen.habitat}
                </p>
              </div>
            )}
          </div>

          <div className="pointer-events-auto flex items-center gap-2 shrink-0">
            {isVideoShowcase && <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#141414]/95 border border-neutral-800 text-neutral-200 hover:text-white hover:border-neutral-600 transition-colors"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#e0a43b]" />
              )}
              <span className="hidden sm:inline">{muted ? 'Muted' : 'Audio On'}</span>
            </button>}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Back to Earth
            </button>
          </div>
        </div>

        {/* Collapsible Bottom Control Dock (Zero Center Occlusion) */}
        <div className="absolute bottom-9 sm:bottom-11 left-1/2 z-20 flex max-h-[calc(100%-5rem)] w-[calc(100%-1.5rem)] max-w-[780px] -translate-x-1/2 flex-col items-center pointer-events-none">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="pointer-events-auto mb-1.5 shrink-0 px-3 py-1 text-[11px] font-medium text-neutral-300 bg-[#141414]/95 border border-neutral-800 rounded-md hover:text-white transition-colors"
          >
            {dockCollapsed ? 'Show Controls' : 'Cinema View (Hide HUD)'}
          </button>

          {!dockCollapsed && (
            <div className="pointer-events-auto min-h-0 w-full overflow-y-auto rounded-xl bg-[#141414]/95 border border-neutral-800 p-3 shadow-2xl space-y-2.5 terra-scroll">
              <div className="flex flex-wrap items-center gap-2">
                {isVideoShowcase && <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReplay}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#e0a43b] text-black hover:bg-[#ebb758] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Replay Video
                  </button>

                </div>}

                {!isVideoShowcase && (
                  <button
                    type="button"
                    onClick={handleCreatureSound}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#222222] text-white border border-[#e0a43b]/80 hover:bg-[#2c2c2c] transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-[#e0a43b]" />
                    Roar / Sound
                  </button>
                )}

                {onOpenInTerapedia && selectedSpecimen.lifeCatalogId && (
                  <button
                    type="button"
                    onClick={() => onOpenInTerapedia(selectedSpecimen.lifeCatalogId!)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#1a1a1a] text-neutral-200 border border-neutral-700 hover:border-neutral-500 hover:text-white transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#e0a43b]" />
                    Open in Terapedia
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-start gap-2 border-t border-neutral-800 pt-2 text-xs">
                <p className="min-w-0 flex-[2_1_240px] break-words leading-relaxed text-neutral-300">{selectedSpecimen.summary}</p>
                <span className="min-w-0 flex-[1_1_180px] break-words text-[11px] text-[#e0a43b]">
                  Extinct: {selectedSpecimen.extinctionCause}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
