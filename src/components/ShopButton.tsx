import { ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';

/** A placeholder for the future shop; no payment or checkout is connected. */
export function ShopButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-0 top-28 z-40">
      <button
        type="button"
        aria-label="Shop"
        aria-expanded={open}
        aria-controls="shop-placeholder"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-12 items-center justify-center overflow-hidden rounded-l-xl border border-r-0 border-[#eea739] text-[#38200a] transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{
          background: 'linear-gradient(180deg, #ffe0a0 0%, #f9b340 22%, #ec8b18 50%, #c96d0e 51%, #e99426 100%)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(112,54,0,0.32), 0 3px 12px rgba(0,0,0,0.4)',
        }}
      >
        <span className="shop-button-glint" aria-hidden="true" />
        <ShoppingCart className="relative z-10 h-5 w-5" aria-hidden="true" />
        <span className="shop-button-sparkle" aria-hidden="true">✦</span>
      </button>
      {open && (
        <div
          id="shop-placeholder"
          role="status"
          className="absolute right-14 top-0 flex w-max max-w-[calc(100vw-5rem)] items-center gap-3 rounded-lg border border-neutral-700 bg-[#141414] px-3 py-2 text-xs text-white shadow-xl"
        >
          <span>Shop coming soon.</span>
          <button
            type="button"
            aria-label="Close shop notice"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-neutral-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0a43b]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
