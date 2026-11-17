import * as THREE from 'three';
import type { HistoryEraId } from '../data/earthData';

export const NASA_DAY_MAP_URL = '/src/assets/images/earth_blue_marble_1794861693563.jpg';
export const NASA_NIGHT_MAP_URL = '/src/assets/images/earth_night_lights_1794861694028.jpg';
export const NASA_CLOUDS_ALPHA_URL = '/src/assets/images/earth_clouds_clean_1794861708192.jpg';

// Simplified recognizable world landmass polygons [lon, lat] for crisp fallback projection
const LANDMASS_POLYGONS: Array<Array<[number, number]>> = [
  [
    [-168, 65], [-160, 71], [-140, 70], [-125, 71], [-110, 74], [-92, 74], [-82, 68],
    [-75, 62], [-64, 60], [-55, 52], [-62, 46], [-70, 42], [-76, 35], [-81, 25],
    [-83, 29], [-90, 29], [-97, 26], [-96, 19], [-88, 21], [-84, 11], [-78, 8],
    [-84, 9], [-92, 14], [-105, 20], [-112, 28], [-117, 32], [-124, 41], [-125, 49],
    [-136, 58], [-152, 60], [-162, 55], [-168, 65],
  ],
  [
    [-55, 60], [-44, 60], [-32, 68], [-18, 76], [-24, 82], [-50, 82], [-68, 77],
    [-56, 70], [-55, 60],
  ],
  [
    [-78, 9], [-72, 12], [-62, 10], [-50, 1], [-35, -6], [-39, -15], [-42, -23],
    [-52, -33], [-62, -41], [-68, -53], [-74, -53], [-75, -43], [-71, -30], [-70, -18],
    [-81, -5], [-78, 4], [-78, 9],
  ],
  [
    [-17, 15], [-13, 28], [-6, 36], [10, 37], [25, 32], [33, 31], [43, 12], [51, 12],
    [45, 2], [40, -10], [35, -24], [28, -33], [18, -35], [14, -22], [12, -6],
    [9, 4], [2, 6], [-8, 5], [-15, 11], [-17, 15],
  ],
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -18], [44, -25]],
  [
    [-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 55], [10, 58], [5, 61],
    [15, 69], [28, 71], [42, 68], [60, 70], [75, 73], [105, 77], [135, 72], [165, 68],
    [178, 66], [162, 59], [156, 51], [142, 54], [135, 44], [129, 35], [122, 40],
    [120, 31], [116, 22], [108, 20], [109, 12], [103, 2], [99, 8], [96, 16],
    [90, 22], [80, 14], [77, 8], [72, 20], [67, 25], [58, 25], [50, 29], [56, 22],
    [44, 13], [35, 29], [36, 36], [27, 37], [24, 38], [18, 40], [13, 45], [8, 44],
    [3, 42], [-5, 36], [-9, 37],
  ],
  [[-6, 50], [2, 51], [-2, 58], [-6, 58], [-6, 50]],
  [[130, 31], [135, 34], [141, 38], [145, 44], [140, 42], [136, 36], [130, 31]],
  [[95, 5], [105, -6], [115, -8], [105, 1], [95, 5]],
  [[109, 2], [118, 5], [117, -3], [111, -3], [109, 2]],
  [[131, -2], [141, -3], [150, -10], [138, -8], [131, -2]],
  [
    [114, -22], [122, -17], [131, -12], [136, -12], [137, -16], [142, -11], [146, -18],
    [153, -27], [150, -37], [141, -38], [135, -34], [129, -32], [115, -34], [113, -26],
    [114, -22],
  ],
  [[167, -46], [174, -41], [178, -37], [173, -36], [171, -43], [167, -46]],
  [
    [-180, -72], [-150, -76], [-120, -73], [-90, -72], [-62, -64], [-45, -75],
    [-10, -70], [30, -69], [70, -68], [110, -66], [150, -68], [175, -74], [180, -72],
    [180, -90], [-180, -90], [-180, -72],
  ],
];

