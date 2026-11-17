import type { ObservatoryMode } from '../data/earthData';

interface TopBarProps {
  mode: ObservatoryMode;
  onModeChange: (mode: ObservatoryMode) => void;
  onResetView: () => void;
  zenMode: boolean;
}

const MODE_ITEMS: Array<{ id: ObservatoryMode; label: string }> = [
  { id: 'systems', label: '3D Globe' },
  { id: 'interior', label: 'Interior' },
  { id: 'atmosphere', label: 'Atmosphere' },
  { id: 'history', label: 'Earth History' },
];

export function TopBar({ mode, onModeChange, onResetView, zenMode }: TopBarProps) {
  if (zenMode) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-20 flex items-center justify-between gap-4 md:gap-8 px-4 md:px-6 h-14 bg-black/95 border-b border-neutral-800">
      {/* Zone 1: Single-element brand wordmark */}
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onResetView();
        }}
        className="font-display text-base md:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0a43b] rounded"
      >
        Terra Observatory
      </a>

      {/* Zone 2: 4 clean single-line navigation tabs */}
      <nav aria-label="Observatory Sections" className="hidden md:flex items-center gap-6">
        {MODE_ITEMS.map((item) => {
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onModeChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0a43b] ${
                active ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-[#e0a43b]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onResetView}
          className="px-4 py-1.5 text-xs font-semibold text-black bg-white hover:bg-neutral-200 rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0a43b]"
        >
          Reset View
        </button>
      </div>
    </header>
  );
}
