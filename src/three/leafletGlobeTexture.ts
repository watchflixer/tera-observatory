import L from 'leaflet';
import * as THREE from 'three';
import { LEAFLET_BASE_LAYERS, type LeafletBaseLayerId } from '../data/earthData';
import { latLonToTileXY, latToMercatorNormY, tileBoundsToLatLon } from '../utils/earthMath';

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
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
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
  const tileCount = 1 << zoom; // 4 at z=2, 8 at z=3
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
  if (loadedCount === 0) {
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

/**
 * Loads a live Leaflet tile map (EPSG:3857) progressively at z=2 then z=3,
 * reprojected into Equirectangular coordinates for Three.js SphereGeometry.
 */
export function loadLeafletGlobeTexture(
  layerId: LeafletBaseLayerId,
  showOverlayLabels: boolean,
  maxAnisotropy: number,
  onReady: (result: LeafletGlobeTextureResult) => void
): () => void {
  let cancelled = false;
  const key = `${layerId}:${showOverlayLabels ? 'labels' : 'clean'}`;

  const cached = textureCache.get(key);
  if (cached) {
    onReady(cached);
    return () => {
      cancelled = true;
    };
  }

  // Stage 1: Fast z=2 global composite (16 tiles)
  buildLeafletEquirectangularTexture(layerId, showOverlayLabels, 2, maxAnisotropy).then((z2) => {
    if (cancelled || !z2) return;
    if (!textureCache.has(key)) {
      textureCache.set(key, z2);
      onReady(z2);
    } else {
      z2.map.dispose();
      z2.roughnessMap?.dispose();
    }

    // Stage 2: High-res z=3 global composite (64 tiles = 2048x1024)
    buildLeafletEquirectangularTexture(layerId, showOverlayLabels, 3, maxAnisotropy).then((z3) => {
      if (cancelled || !z3) {
        if (z3) {
          z3.map.dispose();
          z3.roughnessMap?.dispose();
        }
        return;
      }
      const prev = textureCache.get(key);
      textureCache.set(key, z3);
      onReady(z3);
      if (prev && prev !== z3) {
        prev.map.dispose();
        prev.roughnessMap?.dispose();
      }
    });
  });

  return () => {
    cancelled = true;
  };
}

/**
 * Loads a localized high-resolution Leaflet tile patch (z=4..z=6) centered on the user's
 * zoomed-in camera target, reprojected onto a sub-sphere patch for Google-Earth-like zoom crispness.
 */
export function loadLeafletDetailPatch(
  layerId: LeafletBaseLayerId,
  showOverlayLabels: boolean,
  centerLat: number,
  centerLon: number,
  zoom: number,
  maxAnisotropy: number,
  onReady: (patch: LeafletDetailPatchResult) => void
): () => void {
  let cancelled = false;
  const clampedZoom = Math.max(4, Math.min(6, zoom));
  const clampedLat = Math.max(-76, Math.min(76, centerLat));
  const tileCount = 1 << clampedZoom;
  const { x: cx, y: cy } = latLonToTileXY(clampedLat, centerLon, clampedZoom);

  // Compute fractional tile indices so our 4x4 window centers symmetrically around the camera target
  const wrappedLon = ((((centerLon + 180) % 360) + 360) % 360) - 180;
  const fx = ((wrappedLon + 180) / 360) * tileCount;
  const fy = latToMercatorNormY(clampedLat) * tileCount;
  const anchorX = Number.isFinite(fx) ? Math.round(fx) : cx;
  const anchorY = Number.isFinite(fy) ? Math.round(fy) : cy;

  const txStart = anchorX - 2;
  const txEnd = txStart + 3;
  const tyStart = Math.max(0, Math.min(tileCount - 4, anchorY - 2));
  const tyEnd = Math.min(tileCount - 1, tyStart + 3);

  const key = `${layerId}:${showOverlayLabels ? 'L' : 'C'}:z${clampedZoom}:x${txStart}:y${tyStart}`;
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
    if (loaded === 0) return;

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

    // Keep detail patch cache bounded to avoid unbounded GPU texture memory
    if (detailPatchCache.size >= 10) {
      const oldestKey = detailPatchCache.keys().next().value;
      if (oldestKey) {
        detailPatchCache.get(oldestKey)?.map.dispose();
        detailPatchCache.delete(oldestKey);
      }
    }
    detailPatchCache.set(key, result);
    onReady(result);
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

