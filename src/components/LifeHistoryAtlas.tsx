import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe2,
  Image as ImageIcon,
  ImageOff,
  Languages,
  Layers,
  Menu,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HISTORY_ERAS, type HistoryEraId } from '../data/earthData';
import {
  BIOSPHERE_CENSUS_STATS,
  LIFE_CATEGORY_META,
  LIFE_HISTORY_CATALOG,
  MASS_EXTINCTIONS,
  type LifeCategory,
  type LifeHistoryEntry,
  type LifeStatus,
} from '../data/lifeHistoryData';
import {
  EARTH_ERA_WIKI_TOPICS,
  getWikiDescriptorForEntry,
  type EarthOverviewWikiTopic,
} from '../data/wikiTopicMap';
import { filterLifeCatalog, summarizeLifeCounts } from '../utils/lifeFilter';
import { FEATURED_WIKI_LANGUAGES, getWikiUiStrings } from '../utils/wikiI18n';
import {
  fetchWikipediaBundle,
  searchLiveWikipedia,
  type WikiArticleBundle,
  type WikiPhotoItem,
  type WikiSearchHit,
} from '../utils/wikipediaApi';
import { WikiLightbox } from './WikiLightbox';

export type ActiveWikiTarget =
  | { kind: 'life'; id: string }
  | { kind: 'era'; id: EarthOverviewWikiTopic['id'] }
  | { kind: 'custom'; wikiTitle: string; lang: string; commonsQuery: string; eraId?: HistoryEraId };

export type AtlasSectionTab = 'article' | 'gallery' | 'extinctions';

interface LifeHistoryAtlasProps {
  open: boolean;
  onClose: () => void;
  selectedEra: HistoryEraId;
  onSelectEraOnGlobe: (eraId: HistoryEraId, closeAtlas?: boolean) => void;
  initialEntryId?: string | null;
  initialEraTopicId?: EarthOverviewWikiTopic['id'] | null;
  initialCategory?: LifeCategory | 'all';
  initialStatus?: LifeStatus | 'all';
  initialTab?: AtlasSectionTab;
}

type DirectoryScope = 'eras' | LifeCategory | 'all';

const MASS_EXTINCTION_WIKI_TITLES: Record<string, { wikiTitle: string; commonsQuery: string }> = {
  ordovician: {
    wikiTitle: 'Late Ordovician mass extinction',
    commonsQuery: 'Ordovician trilobite marine fossil',
  },
  devonian: {
    wikiTitle: 'Late Devonian extinction',
    commonsQuery: 'Devonian Dunkleosteus placoderm fossil',
  },
  permian: {
    wikiTitle: 'Permian–Triassic extinction event',
    commonsQuery: 'Permian Triassic Siberian Traps fossil',
  },
  triassic: {
    wikiTitle: 'Triassic–Jurassic extinction event',
    commonsQuery: 'Late Triassic dinosaur fossil Pangaea',
  },
  cretaceous: {
    wikiTitle: 'Cretaceous–Paleogene extinction event',
    commonsQuery: 'Chicxulub crater K-Pg boundary iridium',
  },
};

