import * as THREE from 'three';
import dinoSkinUrl from '../assets/images/dinosaur_scale_skin_1794950619902.jpg';
import forestBarkUrl from '../assets/images/forest_moss_bark_1794950621038.jpg';
import fernFrondUrl from '../assets/images/prehistoric_fern_frond_1794950621447.jpg';
import forestVistaUrl from '../assets/images/prehistoric_forest_vista_1794950619443.jpg';

export interface CgiTexturePack {
  vistaMap: THREE.CanvasTexture;
  dinoAlbedoMap: THREE.CanvasTexture;
  dinoNormalMap: THREE.CanvasTexture;
  dinoRoughnessMap: THREE.CanvasTexture;
  barkAlbedoMap: THREE.CanvasTexture;
  barkNormalMap: THREE.CanvasTexture;
  rockAlbedoMap: THREE.CanvasTexture;
  fernAlbedoMap: THREE.CanvasTexture;
  fernAlphaMap: THREE.CanvasTexture;
  dispose: () => void;
}

interface CachedCanvasAssets {
  vistaCanvas: HTMLCanvasElement | null;
  dinoAlbedoCanvas: HTMLCanvasElement | null;
  dinoNormalCanvas: HTMLCanvasElement | null;
  dinoRoughCanvas: HTMLCanvasElement | null;
  barkAlbedoCanvas: HTMLCanvasElement | null;
  barkNormalCanvas: HTMLCanvasElement | null;
  rockAlbedoCanvas: HTMLCanvasElement | null;
  fernAlbedoCanvas: HTMLCanvasElement | null;
  fernAlphaCanvas: HTMLCanvasElement | null;
}

const cachedAssets: CachedCanvasAssets = {
  vistaCanvas: null,
  dinoAlbedoCanvas: null,
  dinoNormalCanvas: null,
  dinoRoughCanvas: null,
  barkAlbedoCanvas: null,
  barkNormalCanvas: null,
  rockAlbedoCanvas: null,
  fernAlbedoCanvas: null,
  fernAlphaCanvas: null,
};

let preloadStarted = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

/**
 * Generates a tangent-space normal map + roughness map from an RGBA diffuse pixel buffer via a Sobel height filter.
 */
function buildNormalAndRoughnessCanvases(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number,
  includeRoughness: boolean
): { normalCanvas: HTMLCanvasElement; roughCanvas: HTMLCanvasElement | null } {
  const getLum = (x: number, y: number): number => {
    const wx = ((x % width) + width) % width;
    const wy = ((y % height) + height) % height;
    const idx = (wy * width + wx) * 4;
    return (srcData[idx] * 0.299 + srcData[idx + 1] * 0.587 + srcData[idx + 2] * 0.114) / 255;
  };

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = width;
  normalCanvas.height = height;
  const nCtx = normalCanvas.getContext('2d');
  if (nCtx) {
    const out = nCtx.createImageData(width, height);
    const dst = out.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tl = getLum(x - 1, y - 1);
        const t = getLum(x, y - 1);
        const tr = getLum(x + 1, y - 1);
        const l = getLum(x - 1, y);
        const r = getLum(x + 1, y);
        const bl = getLum(x - 1, y + 1);
        const b = getLum(x, y + 1);
        const br = getLum(x + 1, y + 1);

        const dX = tr + 2 * r + br - (tl + 2 * l + bl);
        const dY = bl + 2 * b + br - (tl + 2 * t + tr);

        let nx = -dX * strength;
        let ny = -dY * strength;
        let nz = 1.0;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;

        const idx = (y * width + x) * 4;
        dst[idx] = Math.round((nx * 0.5 + 0.5) * 255);
        dst[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        dst[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        dst[idx + 3] = 255;
      }
    }
    nCtx.putImageData(out, 0, 0);
  }

  let roughCanvas: HTMLCanvasElement | null = null;
  if (includeRoughness) {
    roughCanvas = document.createElement('canvas');
    roughCanvas.width = width;
    roughCanvas.height = height;
    const rCtx = roughCanvas.getContext('2d');
    if (rCtx) {
      const out = rCtx.createImageData(width, height);
      const dst = out.data;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const lum = getLum(x, y);
          const rough = Math.round((0.92 - lum * 0.42) * 255);
          const idx = (y * width + x) * 4;
          dst[idx] = rough;
          dst[idx + 1] = rough;
          dst[idx + 2] = rough;
          dst[idx + 3] = 255;
        }
      }
      rCtx.putImageData(out, 0, 0);
    }
  }

  return { normalCanvas, roughCanvas };
}

