import { ShoppingCart } from 'lucide-react';

interface ShopButtonProps {
  onOpen: () => void;
}

export function ShopButton({ onOpen }: ShopButtonProps) {
  return (
    <div className="fixed right-0 top-28 z-40">
      <button
        type="button"
        aria-label="Open shop"
        onClick={onOpen}
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
    </div>
  );
}