const PANGAEA_POLYGONS: Array<Array<[number, number]>> = [
  [
    [-45, 62], [-15, 70], [20, 68], [55, 58], [75, 42], [65, 22], [45, 10],
    [35, -10], [45, -35], [25, -55], [-5, -62], [-35, -58], [-55, -38], [-50, -12],
    [-62, 12], [-55, 38], [-45, 62],
  ],
  [[-125, 20], [-105, 30], [-95, 15], [-115, 10], [-125, 20]],
];

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * valueNoise(x * freq, y * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

function drawPolygonsToMask(
  polygons: Array<Array<[number, number]>>,
  width: number,
  height: number,
  blurPx = 3
): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.filter = `blur(${blurPx}px)`;
  ctx.fillStyle = '#ffffff';
  for (const poly of polygons) {
    ctx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      const px = ((lon + 180) / 360) * width;
      const py = ((90 - lat) / 180) * height;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  return ctx.getImageData(0, 0, width, height).data;
}

export interface PhotorealisticMaps {
  dayMap: THREE.Texture;
  nightMap: THREE.Texture;
  cloudAlphaMap: THREE.Texture;
  derivedRoughnessMap: THREE.CanvasTexture;
  derivedBumpMap: THREE.CanvasTexture;
}

/**
 * Loads photorealistic NASA Blue Marble day map, Black Marble night city lights,
 * and cyclone cloud alpha map, deriving pixel-exact ocean roughness & mountain bump maps
 * directly from the satellite Blue Marble color channels.
 */
export function loadPhotorealisticEarthMaps(
  maxAnisotropy: number,
  onReady: (maps: PhotorealisticMaps) => void
): () => void {
  let cancelled = false;
  const loader = new THREE.TextureLoader();

  const loadTex = (url: string, isColor: boolean): Promise<THREE.Texture> =>
    new Promise((resolve, reject) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.anisotropy = maxAnisotropy;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

  Promise.all([
    loadTex(NASA_DAY_MAP_URL, true),
    loadTex(NASA_NIGHT_MAP_URL, true),
    loadTex(NASA_CLOUDS_ALPHA_URL, false),
  ])
    .then(([dayMap, nightMap, cloudAlphaMap]) => {
      if (cancelled) {
        dayMap.dispose();
        nightMap.dispose();
        cloudAlphaMap.dispose();
        return;
      }

      // Derive pixel-accurate ocean roughness & land bump relief from Blue Marble image
      const img = dayMap.image as HTMLImageElement | HTMLCanvasElement;
      const w = 1024;
      const h = 512;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(img, 0, 0, w, h);
      const srcData = srcCtx.getImageData(0, 0, w, h).data;

      const roughCanvas = document.createElement('canvas');
      roughCanvas.width = w;
      roughCanvas.height = h;
      const roughCtx = roughCanvas.getContext('2d')!;
      const roughImg = roughCtx.createImageData(w, h);

      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = w;
      bumpCanvas.height = h;
      const bumpCtx = bumpCanvas.getContext('2d')!;
      const bumpImg = bumpCtx.createImageData(w, h);

      for (let i = 0; i < w * h; i++) {
        const idx = i * 4;
        const r = srcData[idx];
        const g = srcData[idx + 1];
        const b = srcData[idx + 2];

        // Detect deep/shallow oceans vs land/ice
        const isOcean = b > r * 1.32 && b > g * 1.12 && r < 95;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        const roughVal = isOcean ? 128 : 232; // Natural orbital ocean sheen vs matte continents
        const bumpVal = isOcean
          ? Math.round(28 + (b / 255) * 35)
          : Math.min(255, Math.round(115 + (lum / 255) * 135));

        roughImg.data[idx] = roughVal;
        roughImg.data[idx + 1] = roughVal;
        roughImg.data[idx + 2] = roughVal;
        roughImg.data[idx + 3] = 255;

        bumpImg.data[idx] = bumpVal;
        bumpImg.data[idx + 1] = bumpVal;
        bumpImg.data[idx + 2] = bumpVal;
        bumpImg.data[idx + 3] = 255;
      }

      roughCtx.putImageData(roughImg, 0, 0);
      bumpCtx.putImageData(bumpImg, 0, 0);

      const derivedRoughnessMap = new THREE.CanvasTexture(roughCanvas);
      derivedRoughnessMap.wrapS = THREE.RepeatWrapping;
      derivedRoughnessMap.wrapT = THREE.ClampToEdgeWrapping;
      derivedRoughnessMap.anisotropy = maxAnisotropy;

      const derivedBumpMap = new THREE.CanvasTexture(bumpCanvas);
      derivedBumpMap.wrapS = THREE.RepeatWrapping;
      derivedBumpMap.wrapT = THREE.ClampToEdgeWrapping;
      derivedBumpMap.anisotropy = maxAnisotropy;

      onReady({
        dayMap,
        nightMap,
        cloudAlphaMap,
        derivedRoughnessMap,
        derivedBumpMap,
      });
    })
    .catch(() => {
      // Keep procedural fallback cleanly if image fails to load
    });

  return () => {
    cancelled = true;
  };
}

export interface EarthTextureBundle {
  modernAlbedo: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudsMap: THREE.CanvasTexture;
  tectonicMap: THREE.CanvasTexture;
  crossSectionMap: THREE.CanvasTexture;
  historyMaps: Record<HistoryEraId, THREE.CanvasTexture>;
  disposeAll: () => void;
}

export function createEarthTextures(maxAnisotropy: number): EarthTextureBundle {
  const W = 1024;
  const H = 512;

  const landMask = drawPolygonsToMask(LANDMASS_POLYGONS, W, H, 4);
  const pangaeaMask = drawPolygonsToMask(PANGAEA_POLYGONS, W, H, 5);

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = W;
  albedoCanvas.height = H;
  const albedoCtx = albedoCanvas.getContext('2d')!;
  const albedoImg = albedoCtx.createImageData(W, H);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = W;
  roughCanvas.height = H;
  const roughCtx = roughCanvas.getContext('2d')!;
  const roughImg = roughCtx.createImageData(W, H);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = W;
  bumpCanvas.height = H;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    const absLat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const lon = (x / W) * 360 - 180;
      const maskVal = landMask[idx] / 255;
      const n1 = fbm(x * 0.025, y * 0.025, 4);
      const n2 = fbm(x * 0.08 + 19, y * 0.08 + 7, 3);
      const elevation = maskVal + (n1 - 0.5) * 0.28 + (n2 - 0.5) * 0.1;

      const isPolarIce = absLat > 77 + (n1 - 0.5) * 8;
      let r = 10;
      let g = 38;
      let b = 88;
      let rough = 138;
      let bump = 30;

      if (isPolarIce) {
        r = 220 + Math.round(n2 * 24);
        g = 232 + Math.round(n2 * 18);
        b = 244;
        rough = 205;
        bump = 135;
      } else if (elevation > 0.52) {
        const ridge = n1 * 0.62 + n2 * 0.38;
        rough = 224;
        bump = 110 + Math.round(ridge * 140);

        const aridBand = Math.exp(-Math.pow((absLat - 24) / 12, 2));
        const saharaBoost = lon > -15 && lon < 62 && lat > 12 && lat < 36 ? 0.45 : 0;
        const australiaBoost = lon > 115 && lon < 146 && lat < -18 && lat > -32 ? 0.45 : 0;
        const desertness = Math.min(1, aridBand * n1 * 1.35 + saharaBoost + australiaBoost);

        if (ridge > 0.77 || absLat > 66) {
          r = 168 + Math.round(ridge * 52);
          g = 176 + Math.round(ridge * 48);
          b = 184 + Math.round(ridge * 46);
        } else if (desertness > 0.56) {
          r = 172 + Math.round(n2 * 34);
          g = 140 + Math.round(n2 * 26);
          b = 92 + Math.round(n2 * 18);
        } else {
          const tropic = Math.exp(-Math.pow(absLat / 20, 2));
          r = Math.round(28 + (1 - tropic) * 34 + n2 * 18);
          g = Math.round(86 + tropic * 28 + n1 * 26);
          b = Math.round(38 + (1 - tropic) * 18 + n2 * 14);
        }
      } else {
        const shelf = Math.max(0, Math.min(1, (elevation - 0.28) / 0.24));
        r = Math.round(8 + shelf * 16);
        g = Math.round(34 + shelf * 64);
        b = Math.round(84 + shelf * 82);
        bump = Math.round(25 + shelf * 45);
      }

      albedoImg.data[idx] = r;
      albedoImg.data[idx + 1] = g;
      albedoImg.data[idx + 2] = b;
      albedoImg.data[idx + 3] = 255;

      roughImg.data[idx] = rough;
      roughImg.data[idx + 1] = rough;
      roughImg.data[idx + 2] = rough;
      roughImg.data[idx + 3] = 255;

      bumpImg.data[idx] = bump;
      bumpImg.data[idx + 1] = bump;
      bumpImg.data[idx + 2] = bump;
      bumpImg.data[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const modernAlbedo = new THREE.CanvasTexture(albedoCanvas);
  modernAlbedo.colorSpace = THREE.SRGBColorSpace;
  modernAlbedo.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;

  // Fallback procedural clouds
  const cloudsCanvas = document.createElement('canvas');
  cloudsCanvas.width = W;
  cloudsCanvas.height = H;
  const cloudsCtx = cloudsCanvas.getContext('2d')!;
  const cloudsImg = cloudsCtx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    const itcz = Math.exp(-Math.pow(lat / 10, 2)) * 0.14;
    const midLat = Math.exp(-Math.pow((Math.abs(lat) - 48) / 14, 2)) * 0.16;
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const swirl = fbm(x * 0.014 + Math.sin(y * 0.04) * 1.4, y * 0.022, 4);
      const density = Math.max(0, Math.min(1, (swirl + itcz + midLat - 0.52) * 2.4));
      cloudsImg.data[idx] = 248;
      cloudsImg.data[idx + 1] = 251;
      cloudsImg.data[idx + 2] = 255;
      cloudsImg.data[idx + 3] = Math.round(density * 200);
    }
  }
  cloudsCtx.putImageData(cloudsImg, 0, 0);
  const cloudsMap = new THREE.CanvasTexture(cloudsCanvas);
  cloudsMap.colorSpace = THREE.SRGBColorSpace;
  cloudsMap.anisotropy = maxAnisotropy;

  // Tectonic plate boundaries overlay
  const tecCanvas = document.createElement('canvas');
  tecCanvas.width = W;
  tecCanvas.height = H;
  const tecCtx = tecCanvas.getContext('2d')!;
  tecCtx.clearRect(0, 0, W, H);
  const plateBoundaries: Array<{ color: string; pts: Array<[number, number]> }> = [
    {
      color: '#38bdf8',
      pts: [
        [-21, 66], [-28, 52], [-34, 38], [-44, 22], [-40, 8], [-15, 0],
        [-13, -15], [-14, -35], [-10, -52],
      ],
    },
    {
      color: '#f97316',
      pts: [
        [172, -45], [178, -22], [155, -8], [130, 5], [122, 18], [138, 34], [148, 45],
        [162, 55], [-170, 52], [-150, 60], [-132, 54], [-125, 42], [-115, 28],
        [-105, 18], [-88, 12], [-78, 2], [-73, -18], [-72, -38], [-75, -52],
      ],
    },
    {
      color: '#f59e0b',
      pts: [
        [-10, 36], [5, 38], [18, 40], [32, 37], [46, 36], [58, 34], [74, 34],
        [88, 28], [98, 20], [102, 4], [116, -8],
      ],
    },
    {
      color: '#fbbf24',
      pts: [[42, 12], [38, 4], [35, -5], [34, -15], [36, -24]],
    },
  ];

  tecCtx.lineCap = 'round';
  tecCtx.lineJoin = 'round';
  for (const b of plateBoundaries) {
    tecCtx.strokeStyle = b.color;
    tecCtx.shadowColor = b.color;
    tecCtx.shadowBlur = 10;
    tecCtx.lineWidth = 3.2;
    tecCtx.beginPath();
    b.pts.forEach(([lon, lat], i) => {
      const px = ((lon + 180) / 360) * W;
      const py = ((90 - lat) / 180) * H;
      if (i === 0) tecCtx.moveTo(px, py);
      else tecCtx.lineTo(px, py);
    });
    tecCtx.stroke();
  }
  const tectonicMap = new THREE.CanvasTexture(tecCanvas);
  tectonicMap.colorSpace = THREE.SRGBColorSpace;
  tectonicMap.anisotropy = maxAnisotropy;

  // Interior Cross-Section Slice Texture
  const sliceSize = 512;
  const sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = sliceSize;
  sliceCanvas.height = sliceSize;
  const sliceCtx = sliceCanvas.getContext('2d')!;
  const sliceImg = sliceCtx.createImageData(sliceSize, sliceSize);
  const half = sliceSize / 2;

  for (let y = 0; y < sliceSize; y++) {
    for (let x = 0; x < sliceSize; x++) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const rNorm = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const grain = fbm(x * 0.06, y * 0.06, 3);
      const plume = fbm(Math.cos(angle) * 4 + rNorm * 6, Math.sin(angle) * 4 + rNorm * 6, 3);
      const idx = (y * sliceSize + x) * 4;

      let r = 20;
      let g = 25;
      let b = 38;

      if (rNorm <= 0.22) {
        const c = 1 - rNorm / 0.22;
        r = 255;
        g = Math.round(215 + c * 38);
        b = Math.round(135 + c * 95);
      } else if (rNorm <= 0.54) {
        const t = (rNorm - 0.22) / 0.32;
        const streak = 0.8 + plume * 0.35;
        r = Math.min(255, Math.round((255 - t * 32) * streak));
        g = Math.min(255, Math.round((152 - t * 72) * streak));
        b = Math.round(24 * streak);
      } else if (rNorm <= 0.82) {
        const t = (rNorm - 0.54) / 0.28;
        const heat = 0.82 + grain * 0.32;
        r = Math.min(255, Math.round((196 - t * 28) * heat));
        g = Math.min(255, Math.round((46 + (1 - t) * 24) * heat));
        b = Math.round(20 * heat);
      } else if (rNorm <= 0.965) {
        const heat = 0.85 + grain * 0.28;
        r = Math.min(255, Math.round(225 * heat));
        g = Math.min(255, Math.round(108 * heat));
        b = Math.round(28 * heat);
      } else {
        r = 72;
        g = 115;
        b = 165;
      }

      const ringDist = Math.min(
        Math.abs(rNorm - 0.22),
        Math.abs(rNorm - 0.54),
        Math.abs(rNorm - 0.82),
        Math.abs(rNorm - 0.965)
      );
      if (ringDist < 0.006) {
        r = Math.min(255, r + 40);
        g = Math.min(255, g + 35);
        b = Math.min(255, b + 25);
      }

      sliceImg.data[idx] = r;
      sliceImg.data[idx + 1] = g;
      sliceImg.data[idx + 2] = b;
      sliceImg.data[idx + 3] = 255;
    }
  }
  sliceCtx.putImageData(sliceImg, 0, 0);
  const crossSectionMap = new THREE.CanvasTexture(sliceCanvas);
  crossSectionMap.colorSpace = THREE.SRGBColorSpace;
  crossSectionMap.anisotropy = maxAnisotropy;

  const buildEraTexture = (era: HistoryEraId): THREE.CanvasTexture => {
    if (era === 'cenozoic') return modernAlbedo;

    const ew = 512;
    const eh = 256;
    const c = document.createElement('canvas');
    c.width = ew;
    c.height = eh;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(ew, eh);

    for (let y = 0; y < eh; y++) {
      const lat = 90 - (y / eh) * 180;
      const absLat = Math.abs(lat);
      for (let x = 0; x < ew; x++) {
        const idx = (y * ew + x) * 4;
        const sx = Math.floor((x / ew) * W);
        const sy = Math.floor((y / eh) * H);
        const maskIdx = (sy * W + sx) * 4;
        const n1 = fbm(x * 0.045, y * 0.045, 4);
        const n2 = fbm(x * 0.12 + 31, y * 0.12 + 11, 3);

        let r = 0;
        let g = 0;
        let b = 0;

        if (era === 'hadean') {
          const crack = Math.pow(Math.max(0, 1 - Math.abs(n1 - 0.5) * 6.5), 1.8);
          const hot = Math.max(crack, n2 > 0.68 ? (n2 - 0.68) * 3 : 0);
          r = Math.min(255, Math.round(38 + hot * 217));
          g = Math.min(255, Math.round(14 + hot * 125));
          b = Math.min(255, Math.round(12 + hot * 22));
        } else if (era === 'archean') {
          const island = n1 * 0.7 + n2 * 0.3;
          if (island > 0.63) {
            r = Math.round(62 + n2 * 35);
            g = Math.round(52 + n2 * 25);
            b = Math.round(42 + n2 * 18);
          } else {
            r = Math.round(24 + n1 * 28);
            g = Math.round(68 + n1 * 38);
            b = Math.round(48 + n1 * 22);
          }
        } else if (era === 'proterozoic') {
          const eqSlush = Math.exp(-Math.pow(absLat / 7, 2)) * (n2 > 0.66 ? 1 : 0);
          if (eqSlush > 0.4) {
            r = 55;
            g = 115;
            b = 158;
          } else {
            r = Math.round(210 + n1 * 42);
            g = Math.round(228 + n1 * 25);
            b = Math.round(245 + n1 * 10);
          }
        } else if (era === 'paleozoic') {
          const pMask = pangaeaMask[maskIdx] / 255 + (n1 - 0.5) * 0.25;
          if (pMask > 0.52) {
            const inland = Math.min(1, (pMask - 0.52) * 2.2);
            r = Math.round(52 + inland * 88);
            g = Math.round(108 + (1 - inland) * 28);
            b = Math.round(44 + inland * 24);
          } else {
            r = 12;
            g = 48 + Math.round(n1 * 24);
            b = 104 + Math.round(n1 * 28);
          }
        } else if (era === 'mesozoic') {
          const modernLand = landMask[maskIdx] / 255;
          const elevation = modernLand + (n1 - 0.5) * 0.24;
          if (elevation > 0.56) {
            r = Math.round(40 + n2 * 38);
            g = Math.round(112 + n1 * 34);
            b = Math.round(46 + n2 * 18);
          } else {
            const shelf = Math.max(0, Math.min(1, (elevation - 0.35) / 0.21));
            r = Math.round(12 + shelf * 24);
            g = Math.round(58 + shelf * 68);
            b = Math.round(115 + shelf * 70);
          }
        }

        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  };

  const historyMaps: Record<HistoryEraId, THREE.CanvasTexture> = {
    hadean: buildEraTexture('hadean'),
    archean: buildEraTexture('archean'),
    proterozoic: buildEraTexture('proterozoic'),
    paleozoic: buildEraTexture('paleozoic'),
    mesozoic: buildEraTexture('mesozoic'),
    cenozoic: modernAlbedo,
  };

  return {
    modernAlbedo,
    roughnessMap,
    bumpMap,
    cloudsMap,
    tectonicMap,
    crossSectionMap,
    historyMaps,
    disposeAll: () => {
      modernAlbedo.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
      cloudsMap.dispose();
      tectonicMap.dispose();
      crossSectionMap.dispose();
      Object.values(historyMaps).forEach((t) => t.dispose());
    },
  };
}