function loadImg(url: string, onReady: (img: HTMLImageElement) => void): void {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => onReady(img);
  img.src = url;
}

/**
 * Starts decoding and processing all 4 photorealistic CGI image assets in the background
 * once at module import so opening the Extinct view renders high-def textures from frame 1.
 */
export function prewarmCgiTextureCache(): void {
  if (preloadStarted || typeof document === 'undefined') return;
  preloadStarted = true;

  loadImg(forestVistaUrl, (img) => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, 1280, 720);
      // Soft warm mossy fade across very bottom 10% so backdrop blends seamlessly into 3D ground
      const fade = ctx.createLinearGradient(0, 620, 0, 720);
      fade.addColorStop(0, 'rgba(38, 42, 24, 0)');
      fade.addColorStop(1, 'rgba(38, 42, 24, 0.92)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 620, 1280, 100);
    }
    cachedAssets.vistaCanvas = c;
    notifyListeners();
  });

  loadImg(dinoSkinUrl, (img) => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const { normalCanvas, roughCanvas } = buildNormalAndRoughnessCanvases(data, size, size, 3.1, true);
      cachedAssets.dinoAlbedoCanvas = c;
      cachedAssets.dinoNormalCanvas = normalCanvas;
      cachedAssets.dinoRoughCanvas = roughCanvas;
      notifyListeners();
    }
  });

  loadImg(forestBarkUrl, (img) => {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const { normalCanvas } = buildNormalAndRoughnessCanvases(data, size, size, 3.4, false);
      cachedAssets.barkAlbedoCanvas = c;
      cachedAssets.barkNormalCanvas = normalCanvas;

      const rc = document.createElement('canvas');
      rc.width = size;
      rc.height = size;
      const rCtx = rc.getContext('2d');
      if (rCtx) {
        rCtx.drawImage(img, 0, 0, size, size);
        rCtx.fillStyle = 'rgba(42, 48, 38, 0.42)';
        rCtx.fillRect(0, 0, size, size);
      }
      cachedAssets.rockAlbedoCanvas = rc;
      notifyListeners();
    }
  });

  loadImg(fernFrondUrl, (img) => {
    const size = 512;
    const albedo = document.createElement('canvas');
    albedo.width = size;
    albedo.height = size;
    const alpha = document.createElement('canvas');
    alpha.width = size;
    alpha.height = size;
    const aCtx = albedo.getContext('2d', { willReadFrequently: true });
    const mCtx = alpha.getContext('2d');
    if (aCtx && mCtx) {
      aCtx.drawImage(img, 0, 0, size, size);
      const src = aCtx.getImageData(0, 0, size, size);
      const alphaOut = mCtx.createImageData(size, size);
      const s = src.data;
      const a = alphaOut.data;
      for (let i = 0; i < s.length; i += 4) {
        const peak = Math.max(s[i], s[i + 1], s[i + 2]);
        const mask = peak > 22 ? 255 : 0;
        a[i] = mask;
        a[i + 1] = mask;
        a[i + 2] = mask;
        a[i + 3] = 255;
        if (mask > 0) {
          s[i] = Math.min(255, Math.round(s[i] * 1.15));
          s[i + 1] = Math.min(255, Math.round(s[i + 1] * 1.2));
          s[i + 2] = Math.min(255, Math.round(s[i + 2] * 1.1));
        }
      }
      aCtx.putImageData(src, 0, 0);
      mCtx.putImageData(alphaOut, 0, 0);
      cachedAssets.fernAlbedoCanvas = albedo;
      cachedAssets.fernAlphaCanvas = alpha;
      notifyListeners();
    }
  });
}

