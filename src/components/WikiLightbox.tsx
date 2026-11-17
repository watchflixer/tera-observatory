import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WikiPhotoItem } from '../utils/wikipediaApi';

interface WikiLightboxProps {
  photos: WikiPhotoItem[];
  activeIndex: number | null;
  onClose: () => void;
  onChangeIndex: (nextIndex: number) => void;
}

export function WikiLightbox({
  photos,
  activeIndex,
  onClose,
  onChangeIndex,
}: WikiLightboxProps) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') {
        onChangeIndex((activeIndex + 1) % photos.length);
      } else if (e.key === 'ArrowLeft') {
        onChangeIndex((activeIndex - 1 + photos.length) % photos.length);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeIndex, photos.length, onClose, onChangeIndex]);

  if (activeIndex === null || !photos[activeIndex]) return null;
  const photo = photos[activeIndex];
  const src = photo.fullUrl || photo.thumbUrl;
  const broken = failedUrls.has(src);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo preview: ${photo.title}`}
      className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4 md:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white border border-[#bdbdbd] rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#e5e5e5] bg-[#f7f7f7] text-xs text-[#111111]">
          <div className="min-w-0">
            <span className="font-mono-tabular text-[#595959] mr-2">
              {activeIndex + 1} / {photos.length}
            </span>
            <span className="font-semibold text-[#111111] truncate">{photo.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={photo.fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#111111] bg-white hover:bg-[#ebebeb] border border-[#bdbdbd] rounded-md whitespace-nowrap"
            >
              Original File
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close photo preview"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-[#111111] hover:bg-[#2b2b2b] rounded-md whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Close
            </button>
          </div>
        </div>

        {/* Media Frame */}
        <div className="relative flex-1 min-h-[260px] bg-[#111111] flex items-center justify-center overflow-hidden p-3">
          {broken ? (
            <div className="flex flex-col items-center justify-center gap-2 text-[#d4d4d4] py-16">
              <ImageOff className="w-8 h-8" />
              <span className="text-xs">Full-resolution image unavailable — try thumbnail or original link.</span>
            </div>
          ) : (
            <img
              src={src}
              alt={photo.caption || photo.title}
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedUrls((prev) => {
                  const next = new Set(prev);
                  next.add(src);
                  return next;
                })
              }
              className="max-h-[64vh] max-w-full object-contain rounded"
            />
          )}

          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => onChangeIndex((activeIndex - 1 + photos.length) % photos.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 text-[#111111] border border-[#bdbdbd] hover:bg-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => onChangeIndex((activeIndex + 1) % photos.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 text-[#111111] border border-[#bdbdbd] hover:bg-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Caption */}
        <div className="px-4 py-3 border-t border-[#e5e5e5] bg-[#f7f7f7] text-xs text-[#222222] leading-relaxed">
          {photo.caption || photo.title}
        </div>
      </div>
    </div>
  );
}
