import L from 'leaflet';
import * as THREE from 'three';
import { LEAFLET_BASE_LAYERS, type LeafletBaseLayerId } from '../data/earthData';
import { getDetailTileWindow, latToMercatorNormY, tileBoundsToLatLon } from '../utils/earthMath';

export interface LeafletGlobeTextureResult {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture | null;
  zoom: number;
}

export interface LeafletDetailPatchResult {
  map: THREE.CanvasTexture;
  bounds: { latNorth: number; latSouth: number; lonWest: number; lonEast: number };
  zoom: number;
  key: string;
}

function resolveLeafletTileUrl(
  templateUrl: string,
  x: number,
  y: number,
  z: number,
  subdomains = 'abc'
): string {
  const s = subdomains[Math.abs(x + y) % subdomains.length] ?? 'a';
  return L.Util.template(templateUrl, { s, x, y, z, r: '' });
}

const textureCache = new Map<string, LeafletGlobeTextureResult>();
const detailPatchCache = new Map<string, LeafletDetailPatchResult>();

function loadTileImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    // A stalled tile must eventually report failure so the request can retry.
    const timeout = window.setTimeout(() => finish(null), 12000);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

async function buildLeafletEquirectangularTexture(
  layerId: LeafletBaseLayerId,
  showOverlayLabels: boolean,
  zoom: number,
  maxAnisotropy: number
): Promise<LeafletGlobeTextureResult | null> {
  const cfg = LEAFLET_BASE_LAYERS.find((b) => b.id === layerId) ?? LEAFLET_BASE_LAYERS[0];
  const tileCount = 1 << zoom; // 8 at z=3
  const tileSize = 256;
  const mercSize = tileCount * tileSize;
  const subdomains = cfg.subdomains ?? 'abc';

  const jobs: Array<
    Promise<{
      x: number;
      y: number;
      base: HTMLImageElement | null;
      overlay: HTMLImageElement | null;
    }>
  > = [];

  for (let y = 0; y < tileCount; y++) {
    for (let x = 0; x < tileCount; x++) {
      const baseUrl = resolveLeafletTileUrl(cfg.url, x, y, zoom, subdomains);
      const overlayUrl =
        showOverlayLabels && cfg.overlayUrl
          ? resolveLeafletTileUrl(cfg.overlayUrl, x, y, zoom, subdomains)
          : null;
      jobs.push(
        Promise.all([
          loadTileImage(baseUrl),
          overlayUrl ? loadTileImage(overlayUrl) : Promise.resolve(null),
        ]).then(([base, overlay]) => ({ x, y, base, overlay }))
      );
    }
  }

  const tiles = await Promise.all(jobs);
  const loadedCount = tiles.filter((t) => t.base !== null).length;
  // Do not publish a map containing blank tiles; the caller can retry it.
  if (loadedCount !== tiles.length) {
    return null;
  }

  // 1. Composite Leaflet Web Mercator (EPSG:3857) tile grid
  const mercCanvas = document.createElement('canvas');
  mercCanvas.width = mercSize;
  mercCanvas.height = mercSize;
  const mercCtx = mercCanvas.getContext('2d')!;
  mercCtx.fillStyle = layerId === 'dark' ? '#141820' : '#081a38';
  mercCtx.fillRect(0, 0, mercSize, mercSize);

  for (const t of tiles) {
    if (t.base) {
      mercCtx.drawImage(t.base, t.x * tileSize, t.y * tileSize, tileSize, tileSize);
    }
    if (t.overlay) {
      mercCtx.drawImage(t.overlay, t.x * tileSize, t.y * tileSize, tileSize, tileSize);
    }
  }

  // 2. Reproject Leaflet CRS.EPSG3857 Mercator rows -> Equirectangular 2:1 canvas for SphereGeometry
  const equiW = mercSize;
  const equiH = mercSize / 2;
  const equiCanvas = document.createElement('canvas');
  equiCanvas.width = equiW;
  equiCanvas.height = equiH;
  const equiCtx = equiCanvas.getContext('2d')!;

  const MAX_MERCATOR_LAT = 85.05112878;
  for (let ey = 0; ey < equiH; ey++) {
    const lat = 90 - ((ey + 0.5) / equiH) * 180;
    const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
    const mercPt = L.CRS.EPSG3857.latLngToPoint(L.latLng(clampedLat, 0), zoom);
    const normY = latToMercatorNormY(clampedLat);
    const py = Number.isFinite(mercPt.y) ? mercPt.y : normY * mercSize;
    const srcY = Math.min(mercSize - 1, Math.max(0, Math.floor(py)));
    equiCtx.drawImage(mercCanvas, 0, srcY, mercSize, 1, 0, ey, equiW, 1);
  }

  const map = new THREE.CanvasTexture(equiCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = maxAnisotropy;
  map.needsUpdate = true;

  // Derive subtle ocean-vs-land roughness only for Satellite imagery
  let roughnessMap: THREE.CanvasTexture | null = null;
  if (layerId === 'satellite') {
    const rw = 512;
    const rh = 256;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = rw;
    sampleCanvas.height = rh;
    const sCtx = sampleCanvas.getContext('2d')!;
    sCtx.drawImage(equiCanvas, 0, 0, rw, rh);
    const srcData = sCtx.getImageData(0, 0, rw, rh).data;

    const roughImg = sCtx.createImageData(rw, rh);
    for (let i = 0; i < rw * rh; i++) {
      const idx = i * 4;
      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const isOcean = b > r * 1.25 && b > g * 1.08 && r < 95;
      const val = isOcean ? 132 : 232;
      roughImg.data[idx] = val;
      roughImg.data[idx + 1] = val;
      roughImg.data[idx + 2] = val;
      roughImg.data[idx + 3] = 255;
    }
    sCtx.putImageData(roughImg, 0, 0);
    roughnessMap = new THREE.CanvasTexture(sampleCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.ClampToEdgeWrapping;
    roughnessMap.anisotropy = maxAnisotropy;
    roughnessMap.needsUpdate = true;
  }

  return { map, roughnessMap, zoom };
}

/** Load the final global map directly; do not display a low-resolution stage. */
export function loadLeafletGlobeTexture(
  layerId: LeafletBaseLayerId,
  showOverlayLabels: boolean,
  maxAnisotropy: number,
  onReady: (result: LeafletGlobeTextureResult) => void,
  onFailure?: () => void
): () => void {
  let cancelled = false;
  const key = `${layerId}:${showOverlayLabels ? 'labels' : 'clean'}`;
  const cached = textureCache.get(key);
  if (cached) {
    onReady(cached);
  } else {
    buildLeafletEquirectangularTexture(layerId, showOverlayLabels, 3, maxAnisotropy)
      .catch(() => null)
      .then((result) => {
        if (!result) {
          if (!cancelled) onFailure?.();
          return;
        }
        if (cancelled) {
          result.map.dispose();
          result.roughnessMap?.dispose();
          return;
        }
        const existing = textureCache.get(key);
        if (existing) {
          result.map.dispose();
          result.roughnessMap?.dispose();
          onReady(existing);
        } else {
          textureCache.set(key, result);
          onReady(result);
        }
      });
  }
  return () => { cancelled = true; };
}

export function getDetailPatchKey(layerId: LeafletBaseLayerId, showOverlayLabels: boolean, lat: number, lon: number, zoom: number, size: 4 | 6 = 4): string {
  const { clampedZoom, txStart, tyStart } = getDetailTileWindow(lat, lon, zoom, size);
  return `${layerId}:${showOverlayLabels ? 'L' : 'C'}:z${clampedZoom}:s${size}:x${txStart}:y${tyStart}`;
}

/**
 * Loads a localized high-resolution Leaflet tile patch (z=4..z=6) centered on the
 * camera target. A wider z=4 patch improves the opening view without fetching a
 * complete 256-tile world map.
 */
export function loadLeafletDetailPatch(
  layerId: LeafletBaseLayerId,
  showOverlayLabels: boolean,
  centerLat: number,
  centerLon: number,
  zoom: number,
  maxAnisotropy: number,
  onReady: (patch: LeafletDetailPatchResult) => void,
  onFailure?: () => void,
  size: 4 | 6 = 4
): () => void {
  let cancelled = false;
  const { clampedZoom, tileCount, txStart, txEnd, tyStart, tyEnd } = getDetailTileWindow(centerLat, centerLon, zoom, size);
  const key = getDetailPatchKey(layerId, showOverlayLabels, centerLat, centerLon, zoom, size);
  const cached = detailPatchCache.get(key);
  if (cached) {
    onReady(cached);
    return () => {
      cancelled = true;
    };
  }

  const cfg = LEAFLET_BASE_LAYERS.find((b) => b.id === layerId) ?? LEAFLET_BASE_LAYERS[0];
  const subdomains = cfg.subdomains ?? 'abc';
  const tileSize = 256;
  const cols = txEnd - txStart + 1;
  const rows = tyEnd - tyStart + 1;

  const jobs: Array<
    Promise<{
      col: number;
      row: number;
      base: HTMLImageElement | null;
      overlay: HTMLImageElement | null;
    }>
  > = [];

  for (let row = 0; row < rows; row++) {
    const ty = tyStart + row;
    for (let col = 0; col < cols; col++) {
      const rawTx = txStart + col;
      const wrappedTx = ((rawTx % tileCount) + tileCount) % tileCount;
      const baseUrl = resolveLeafletTileUrl(cfg.url, wrappedTx, ty, clampedZoom, subdomains);
      const overlayUrl =
        showOverlayLabels && cfg.overlayUrl
          ? resolveLeafletTileUrl(cfg.overlayUrl, wrappedTx, ty, clampedZoom, subdomains)
          : null;
      jobs.push(
        Promise.all([
          loadTileImage(baseUrl),
          overlayUrl ? loadTileImage(overlayUrl) : Promise.resolve(null),
        ]).then(([base, overlay]) => ({ col, row, base, overlay }))
      );
    }
  }

  Promise.all(jobs).then((tiles) => {
    if (cancelled) return;
    const loaded = tiles.filter((t) => t.base !== null).length;
    const labelsIncomplete = showOverlayLabels && !!cfg.overlayUrl && tiles.some((t) => t.overlay === null);
    if (loaded !== tiles.length || labelsIncomplete) {
      // Keep the global map instead of covering it with blank or unlabelled tiles.
      onFailure?.();
      return;
    }

    const mercW = cols * tileSize;
    const mercH = rows * tileSize;
    const mercCanvas = document.createElement('canvas');
    mercCanvas.width = mercW;
    mercCanvas.height = mercH;
    const mercCtx = mercCanvas.getContext('2d')!;
    mercCtx.fillStyle = layerId === 'dark' ? '#141820' : '#081a38';
    mercCtx.fillRect(0, 0, mercW, mercH);

    for (const t of tiles) {
      if (t.base) {
        mercCtx.drawImage(t.base, t.col * tileSize, t.row * tileSize, tileSize, tileSize);
      }
      if (t.overlay) {
        mercCtx.drawImage(t.overlay, t.col * tileSize, t.row * tileSize, tileSize, tileSize);
      }
    }

    const bounds = tileBoundsToLatLon(txStart, txEnd, tyStart, tyEnd, clampedZoom);
    const equiW = mercW;
    const equiH = mercH;
    const equiCanvas = document.createElement('canvas');
    equiCanvas.width = equiW;
    equiCanvas.height = equiH;
    const equiCtx = equiCanvas.getContext('2d')!;

    for (let ey = 0; ey < equiH; ey++) {
      const lat = bounds.latNorth - ((ey + 0.5) / equiH) * (bounds.latNorth - bounds.latSouth);
      const normY = latToMercatorNormY(lat);
      const localPy = (normY * tileCount - tyStart) * tileSize;
      const srcY = Math.min(mercH - 1, Math.max(0, Math.floor(localPy)));
      equiCtx.drawImage(mercCanvas, 0, srcY, mercW, 1, 0, ey, equiW, 1);
    }

    const map = new THREE.CanvasTexture(equiCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.ClampToEdgeWrapping;
    map.anisotropy = maxAnisotropy;
    map.needsUpdate = true;

    const result: LeafletDetailPatchResult = {
      map,
      bounds,
      zoom: clampedZoom,
      key,
    };

    // A wide patch is 1536×1536; limit retained canvases and GPU textures.
    if (detailPatchCache.size >= 3) {
      const oldestKey = detailPatchCache.keys().next().value;
      if (oldestKey) {
        detailPatchCache.get(oldestKey)?.map.dispose();
        detailPatchCache.delete(oldestKey);
      }
    }
    detailPatchCache.set(key, result);
    onReady(result);
  }).catch(() => {
    if (!cancelled) onFailure?.();
  });

  return () => {
    cancelled = true;
  };
}

export function disposeLeafletTextureCache(): void {
  textureCache.forEach((entry) => {
    entry.map.dispose();
    entry.roughnessMap?.dispose();
  });
  textureCache.clear();
  detailPatchCache.forEach((entry) => {
    entry.map.dispose();
  });
  detailPatchCache.clear();
}