// Immediately start prewarming when bundled module evaluates
prewarmCgiTextureCache();

function makeCanvasTexture(
  width: number,
  height: number,
  colorSpace: THREE.ColorSpace,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 4
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.wrapS = repeatX > 1 || repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatX > 1 || repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  return { canvas, ctx, tex };
}

export function createCgiTexturePack(
  maxAnisotropy: number,
  onTextureUpdated?: () => void
): CgiTexturePack {
  prewarmCgiTextureCache();

  const vista = makeCanvasTexture(1280, 720, THREE.SRGBColorSpace, 1, 1, maxAnisotropy);
  const dinoAlbedo = makeCanvasTexture(512, 512, THREE.SRGBColorSpace, 2, 2, maxAnisotropy);
  const dinoNormal = makeCanvasTexture(512, 512, THREE.NoColorSpace, 2, 2, maxAnisotropy);
  const dinoRough = makeCanvasTexture(512, 512, THREE.NoColorSpace, 2, 2, maxAnisotropy);
  const barkAlbedo = makeCanvasTexture(512, 512, THREE.SRGBColorSpace, 2, 4, maxAnisotropy);
  const barkNormal = makeCanvasTexture(512, 512, THREE.NoColorSpace, 2, 4, maxAnisotropy);
  const rockAlbedo = makeCanvasTexture(512, 512, THREE.SRGBColorSpace, 2, 2, maxAnisotropy);
  const fernAlbedo = makeCanvasTexture(512, 512, THREE.SRGBColorSpace, 1, 1, maxAnisotropy);
  const fernAlpha = makeCanvasTexture(512, 512, THREE.NoColorSpace, 1, 1, maxAnisotropy);
  fernAlbedo.tex.wrapS = THREE.ClampToEdgeWrapping;
  fernAlbedo.tex.wrapT = THREE.ClampToEdgeWrapping;
  fernAlpha.tex.wrapS = THREE.ClampToEdgeWrapping;
  fernAlpha.tex.wrapT = THREE.ClampToEdgeWrapping;

  const syncFromCache = () => {
    let updated = false;
    if (cachedAssets.vistaCanvas && vista.ctx) {
      vista.ctx.drawImage(cachedAssets.vistaCanvas, 0, 0);
      vista.tex.needsUpdate = true;
      updated = true;
    } else if (vista.ctx && !updated) {
      const grad = vista.ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, '#3a4224');
      grad.addColorStop(0.5, '#595830');
      grad.addColorStop(1, '#262a18');
      vista.ctx.fillStyle = grad;
      vista.ctx.fillRect(0, 0, 1280, 720);
      vista.tex.needsUpdate = true;
    }

    if (cachedAssets.dinoAlbedoCanvas && dinoAlbedo.ctx) {
      dinoAlbedo.ctx.drawImage(cachedAssets.dinoAlbedoCanvas, 0, 0);
      dinoAlbedo.tex.needsUpdate = true;
      updated = true;
    } else if (dinoAlbedo.ctx) {
      dinoAlbedo.ctx.fillStyle = '#5c5852';
      dinoAlbedo.ctx.fillRect(0, 0, 512, 512);
      dinoAlbedo.tex.needsUpdate = true;
    }

    if (cachedAssets.dinoNormalCanvas && dinoNormal.ctx) {
      dinoNormal.ctx.drawImage(cachedAssets.dinoNormalCanvas, 0, 0);
      dinoNormal.tex.needsUpdate = true;
    } else if (dinoNormal.ctx) {
      dinoNormal.ctx.fillStyle = '#8080ff';
      dinoNormal.ctx.fillRect(0, 0, 512, 512);
      dinoNormal.tex.needsUpdate = true;
    }

    if (cachedAssets.dinoRoughCanvas && dinoRough.ctx) {
      dinoRough.ctx.drawImage(cachedAssets.dinoRoughCanvas, 0, 0);
      dinoRough.tex.needsUpdate = true;
    } else if (dinoRough.ctx) {
      dinoRough.ctx.fillStyle = '#b4b4b4';
      dinoRough.ctx.fillRect(0, 0, 512, 512);
      dinoRough.tex.needsUpdate = true;
    }

    if (cachedAssets.barkAlbedoCanvas && barkAlbedo.ctx) {
      barkAlbedo.ctx.drawImage(cachedAssets.barkAlbedoCanvas, 0, 0);
      barkAlbedo.tex.needsUpdate = true;
    } else if (barkAlbedo.ctx) {
      barkAlbedo.ctx.fillStyle = '#33281d';
      barkAlbedo.ctx.fillRect(0, 0, 512, 512);
      barkAlbedo.tex.needsUpdate = true;
    }

    if (cachedAssets.barkNormalCanvas && barkNormal.ctx) {
      barkNormal.ctx.drawImage(cachedAssets.barkNormalCanvas, 0, 0);
      barkNormal.tex.needsUpdate = true;
    } else if (barkNormal.ctx) {
      barkNormal.ctx.fillStyle = '#8080ff';
      barkNormal.ctx.fillRect(0, 0, 512, 512);
      barkNormal.tex.needsUpdate = true;
    }

    if (cachedAssets.rockAlbedoCanvas && rockAlbedo.ctx) {
      rockAlbedo.ctx.drawImage(cachedAssets.rockAlbedoCanvas, 0, 0);
      rockAlbedo.tex.needsUpdate = true;
    } else if (rockAlbedo.ctx) {
      rockAlbedo.ctx.fillStyle = '#2d3228';
      rockAlbedo.ctx.fillRect(0, 0, 512, 512);
      rockAlbedo.tex.needsUpdate = true;
    }

    if (cachedAssets.fernAlbedoCanvas && fernAlbedo.ctx) {
      fernAlbedo.ctx.drawImage(cachedAssets.fernAlbedoCanvas, 0, 0);
      fernAlbedo.tex.needsUpdate = true;
    } else if (fernAlbedo.ctx) {
      fernAlbedo.ctx.fillStyle = '#3f5a2a';
      fernAlbedo.ctx.fillRect(0, 0, 512, 512);
      fernAlbedo.tex.needsUpdate = true;
    }

    if (cachedAssets.fernAlphaCanvas && fernAlpha.ctx) {
      fernAlpha.ctx.drawImage(cachedAssets.fernAlphaCanvas, 0, 0);
      fernAlpha.tex.needsUpdate = true;
    } else if (fernAlpha.ctx) {
      fernAlpha.ctx.fillStyle = '#000000';
      fernAlpha.ctx.fillRect(0, 0, 512, 512);
      fernAlpha.tex.needsUpdate = true;
    }

    if (updated) {
      onTextureUpdated?.();
    }
  };

  syncFromCache();
  const onCacheReady = () => syncFromCache();
  listeners.add(onCacheReady);

  return {
    vistaMap: vista.tex,
    dinoAlbedoMap: dinoAlbedo.tex,
    dinoNormalMap: dinoNormal.tex,
    dinoRoughnessMap: dinoRough.tex,
    barkAlbedoMap: barkAlbedo.tex,
    barkNormalMap: barkNormal.tex,
    rockAlbedoMap: rockAlbedo.tex,
    fernAlbedoMap: fernAlbedo.tex,
    fernAlphaMap: fernAlpha.tex,
    dispose: () => {
      listeners.delete(onCacheReady);
      vista.tex.dispose();
      dinoAlbedo.tex.dispose();
      dinoNormal.tex.dispose();
      dinoRough.tex.dispose();
      barkAlbedo.tex.dispose();
      barkNormal.tex.dispose();
      rockAlbedo.tex.dispose();
      fernAlbedo.tex.dispose();
      fernAlpha.tex.dispose();
    },
  };
}
