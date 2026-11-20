import type { HistoryEraId, ObservatoryMode } from '../data/earthData';

/** Cenozoic displays present-day Earth, using the same globe as Systems. */
export function isModernGlobeView(mode: ObservatoryMode, era: HistoryEraId): boolean {
  return mode === 'systems' || (mode === 'history' && era === 'cenozoic');
}

/** A modest sharpness boost for the 3D Globe, with bounded mobile/GPU cost. */
export function getRenderPixelRatio(mode: ObservatoryMode, devicePixelRatio: number, coarsePointer: boolean, softwareWebGL: boolean): number {
  if (softwareWebGL) return 1;
  const cap = coarsePointer ? (mode === 'systems' ? 1.75 : 1.5) : 2;
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, cap);
}

/** Keep a sharper patch on the visible hemisphere, including at the home view. */
export function getGlobeDetailZoom(_cameraDistance: number, leafletZoom: number): number {
  return Math.max(4, leafletZoom);
}
