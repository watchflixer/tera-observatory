interface AboutButtonProps {
  onOpen: () => void;
}

export function AboutButton({ onOpen }: AboutButtonProps) {
  return (
    <div className="fixed right-0 top-28 z-40">
      <button
        type="button"
        aria-label="Open about and support page"
        onClick={onOpen}
        className="relative flex h-11 w-12 items-center justify-center overflow-hidden rounded-l-xl border border-r-0 border-[#eea739] text-[#38200a] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{
          background: 'linear-gradient(180deg, #ffe0a0 0%, #f9b340 22%, #ec8b18 50%, #c96d0e 51%, #e99426 100%)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(112,54,0,0.32), 0 3px 12px rgba(0,0,0,0.4)',
        }}
      >
        <span className="shop-button-glint" aria-hidden="true" />
        <svg className="relative z-10 h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="9" r="3.15" />
          <circle cx="4.5" cy="7.4" r="2.5" />
          <circle cx="19.5" cy="7.4" r="2.5" />
          <path transform="translate(0 -3.2)" d="M6.6 20.1a5.75 5.75 0 0 1 10.8 0c.15.4-.1.8-.55.8h-9.7c-.45 0-.7-.4-.55-.8Z" />
          <path transform="translate(0 -2.7)" d="M.8 17.15a4.05 4.05 0 0 1 7.4-1.7 7.3 7.3 0 0 0-1.6 2.3H1.25c-.35 0-.55-.27-.45-.6ZM23.2 17.15a4.05 4.05 0 0 0-7.4-1.7 7.3 7.3 0 0 1 1.6 2.3h5.35c.35 0 .55-.27.45-.6Z" />
        </svg>
        <span className="shop-button-sparkle" aria-hidden="true">✦</span>
      </button>
    </div>
  );
}