export function LifeHistoryAtlas({
  open,
  onClose,
  selectedEra,
  onSelectEraOnGlobe,
  initialEntryId = null,
  initialEraTopicId = null,
  initialCategory = 'all',
  initialStatus = 'all',
  initialTab = 'article',
}: LifeHistoryAtlasProps) {
  const articleScrollRef = useRef<HTMLDivElement | null>(null);

  const [wikiLang, setWikiLang] = useState<string>('en');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [langFilter, setLangFilter] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [liveHits, setLiveHits] = useState<WikiSearchHit[]>([]);
  const [searchingLive, setSearchingLive] = useState(false);

  const [directoryScope, setDirectoryScope] = useState<DirectoryScope>('all');
  const [statusFilter, setStatusFilter] = useState<LifeStatus | 'all'>(initialStatus);
  const [eraFilter, setEraFilter] = useState<HistoryEraId | 'all'>('all');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<AtlasSectionTab>(initialTab);
  const [target, setTarget] = useState<ActiveWikiTarget>(() =>
    initialEraTopicId
      ? { kind: 'era', id: initialEraTopicId }
      : initialEntryId
        ? { kind: 'life', id: initialEntryId }
        : { kind: 'era', id: 'history-of-earth' }
  );

  const [bundle, setBundle] = useState<WikiArticleBundle | null>(null);
  const [loadingWiki, setLoadingWiki] = useState(false);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(() => new Set());

  // Sync incoming open triggers from DossierPanel / ControlDock
  useEffect(() => {
    if (initialEntryId) {
      setTarget({ kind: 'life', id: initialEntryId });
      setActiveTab('article');
    }
  }, [initialEntryId]);

  useEffect(() => {
    if (initialEraTopicId) {
      setTarget({ kind: 'era', id: initialEraTopicId });
      setActiveTab('article');
    }
  }, [initialEraTopicId]);

  useEffect(() => {
    if (initialCategory !== 'all') {
      setDirectoryScope(initialCategory);
      const firstInCat = LIFE_HISTORY_CATALOG.find((e) => e.category === initialCategory);
      if (firstInCat && !initialEntryId) {
        setTarget({ kind: 'life', id: firstInCat.id });
        setActiveTab('article');
      }
    }
  }, [initialCategory, initialEntryId]);

  useEffect(() => {
    if (!open) return;
    setStatusFilter(initialStatus);
    setActiveTab(initialTab);
    if (initialStatus === 'extinct') {
      setDirectoryScope('all');
      setEraFilter('all');
    }
  }, [open, initialStatus, initialTab]);

  // Close with Escape when lightbox & language menu aren't intercepting
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (langMenuOpen) {
          setLangMenuOpen(false);
          return;
        }
        if (lightboxIndex !== null) return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, langMenuOpen, lightboxIndex]);

  const counts = useMemo(() => summarizeLifeCounts(LIFE_HISTORY_CATALOG), []);
  const ui = useMemo(() => getWikiUiStrings(wikiLang), [wikiLang]);

  const activeLifeEntry: LifeHistoryEntry | null = useMemo(() => {
    if (target.kind !== 'life') return null;
    return LIFE_HISTORY_CATALOG.find((e) => e.id === target.id) ?? LIFE_HISTORY_CATALOG[0];
  }, [target]);

  const activeEraTopic: EarthOverviewWikiTopic | null = useMemo(() => {
    if (target.kind !== 'era') return null;
    return EARTH_ERA_WIKI_TOPICS.find((t) => t.id === target.id) ?? EARTH_ERA_WIKI_TOPICS[0];
  }, [target]);

  // Fetch Wikipedia article + multi-language links + multi-photo Commons gallery whenever target or language changes
  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoadingWiki(true);
    setWikiError(null);
    setLightboxIndex(null);

    let enTitle = 'History of Earth';
    let commonsQuery = 'History of Earth planet geology';
    let overrideLangTitle: string | undefined;

    if (target.kind === 'life' && activeLifeEntry) {
      const desc = getWikiDescriptorForEntry(activeLifeEntry);
      enTitle = desc.wikiTitle;
      commonsQuery = desc.commonsQuery;
    } else if (target.kind === 'era' && activeEraTopic) {
      enTitle = activeEraTopic.wikiTitle;
      commonsQuery = activeEraTopic.commonsQuery;
    } else if (target.kind === 'custom') {
      enTitle = target.wikiTitle;
      commonsQuery = target.commonsQuery;
      if (target.lang !== 'en') {
        overrideLangTitle = target.wikiTitle;
      }
    }

    fetchWikipediaBundle({
      enTitle,
      commonsQuery,
      lang: wikiLang,
      overrideLangTitle,
      signal: ac.signal,
    })
      .then((res) => {
        if (!ac.signal.aborted) {
          setBundle(res);
          setLoadingWiki(false);
        }
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Unable to reach Wikipedia.';
        setWikiError(msg);
        setLoadingWiki(false);
      });

    return () => ac.abort();
  }, [open, target, wikiLang, activeLifeEntry, activeEraTopic]);

  // Scroll article back to top when switching article
  useEffect(() => {
    if (articleScrollRef.current) {
      articleScrollRef.current.scrollTop = 0;
    }
  }, [target]);

  // Debounced live Wikipedia search suggestions
  useEffect(() => {
    if (!open) return;
    const q = searchInput.trim();
    if (q.length < 2) {
      setLiveHits([]);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchingLive(true);
      searchLiveWikipedia(q, wikiLang, ac.signal)
        .then((hits) => {
          if (!ac.signal.aborted) {
            setLiveHits(hits);
            setSearchingLive(false);
          }
        })
        .catch(() => {
          if (!ac.signal.aborted) setSearchingLive(false);
        });
    }, 260);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [open, searchInput, wikiLang]);

  const filteredLifeEntries = useMemo(
    () =>
      filterLifeCatalog(LIFE_HISTORY_CATALOG, {
        query: searchInput,
        category: directoryScope === 'eras' || directoryScope === 'all' ? 'all' : directoryScope,
        status: statusFilter,
        eraId: eraFilter,
      }),
    [searchInput, directoryScope, statusFilter, eraFilter]
  );

  const filteredEraTopics = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return EARTH_ERA_WIKI_TOPICS.filter((t) => {
      if (eraFilter !== 'all' && t.id !== 'history-of-earth' && t.eraId !== eraFilter) return false;
      if (!q) return true;
      return `${t.title} ${t.headline} ${t.summary}`.toLowerCase().includes(q);
    });
  }, [searchInput, eraFilter]);

  const filteredAvailableLangs = useMemo(() => {
    const list = bundle?.availableLanguages ?? [];
    const q = langFilter.trim().toLowerCase();
    const featuredCodes = new Set(FEATURED_WIKI_LANGUAGES.map((l) => l.code));
    return list
      .filter((l) => !featuredCodes.has(l.lang))
      .filter((l) =>
        !q ? true : l.lang.toLowerCase().includes(q) || l.title.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [bundle?.availableLanguages, langFilter]);

  if (!open) return null;

  const activeLangMeta = FEATURED_WIKI_LANGUAGES.find((l) => l.code === wikiLang);
  const activeLangDisplay =
    activeLangMeta?.nativeName ?? wikiLang.toUpperCase();

  // Compute display titles & metadata
  const displayTitle =
    bundle?.pageTitle ??
    (activeLifeEntry?.name ||
      activeEraTopic?.title ||
      (target.kind === 'custom' ? target.wikiTitle : 'History of Earth'));

  const subtitleScientific =
    activeLifeEntry?.scientificName ??
    activeEraTopic?.scientificName ??
    'Wikipedia Free Encyclopedia';

  const articleEraId: HistoryEraId =
    activeLifeEntry?.eraId ??
    activeEraTopic?.eraId ??
    (target.kind === 'custom' && target.eraId ? target.eraId : 'cenozoic');

  const eraMeta = HISTORY_ERAS.find((e) => e.id === articleEraId) ?? HISTORY_ERAS[5];
  const photos: WikiPhotoItem[] = bundle?.photos ?? [];
  const leadImageUrl = bundle?.leadThumbUrl || photos[0]?.thumbUrl || null;
  const h2Sections = (bundle?.parsed.sections ?? []).filter((s) => s.level === 2);

  // Pure Monochrome Wikipedia Paper Palette (Black, White, Gray)
  const shellBg = 'bg-[#ffffff] text-[#111111] border-[#bdbdbd]';
  const headerBg = 'bg-[#ffffff] border-[#d4d4d4]';
  const railBg = 'bg-[#f7f7f7] border-[#e5e5e5]';
  const infoboxBg = 'bg-[#f7f7f7] border-[#bdbdbd] text-[#111111]';
  const infoboxHeaderBg = 'bg-[#ebebeb] text-[#111111]';
  const mutedText = 'text-[#595959]';
  const bodyText = 'text-[#1f1f1f]';
  const wikiLink = 'text-[#111111] underline decoration-[#8c8c8c] underline-offset-2 hover:text-black';
  const dividerBorder = 'border-[#bdbdbd]';
  const subtleBorder = 'border-[#e5e5e5]';
  const inputStyle =
    'bg-white text-[#111111] placeholder:text-[#737373] border-[#bdbdbd] focus:border-[#111111]';

  const markBrokenUrl = (url: string) => {
    setBrokenImageUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const scrollToHeading = (anchorId: string) => {
    setActiveTab('article');
    requestAnimationFrame(() => {
      const el = document.getElementById(anchorId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openCustomTopic = (hit: WikiSearchHit) => {
    setTarget({
      kind: 'custom',
      wikiTitle: hit.title,
      lang: hit.lang,
      commonsQuery: hit.title,
      eraId: selectedEra,
    });
    setActiveTab('article');
    setSearchFocused(false);
    setMobileNavOpen(false);
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Earth Biosphere and Life History Encyclopedia"
      className={`fixed inset-0 z-50 w-screen h-screen flex flex-col overflow-hidden ${shellBg}`}
    >
      {/* Wikipedia-Style Masthead */}
      <header className={`terapedia-header relative z-30 px-3 md:px-5 py-2.5 border-b shrink-0 flex flex-wrap items-center justify-between gap-2.5 ${headerBg}`}>
        {/* Brand + Mobile Nav button */}
        <div className="terapedia-brand flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle Encyclopedia Index"
            aria-expanded={mobileNavOpen}
            className="lg:hidden p-1.5 rounded border border-[#bdbdbd] text-[#111111] hover:bg-[#ebebeb]"
          >
            <Menu className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setTarget({ kind: 'era', id: 'history-of-earth' });
              setActiveTab('article');
            }}
            className="flex items-center gap-2.5 text-left min-w-0"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center border shrink-0 bg-[#f7f7f7] border-[#bdbdbd] text-[#111111]">
              <Globe2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-wiki-serif text-base md:text-lg font-bold tracking-tight leading-none truncate">
                TerraPedia
              </div>
              <div className={`text-[11px] truncate mt-0.5 ${mutedText}`}>
                {ui.encyclopediaSubtitle}
              </div>
            </div>
          </button>
        </div>

        {/* Wikipedia Live Search Bar */}
        <div className="terapedia-search relative flex-1 min-w-[210px] max-w-md order-3 sm:order-2 w-full sm:w-auto">
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${mutedText}`} />
          <input
            type="text"
            value={searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={ui.searchPlaceholder}
            aria-label="Search Earth History & Wikipedia"
            className={`w-full pl-8 pr-7 py-1.5 text-xs border rounded focus:outline-none ${inputStyle}`}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 ${mutedText} hover:opacity-80`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Live Search Dropdown (Local Catalog + Live Wikipedia Hits) */}
          {searchFocused && searchInput.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full mt-1 border rounded-md shadow-xl z-40 max-h-80 overflow-y-auto bg-white border-[#bdbdbd] text-[#111111]">
              {(filteredEraTopics.length > 0 || filteredLifeEntries.length > 0) && (
                <div className={`border-b ${subtleBorder}`}>
                  <div className={`px-3 py-1 text-[10px] font-semibold ${mutedText}`}>
                    TerraPedia Catalog
                  </div>
                  {filteredEraTopics.slice(0, 3).map((eraT) => (
                    <button
                      key={eraT.id}
                      type="button"
                      onMouseDown={() => {
                        setTarget({ kind: 'era', id: eraT.id });
                        setActiveTab('article');
                        setSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-[#ededed]"
                    >
                      <span className="font-medium truncate">{eraT.title}</span>
                      <span className={`font-mono-tabular text-[10px] shrink-0 ${mutedText}`}>
                        {eraT.timeRange}
                      </span>
                    </button>
                  ))}
                  {filteredLifeEntries.slice(0, 5).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onMouseDown={() => {
                        setTarget({ kind: 'life', id: entry.id });
                        setActiveTab('article');
                        setSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-[#ededed]"
                    >
                      <span className="truncate">
                        <span className="font-medium">{entry.name}</span>{' '}
                        <span className={`italic text-[11px] ${mutedText}`}>({entry.scientificName})</span>
                      </span>
                      <span
                        className={`text-[10px] font-mono-tabular shrink-0 ${
                          entry.status === 'extant' ? 'text-[#111111] font-semibold' : 'text-[#595959]'
                        }`}
                      >
                        {entry.status === 'extant' ? ui.livingLabel : ui.extinctLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <div className={`px-3 py-1 text-[10px] font-semibold flex items-center justify-between ${mutedText}`}>
                  <span>Wikipedia ({activeLangDisplay})</span>
                  {searchingLive && <span>Searching…</span>}
                </div>
                {liveHits.length === 0 && !searchingLive ? (
                  <div className={`px-3 py-2 text-xs ${mutedText}`}>
                    No extra live hits — select an entry above.
                  </div>
                ) : (
                  liveHits.map((hit) => (
                    <button
                      key={`${hit.lang}:${hit.title}`}
                      type="button"
                      onMouseDown={() => openCustomTopic(hit)}
                      className={`w-full text-left px-3 py-2 text-xs border-t ${subtleBorder} hover:bg-[#ededed]`}
                    >
                      <div className={`font-semibold ${wikiLink}`}>{hit.title}</div>
                      {hit.snippet && (
                        <div className={`text-[11px] line-clamp-1 mt-0.5 ${mutedText}`}>{hit.snippet}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Controls: Language Picker + Close */}
        <div className="terapedia-actions flex items-center gap-1.5 shrink-0 order-2 sm:order-3">
          {/* Language Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangMenuOpen((v) => !v)}
              aria-expanded={langMenuOpen}
              aria-controls="terapedia-language-menu"
              aria-label={`Select Wikipedia language (${activeLangDisplay})`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 transition-colors bg-[#f8f9fa] border-[#a2a9b1] text-[#3366cc] hover:bg-[#eaecf0]"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="terapedia-language-name truncate">{activeLangDisplay}</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>

            {langMenuOpen && (
              <div
                id="terapedia-language-menu"
                role="dialog"
                aria-label={ui.languagesLabel}
                className="terapedia-language-panel absolute right-0 top-full mt-1.5 flex max-h-[min(28rem,calc(100dvh-5rem))] w-72 flex-col overflow-hidden rounded-lg border border-[#bdbdbd] bg-white text-[#111111] shadow-2xl z-50 sm:w-80"
              >
                <div className={`px-3 py-2 border-b flex items-center justify-between ${subtleBorder}`}>
                  <span className="text-xs font-semibold">{ui.languagesLabel}</span>
                  <button
                    type="button"
                    onClick={() => setLangMenuOpen(false)}
                    className={`p-0.5 ${mutedText}`}
                    aria-label="Close language menu"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className={`p-2 border-b ${subtleBorder}`}>
                  <input
                    type="text"
                    value={langFilter}
                    onChange={(e) => setLangFilter(e.target.value)}
                    placeholder="Filter language code or title…"
                    aria-label="Filter Wikipedia languages"
                    className={`w-full px-2.5 py-1 text-xs border rounded focus:outline-none ${inputStyle}`}
                  />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2 terra-scroll">
                  <div className="grid grid-cols-2 gap-1">
                    {FEATURED_WIKI_LANGUAGES.filter((l) =>
                      !langFilter.trim()
                        ? true
                        : l.nativeName.toLowerCase().includes(langFilter.toLowerCase()) ||
                          l.englishName.toLowerCase().includes(langFilter.toLowerCase()) ||
                          l.code.toLowerCase().includes(langFilter.toLowerCase())
                    ).map((langOpt) => {
                      const active = wikiLang === langOpt.code;
                      return (
                        <button
                          key={langOpt.code}
                          type="button"
                          onClick={() => {
                            setWikiLang(langOpt.code);
                            setLangMenuOpen(false);
                          }}
                          className={`flex items-center justify-between gap-1 px-2 py-1.5 text-left text-xs rounded border transition-colors ${
                            active
                              ? 'bg-[#ededed] border-[#111111] text-[#111111] font-semibold'
                              : 'border-transparent text-[#222222] hover:bg-[#f7f7f7]'
                          }`}
                        >
                          <span className="truncate">{langOpt.nativeName}</span>
                          {active && <Check className="w-3 h-3 text-[#111111] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {filteredAvailableLangs.length > 0 && (
                    <div className={`pt-2 border-t ${subtleBorder}`}>
                      <div className={`px-1 pb-1 text-[10px] font-semibold ${mutedText}`}>
                        {ui.moreLanguagesLabel} ({bundle?.availableLanguages.length ?? 0})
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {filteredAvailableLangs.map((ll) => {
                          const active = wikiLang === ll.lang;
                          return (
                            <button
                              key={ll.lang}
                              type="button"
                              onClick={() => {
                                setWikiLang(ll.lang);
                                setLangMenuOpen(false);
                              }}
                              className={`flex items-center justify-between gap-1 px-2 py-1 text-left text-[11px] rounded ${
                                active ? 'bg-[#ededed] font-semibold text-[#111111]' : 'hover:bg-[#f7f7f7]'
                              }`}
                            >
                              <span className="truncate">{ll.title}</span>
                              <span className={`font-mono-tabular text-[10px] uppercase shrink-0 ${mutedText}`}>
                                {ll.lang}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Close / Back to 3D Earth */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Life History Atlas"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded whitespace-nowrap shrink-0 transition-colors bg-[#f7f7f7] border-[#bdbdbd] text-[#111111] hover:bg-[#ebebeb]"
          >
            <X className="w-3.5 h-3.5" />
            <span className="terapedia-close-label truncate">{ui.closeLabel}</span>
          </button>
        </div>
      </header>

      {/* Global Living Biosphere Quick Census Ribbon */}
      <div className="flex overflow-x-auto border-b px-3 md:px-5 py-1.5 text-[11px] shrink-0 gap-5 bg-[#f7f7f7] border-[#e5e5e5] text-[#595959]">
        {BIOSPHERE_CENSUS_STATS.map((stat) => (
          <div key={stat.label} className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <span>{stat.label}:</span>
            <span className="font-mono-tabular font-semibold text-[#111111]">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Main 3-Part Wikipedia Workspace */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        {/* Left Navigation Rail (Contents + Earth & Life Index) */}
        <aside
          className={`${
            mobileNavOpen ? 'flex' : 'hidden lg:flex'
          } flex-col w-full lg:w-[290px] xl:w-[310px] shrink-0 border-b lg:border-b-0 lg:border-r lg:h-full overflow-y-auto terra-scroll ${railBg}`}
        >
          {/* Contents TOC (Wikipedia Table of Contents) */}
          <div className={`p-3.5 border-b ${subtleBorder}`}>
            <div className="text-xs font-bold mb-2 flex items-center justify-between">
              <span>{ui.contents}</span>
              <span className={`font-mono-tabular text-[10px] ${mutedText}`}>
                {h2Sections.length + 2} sections
              </span>
            </div>
            <nav aria-label="Article table of contents" className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => scrollToHeading('wiki-sec-overview')}
                className={`block w-full text-left truncate ${wikiLink}`}
              >
                01. {ui.overviewHeading}
              </button>
              <button
                type="button"
                onClick={() => scrollToHeading('wiki-sec-gallery')}
                className={`block w-full text-left truncate ${wikiLink}`}
              >
                02. {ui.galleryHeading} ({photos.length})
              </button>
              {h2Sections.map((sec, idx) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToHeading(sec.id)}
                  className={`block w-full text-left truncate ${wikiLink}`}
                >
                  {String(idx + 3).padStart(2, '0')}. {sec.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Topic Directory Filters */}
          <div className={`p-3 border-b space-y-2 ${subtleBorder}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold">{ui.lifeCatalogHeading}</span>
              <select
                value={eraFilter}
                onChange={(e) => setEraFilter(e.target.value as HistoryEraId | 'all')}
                aria-label="Filter directory by era"
                className={`px-2 py-0.5 text-[11px] border rounded max-w-[140px] ${inputStyle}`}
              >
                <option value="all">All Eras</option>
                {HISTORY_ERAS.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name.replace(' & Present', '')}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector Chips/Buttons */}
            <div className="flex flex-wrap gap-1">
              <DirectoryTabButton
                active={directoryScope === 'eras'}
                label="Earth Eras"
                count={EARTH_ERA_WIKI_TOPICS.length}
                onClick={() => setDirectoryScope('eras')}
              />
              {LIFE_CATEGORY_META.map((cat) => (
                <DirectoryTabButton
                  key={cat.id}
                  active={directoryScope === cat.id}
                  label={cat.label.replace(' & Hominins', '').replace(' & Crops', '').replace(' & Fungi', '')}
                  count={cat.id === 'all' ? counts.total : counts.byCategory[cat.id]}
                  onClick={() => setDirectoryScope(cat.id)}
                />
              ))}
            </div>

            {directoryScope !== 'eras' && (
              <div className="flex items-center gap-1 pt-0.5">
                {(
                  [
                    { id: 'all', label: ui.allStatus },
                    { id: 'extant', label: ui.livingLabel },
                    { id: 'extinct', label: ui.extinctLabel },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-2 py-0.5 text-[11px] rounded border transition-colors whitespace-nowrap ${
                      statusFilter === s.id
                        ? 'bg-[#111111] text-white border-[#111111] font-medium'
                        : 'bg-white text-[#595959] border-[#d4d4d4] hover:text-[#111111]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clickable Encyclopedia Articles List */}
          <div className="divide-y divide-[#e5e5e5]">
            {(directoryScope === 'all' || directoryScope === 'eras') && (
              <div>
                <div className="px-3.5 py-1.5 text-[11px] font-semibold bg-[#ebebeb] text-[#404040]">
                  {ui.earthHistoryHeading} ({filteredEraTopics.length})
                </div>
                {filteredEraTopics.map((eraT) => {
                  const selected = target.kind === 'era' && target.id === eraT.id;
                  return (
                    <button
                      key={eraT.id}
                      type="button"
                      onClick={() => {
                        setTarget({ kind: 'era', id: eraT.id });
                        setActiveTab('article');
                        setMobileNavOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs transition-colors border-b ${subtleBorder} ${
                        selected
                          ? 'bg-[#ebebeb] font-semibold text-[#111111]'
                          : 'text-[#222222] hover:bg-[#f0f0f0]'
                      }`}
                    >
                      <div className="truncate">{eraT.title}</div>
                      <div className={`text-[10px] font-mono-tabular mt-0.5 ${mutedText}`}>
                        {eraT.timeRange}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {directoryScope !== 'eras' && (
              <div>
                <div className="px-3.5 py-1.5 text-[11px] font-semibold bg-[#ebebeb] text-[#404040]">
                  Species & Flora ({filteredLifeEntries.length})
                </div>
                {filteredLifeEntries.length === 0 ? (
                  <div className={`p-4 text-xs ${mutedText}`}>
                    No local species matched. Use the top Wikipedia search box or reset filters.
                  </div>
                ) : (
                  filteredLifeEntries.map((entry) => {
                    const selected = target.kind === 'life' && target.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setTarget({ kind: 'life', id: entry.id });
                          setActiveTab('article');
                          setMobileNavOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors border-b ${subtleBorder} ${
                          selected
                            ? 'bg-[#ebebeb] font-semibold text-[#111111]'
                            : 'text-[#222222] hover:bg-[#f0f0f0]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{entry.name}</span>
                          <span
                            className={`text-[10px] font-mono-tabular shrink-0 ${
                              entry.status === 'extant'
                                ? 'text-[#111111] font-semibold'
                                : 'text-[#595959]'
                            }`}
                          >
                            {entry.status === 'extant' ? '●' : '✖'}{' '}
                            {entry.status === 'extant' ? ui.livingLabel : ui.extinctLabel}
                          </span>
                        </div>
                        <div className={`text-[10px] italic truncate mt-0.5 ${mutedText}`}>
                          {entry.scientificName} · {entry.livedSpan}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Center + Right Wikipedia Article Reader */}
        <div
          ref={articleScrollRef}
          dir={activeLangMeta?.dir ?? 'ltr'}
          className="lg:flex-1 lg:overflow-y-auto terra-scroll"
        >
          {/* Wikipedia Sub-Navigation Tabs Bar */}
          <div className="px-4 md:px-8 pt-2.5 border-b flex flex-wrap items-center justify-between gap-2 sticky top-0 z-10 bg-white/95 border-[#bdbdbd]">
            <div className="flex items-center gap-1 -mb-px overflow-x-auto max-w-full">
              {(
                [
                  { id: 'article', label: ui.articleTab, icon: BookOpen },
                  { id: 'gallery', label: `${ui.galleryTab} (${photos.length})`, icon: ImageIcon },
                  { id: 'extinctions', label: `${ui.extinctionsTab} (5)`, icon: Layers },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-[#111111] text-[#111111] font-semibold'
                        : 'border-transparent text-[#595959] hover:text-[#111111]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pb-1.5">
              <button
                type="button"
                onClick={() => onSelectEraOnGlobe(articleEraId, true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 transition-colors bg-[#3366cc] text-white border-[#3366cc] hover:bg-[#2a4b8d]"
              >
                <Globe2 className="w-3.5 h-3.5" />
                {ui.viewGlobeBtn}
              </button>

              {bundle?.canonicalUrl && (
                <a
                  href={bundle.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded whitespace-nowrap shrink-0 border-[#bdbdbd] text-[#111111] hover:bg-[#f7f7f7]"
                >
                  <span className="hidden sm:inline">{ui.openWikipediaLink}</span>
                  <span className="sm:hidden">Wikipedia</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Article Body Container */}
          <div className="px-4 md:px-10 py-6 max-w-[1160px] mx-auto w-full">
            {/* Classic Wikipedia H1 Headline */}
            <div className={`pb-2.5 mb-3 border-b ${dividerBorder}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="font-wiki-serif text-2xl md:text-3xl font-normal tracking-tight leading-tight">
                  {displayTitle}
                </h1>
                <span className={`text-xs font-mono-tabular ${mutedText}`}>
                  {bundle ? `${bundle.resolvedLang}.wikipedia` : `${wikiLang}.wikipedia`}
                </span>
              </div>
              <div className={`text-xs mt-1 ${mutedText}`}>{ui.fromSource}</div>
            </div>

            {/* Translation / Language fallback notice if target wiki lacks full article */}
            {bundle?.fallbackToEnglish && wikiLang !== 'en' && (
              <div className="mb-4 px-3.5 py-2 text-xs border rounded bg-[#f7f7f7] border-[#bdbdbd] text-[#595959]">
                {ui.fallbackNotice}
              </div>
            )}

            {activeTab === 'extinctions' ? (
              <div className="space-y-4">
                <div>
                  <h2 className={`font-wiki-serif text-xl pb-1 border-b ${dividerBorder}`}>
                    {ui.massExtinctionsHeading}
                  </h2>
                  <p className={`text-sm mt-2 ${mutedText}`}>{ui.massExtinctionsSubtext}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MASS_EXTINCTIONS.map((ev) => {
                    const activeEra = ev.eraId === selectedEra;
                    const wikiMap = MASS_EXTINCTION_WIKI_TITLES[ev.id];
                    return (
                      <div
                        key={ev.id}
                        className={`p-4 border rounded-md space-y-2 ${
                          activeEra
                            ? 'bg-[#ebebeb] border-[#111111]'
                            : 'bg-[#f7f7f7] border-[#bdbdbd]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-wiki-serif text-base font-bold leading-snug text-[#111111]">
                            {ev.name}
                          </h3>
                          <span className="font-mono-tabular text-xs font-semibold shrink-0 text-[#111111]">
                            {ev.ageMa}
                          </span>
                        </div>
                        <div className="text-xs font-mono-tabular font-medium text-[#404040]">
                          Lost: {ev.speciesLost}
                        </div>
                        <p className={`text-xs leading-relaxed ${bodyText}`}>
                          <strong>Cause:</strong> {ev.primaryCause}. {ev.victimsAndSurvivors}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {wikiMap && (
                            <button
                              type="button"
                              onClick={() => {
                                setTarget({
                                  kind: 'custom',
                                  wikiTitle: wikiMap.wikiTitle,
                                  lang: 'en',
                                  commonsQuery: wikiMap.commonsQuery,
                                  eraId: ev.eraId,
                                });
                                setActiveTab('article');
                              }}
                              className={`text-xs font-medium ${wikiLink}`}
                            >
                              Read Wikipedia Article <ChevronRight className="w-3 h-3 inline" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectEraOnGlobe(ev.eraId, true)}
                            className="ml-auto px-2.5 py-1 text-[11px] font-medium border rounded bg-white border-[#bdbdbd] text-[#111111] hover:bg-[#ebebeb]"
                          >
                            {ui.viewGlobeBtn}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'gallery' ? (
              <div className="space-y-4">
                <div>
                  <h2 className={`font-wiki-serif text-xl pb-1 border-b ${dividerBorder}`}>
                    {ui.galleryHeading} — {displayTitle}
                  </h2>
                  <p className={`text-xs mt-1.5 ${mutedText}`}>{ui.gallerySubtext}</p>
                </div>

                {loadingWiki && photos.length === 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="h-48 rounded border animate-pulse bg-[#ebebeb] border-[#d4d4d4]"
                      />
                    ))}
                  </div>
                ) : photos.length === 0 ? (
                  <div className={`p-6 border rounded text-center text-xs ${infoboxBg}`}>
                    No additional Commons gallery photos matched this exact query. Try switching to
                    the Article tab or searching another term.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo, idx) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        index={idx}
                        broken={brokenImageUrls.has(photo.thumbUrl)}
                        onError={() => markBrokenUrl(photo.thumbUrl)}
                        onOpen={() => setLightboxIndex(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB === 'article' (Full Wikipedia Article Layout + Infobox + Explanation + Inline Gallery) */
              <div className="clearfix">
                {/* Iconic Wikipedia Right-Side Infobox */}
                <aside
                  aria-label="Wikipedia Infobox"
                  className={`w-full md:w-[300px] md:float-right md:ml-6 mb-5 border text-xs ${infoboxBg}`}
                >
                  <div className={`px-3 py-2 text-center border-b ${dividerBorder} ${infoboxHeaderBg}`}>
                    <div className="font-bold text-sm">{displayTitle}</div>
                    <div className="italic text-[11px] opacity-85 mt-0.5">{subtitleScientific}</div>
                  </div>

                  {/* Lead Photograph */}
                  <div className="p-2 border-b border-inherit">
                    {leadImageUrl && !brokenImageUrls.has(leadImageUrl) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (photos.length > 0) setLightboxIndex(0);
                        }}
                        className="block w-full text-left group"
                      >
                        <img
                          src={leadImageUrl}
                          alt={`${displayTitle} reference photograph`}
                          referrerPolicy="no-referrer"
                          onError={() => markBrokenUrl(leadImageUrl)}
                          className="w-full h-52 object-cover border border-inherit"
                        />
                        <div className={`text-[11px] mt-1.5 leading-snug ${mutedText}`}>
                          {bundle?.leadImageCaption || `${displayTitle} (${subtitleScientific})`}
                        </div>
                      </button>
                    ) : (
                      <div className="w-full h-44 flex flex-col items-center justify-center gap-2 border border-inherit bg-[#ebebeb] text-[#595959]">
                        <ImageOff className="w-6 h-6" />
                        <span className="text-[11px] px-4 text-center">{displayTitle}</span>
                      </div>
                    )}
                  </div>

                  {/* Scientific Classification & Earth Timeline Table */}
                  <dl className="divide-y divide-inherit">
                    {activeLifeEntry ? (
                      <>
                        <InfoboxRow label={ui.scientificName} value={activeLifeEntry.scientificName} italic />
                        <InfoboxRow label={ui.categoryLabel} value={activeLifeEntry.subgroup} />
                        <InfoboxRow label={ui.eraLabel} value={eraMeta.name} />
                        <InfoboxRow label={ui.livedSpanLabel} value={activeLifeEntry.livedSpan} mono />
                        <InfoboxRow
                          label={ui.statusLabel}
                          value={
                            activeLifeEntry.status === 'extant'
                              ? `● ${ui.livingLabel} (${activeLifeEntry.extinctionOrAge})`
                              : `✖ ${ui.extinctLabel} (${activeLifeEntry.extinctionOrAge})`
                          }
                        />
                        <InfoboxRow label={ui.populationLabel} value={activeLifeEntry.populationEstimate} />
                        <InfoboxRow label={ui.originLabel} value={activeLifeEntry.originRegion} />
                      </>
                    ) : activeEraTopic ? (
                      <>
                        <InfoboxRow label={ui.eraLabel} value={activeEraTopic.scientificName} />
                        <InfoboxRow label={ui.livedSpanLabel} value={activeEraTopic.timeRange} mono />
                        <InfoboxRow label="O₂ Level" value={`${eraMeta.oxygenPercent}%`} mono />
                        <InfoboxRow label="Mean Temp" value={`${eraMeta.meanTempC} °C`} mono />
                        <InfoboxRow label="Day Length" value={`${eraMeta.dayLengthHours} hours`} mono />
                      </>
                    ) : (
                      <InfoboxRow label="Wikipedia Edition" value={`${wikiLang}.wikipedia.org`} mono />
                    )}
                  </dl>

                  {photos.length > 0 && (
                    <div className="p-2.5 border-t border-inherit flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('gallery')}
                        className="w-full px-3 py-1.5 text-xs font-medium border rounded text-center transition-colors bg-white border-[#bdbdbd] text-[#111111] hover:bg-[#ebebeb]"
                      >
                        View all {photos.length} pictures in Gallery
                      </button>
                    </div>
                  )}
                </aside>

                {/* Article Narrative Prose */}
                <div id="wiki-sec-overview" className="space-y-4 text-[15px] leading-[1.7] max-w-prose">
                  {/* Show localized Wikipedia article lead first when viewing a non-English edition */}
                  {wikiLang !== 'en' && bundle && !bundle.fallbackToEnglish && bundle.parsed.leadParagraphs.length > 0 ? (
                    <>
                      {bundle.parsed.leadParagraphs.map((para, i) => (
                        <p key={`lead-top-${i}`} className={bodyText}>
                          {para}
                        </p>
                      ))}

                      {(activeLifeEntry || activeEraTopic) && (
                        <div className="p-3.5 border rounded text-xs space-y-1.5 bg-[#f7f7f7] border-[#d4d4d4]">
                          <div className="font-semibold text-[#111111]">{ui.curatedNotesHeading}</div>
                          <p className={bodyText}>
                            {activeLifeEntry?.summary ?? activeEraTopic?.summary}
                          </p>
                          <ul className="list-disc pl-4 space-y-1">
                            {(activeLifeEntry?.highlights ?? activeEraTopic?.highlights ?? []).map((item) => (
                              <li key={item} className={bodyText}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {bundle.parsed.sections.map((sec) => (
                        <section key={sec.id} id={sec.id} className="space-y-2.5 pt-2">
                          {sec.level === 2 ? (
                            <h2
                              className={`font-wiki-serif text-xl font-normal pb-1 border-b ${dividerBorder}`}
                            >
                              {sec.title}
                            </h2>
                          ) : (
                            <h3 className="font-wiki-serif text-base font-bold pt-1">
                              {sec.title}
                            </h3>
                          )}
                          {sec.paragraphs.map((p, idx) => (
                            <p key={`${sec.id}-p-${idx}`} className={bodyText}>
                              {p}
                            </p>
                          ))}
                        </section>
                      ))}
                    </>
                  ) : (
                    <>
                      {(activeLifeEntry || activeEraTopic) && (
                        <p className={bodyText}>
                          {activeLifeEntry?.summary ?? activeEraTopic?.summary}
                        </p>
                      )}

                      {(activeLifeEntry?.highlights.length || activeEraTopic?.highlights.length) ? (
                        <div className="p-3.5 border rounded text-xs space-y-1.5 bg-[#f7f7f7] border-[#d4d4d4]">
                          <div className="font-semibold text-[#111111]">{ui.curatedNotesHeading}</div>
                          <ul className="list-disc pl-4 space-y-1">
                            {(activeLifeEntry?.highlights ?? activeEraTopic?.highlights ?? []).map((item) => (
                              <li key={item} className={bodyText}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {loadingWiki && !bundle ? (
                        <div className={`py-4 text-xs ${mutedText}`}>{ui.loadingArticle}</div>
                      ) : wikiError && !bundle ? (
                        <div className={`p-3 border rounded text-xs ${infoboxBg}`}>
                          {ui.noLocalWikiNote} ({wikiError})
                        </div>
                      ) : (
                        bundle && (
                          <div className="space-y-4 pt-1">
                            {bundle.parsed.leadParagraphs.map((para, i) => (
                              <p key={`lead-${i}`} className={bodyText}>
                                {para}
                              </p>
                            ))}

                            {bundle.parsed.sections.map((sec) => (
                              <section key={sec.id} id={sec.id} className="space-y-2.5 pt-2">
                                {sec.level === 2 ? (
                                  <h2
                                    className={`font-wiki-serif text-xl font-normal pb-1 border-b ${dividerBorder}`}
                                  >
                                    {sec.title}
                                  </h2>
                                ) : (
                                  <h3 className="font-wiki-serif text-base font-bold pt-1">
                                    {sec.title}
                                  </h3>
                                )}
                                {sec.paragraphs.map((p, idx) => (
                                  <p key={`${sec.id}-p-${idx}`} className={bodyText}>
                                    {p}
                                  </p>
                                ))}
                              </section>
                            ))}
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>

                {/* Inline Wikipedia Photo Gallery inside Article */}
                {photos.length > 0 && (
                  <section id="wiki-sec-gallery" className="clear-both pt-6 mt-6 space-y-3">
                    <div className={`flex flex-wrap items-baseline justify-between gap-2 pb-1 border-b ${dividerBorder}`}>
                      <h2 className="font-wiki-serif text-xl font-normal">
                        {ui.galleryHeading} — {displayTitle}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setActiveTab('gallery')}
                        className={`text-xs ${wikiLink}`}
                      >
                        Open full gallery ({photos.length})
                      </button>
                    </div>
                    <p className={`text-xs ${mutedText}`}>{ui.gallerySubtext}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {photos.slice(0, 8).map((photo, idx) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          index={idx}
                          broken={brokenImageUrls.has(photo.thumbUrl)}
                          onError={() => markBrokenUrl(photo.thumbUrl)}
                          onOpen={() => setLightboxIndex(idx)}
                          compact
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Lightbox */}
      <WikiLightbox
        photos={photos}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </section>
  );
}

function DirectoryTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-[11px] rounded border transition-colors whitespace-nowrap shrink-0 ${
        active
          ? 'bg-[#111111] text-white border-[#111111] font-medium'
          : 'bg-white text-[#111111] border-[#d4d4d4] hover:bg-[#ebebeb]'
      }`}
    >
      {label} <span className="font-mono-tabular opacity-75">{count}</span>
    </button>
  );
}

function InfoboxRow({
  label,
  value,
  italic = false,
  mono = false,
}: {
  label: string;
  value: string;
  italic?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[108px_1fr] gap-2 px-3 py-1.5">
      <dt className="font-semibold text-[#404040]">{label}</dt>
      <dd className={`${italic ? 'italic' : ''} ${mono ? 'font-mono-tabular' : ''} break-words text-[#111111]`}>
        {value}
      </dd>
    </div>
  );
}

function PhotoCard({
  photo,
  index,
  broken,
  onError,
  onOpen,
  compact = false,
}: {
  photo: WikiPhotoItem;
  index: number;
  broken: boolean;
  onError: () => void;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left border rounded overflow-hidden flex flex-col transition-colors bg-[#f7f7f7] border-[#d4d4d4] hover:border-[#111111]"
    >
      <div className={`w-full overflow-hidden ${compact ? 'h-32' : 'h-44'} bg-[#ebebeb]`}>
        {broken ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2 bg-[#ebebeb] text-[#595959]">
            <ImageOff className="w-5 h-5" />
            <span className="text-[10px] text-center line-clamp-2">{photo.title}</span>
          </div>
        ) : (
          <img
            src={photo.thumbUrl}
            alt={photo.caption || photo.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={onError}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
          />
        )}
      </div>
      <div className="p-2 text-[11px] leading-snug">
        <div className="font-semibold line-clamp-1 text-[#111111]">
          Fig. {index + 1} · {photo.title}
        </div>
        <div className="line-clamp-2 mt-0.5 text-[#595959]">
          {photo.caption}
        </div>
      </div>
    </button>
  );
}
