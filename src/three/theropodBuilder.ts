import * as THREE from 'three';
import type { ExtinctSpecimen } from '../data/extinctCatalog';
import type { CgiTexturePack } from './cgiTextures';

export interface BuiltTheropodRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  jawPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftShinPivot: THREE.Group;
  rightShinPivot: THREE.Group;
  leftFootPivot: THREE.Group;
  rightFootPivot: THREE.Group;
  armPivots: THREE.Group[];
  tailSegments: THREE.Group[];
  salivaStrands: THREE.Mesh[];
  shadowDisc: THREE.Mesh;
  baseY: number;
  heavySteps: boolean;
  disposables: Array<{ dispose: () => void }>;
}

/**
 * Generates a realistic amber-gold predator eye texture with a sharp vertical slit pupil.
 */
function createReptileEyeTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    const irisGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 122);
    irisGrad.addColorStop(0, '#fde047');
    irisGrad.addColorStop(0.42, '#d97706');
    irisGrad.addColorStop(0.82, '#78350f');
    irisGrad.addColorStop(1, '#140c06');
    ctx.fillStyle = irisGrad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.38)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24);
      ctx.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
      ctx.stroke();
    }

    ctx.fillStyle = '#050505';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 14, 78, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(cx - 22, cy - 26, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface LoftOptions {
  curve: THREE.CatmullRomCurve3;
  tubularSegments: number;
  radialSegments: number;
  radiusX: (t: number) => number;
  radiusY: (t: number) => number;
  deform?: (t: number, theta: number, rx: number, ry: number) => { x: number; y: number };
  vertexColor?: (t: number, theta: number) => [number, number, number];
  capStart?: boolean;
  capEnd?: boolean;
}

function createLoftedOrganGeometry(opts: LoftOptions): THREE.BufferGeometry {
  const {
    curve,
    tubularSegments,
    radialSegments,
    radiusX,
    radiusY,
    deform,
    vertexColor,
    capStart = true,
    capEnd = true,
  } = opts;

  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const prevTangent = frames.tangents[0].clone().normalize();
  const refAxis = Math.abs(prevTangent.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  const right = new THREE.Vector3().crossVectors(refAxis, prevTangent);
  if (right.lengthSq() < 1e-6) {
    right.set(1, 0, 0);
  } else {
    right.normalize();
  }
  const rotQuat = new THREE.Quaternion();
  const up = new THREE.Vector3();

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const ringStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const center = curve.getPointAt(t);
    const tangent = frames.tangents[i].clone().normalize();

    if (i > 0) {
      rotQuat.setFromUnitVectors(prevTangent, tangent);
      right.applyQuaternion(rotQuat);
      right.addScaledVector(tangent, -right.dot(tangent));
      if (right.lengthSq() < 1e-6) {
        right.set(1, 0, 0);
      } else {
        right.normalize();
      }
      prevTangent.copy(tangent);
    }
    up.crossVectors(tangent, right).normalize();

    const rx = Math.max(0.003, radiusX(t));
    const ry = Math.max(0.003, radiusY(t));

    for (let j = 0; j <= radialSegments; j++) {
      const u = j / radialSegments;
      const theta = u * Math.PI * 2;

      let localX = Math.cos(theta) * rx;
      let localY = Math.sin(theta) * ry;
      if (deform) {
        const d = deform(t, theta, rx, ry);
        localX = d.x;
        localY = d.y;
      }

      const px = center.x + right.x * localX + up.x * localY;
      const py = center.y + right.y * localX + up.y * localY;
      const pz = center.z + right.z * localX + up.z * localY;

      positions.push(px, py, pz);
      uvs.push(u, t);

      if (vertexColor) {
        const [cr, cg, cb] = vertexColor(t, theta);
        colors.push(cr, cg, cb);
      } else {
        colors.push(1, 1, 1);
      }
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capStart) {
    const startPt = curve.getPointAt(0);
    const startCapIdx = positions.length / 3;
    positions.push(startPt.x, startPt.y, startPt.z);
    uvs.push(0.5, 0);
    const [cr, cg, cb] = vertexColor ? vertexColor(0, Math.PI * 0.5) : [1, 1, 1];
    colors.push(cr, cg, cb);
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startCapIdx, j + 1, j);
    }
  }

  if (capEnd) {
    const endPt = curve.getPointAt(1);
    const endCapIdx = positions.length / 3;
    positions.push(endPt.x, endPt.y, endPt.z);
    uvs.push(0.5, 1);
    const [cr, cg, cb] = vertexColor ? vertexColor(1, Math.PI * 0.5) : [1, 1, 1];
    colors.push(cr, cg, cb);
    const lastRingStart = tubularSegments * ringStride;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(endCapIdx, lastRingStart + j, lastRingStart + j + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createCurvedClawGeometry(length: number, baseRadius: number, curveDrop: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -curveDrop * 0.25, length * 0.45),
    new THREE.Vector3(0, -curveDrop, length),
  ]);
  return createLoftedOrganGeometry({
    curve,
    tubularSegments: 8,
    radialSegments: 8,
    radiusX: (t) => baseRadius * Math.pow(1 - t * 0.94, 0.85),
    radiusY: (t) => baseRadius * 1.2 * Math.pow(1 - t * 0.94, 0.85),
    capStart: true,
    capEnd: true,
  });
}

/**
 * High-Definition CGI bipedal theropod (`Tyrannosaurus rex` / `Velociraptor`)
 * using photorealistic PBR reptile scale albedo + Sobel normal + roughness maps,
 * seamless tucked hip/neck anatomy, wet clearcoat mouth & eyes, and 3-toed talons.
 */
export function buildSculptedTheropodRig(
  specimen: ExtinctSpecimen,
  options: {
    maxAnisotropy: number;
    castShadow: boolean;
    shadowDisc: THREE.Mesh;
    textures: CgiTexturePack;
  }
): BuiltTheropodRig {
  const isRaptor = specimen.archetype === 'raptor';
  const disposables: Array<{ dispose: () => void }> = [];

  const root = new THREE.Group();
  const rootScale = isRaptor ? 0.82 : 1.02 * specimen.scale;
  root.scale.setScalar(rootScale);
  root.add(options.shadowDisc);

  const eyeTex = createReptileEyeTexture();
  eyeTex.anisotropy = options.maxAnisotropy;
  disposables.push(eyeTex);

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: isRaptor ? new THREE.Color('#b49d88') : new THREE.Color('#cbc6be'),
    map: options.textures.dinoAlbedoMap,
    normalMap: options.textures.dinoNormalMap,
    normalScale: new THREE.Vector2(1.85, 1.85),
    roughnessMap: options.textures.dinoRoughnessMap,
    vertexColors: true,
    roughness: 0.68,
    metalness: 0.03,
    clearcoat: 0.42,
    clearcoatRoughness: 0.34,
  });
  const toothMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6dcc8,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  });
  const clawMat = new THREE.MeshStandardMaterial({
    color: 0x161210,
    roughness: 0.26,
    metalness: 0.14,
  });
  const mouthMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c191d,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
  });
  const throatMat = new THREE.MeshStandardMaterial({
    color: 0x26080a,
    roughness: 0.4,
  });
  const salivaMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1f6f9,
    roughness: 0.04,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const nostrilMat = new THREE.MeshStandardMaterial({
    color: 0x141110,
    roughness: 0.85,
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: eyeTex,
    emissive: new THREE.Color(0x7a4106),
    emissiveIntensity: 0.34,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
  });
  disposables.push(
    skinMat,
    toothMat,
    clawMat,
    mouthMat,
    throatMat,
    salivaMat,
    nostrilMat,
    eyeMat
  );

  // Natural dark-gray & rich earth-brown predator mottling + underbelly countershading
  const countershade = (
    t: number,
    theta: number,
    bellyWarmth = 1,
    mudSplatter = 0
  ): [number, number, number] => {
    const sinY = Math.sin(theta);
    const bellyFactor = THREE.MathUtils.smoothstep(-sinY, -0.05, 0.82) * bellyWarmth;
    const stripeMask = isRaptor
      ? sinY > -0.15
        ? 0.68 + 0.28 * Math.cos(t * Math.PI * 11 + Math.cos(theta) * 1.4)
        : 0.94
      : 1.0;
    const dorsalSlate = isRaptor ? THREE.MathUtils.smoothstep(sinY, 0.15, 0.95) * 0.22 : 0;
    let r = THREE.MathUtils.lerp(0.84 - dorsalSlate * 0.4, 1.26, bellyFactor) * stripeMask;
    let g = THREE.MathUtils.lerp(0.79 - dorsalSlate * 0.35, 1.18, bellyFactor) * stripeMask;
    let b = THREE.MathUtils.lerp(0.74 - dorsalSlate * 0.25, 1.02, bellyFactor) * stripeMask;
    if (mudSplatter > 0) {
      r = THREE.MathUtils.lerp(r, 0.42, mudSplatter);
      g = THREE.MathUtils.lerp(g, 0.34, mudSplatter);
      b = THREE.MathUtils.lerp(b, 0.24, mudSplatter);
    }
    return [r, g, b];
  };

  const hipY = isRaptor ? 1.72 : 1.88;
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, hipY, 0);
  root.add(bodyPivot);

  // 1. ORGANIC MUSCULAR TORSO (tapered seamlessly at collar and pelvis — zero flat caps!)
  const torsoCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.02, -0.84),
    new THREE.Vector3(0, -0.04, -0.25),
    new THREE.Vector3(0, 0.05, 0.34),
    new THREE.Vector3(0, 0.15, 0.78),
    new THREE.Vector3(0, 0.25, 0.96),
  ]);
  const torsoWidthScale = isRaptor ? 0.72 : 0.94;
  const torsoGeo = createLoftedOrganGeometry({
    curve: torsoCurve,
    tubularSegments: 28,
    radialSegments: 24,
    radiusX: (t) => {
      const endRound = Math.pow(Math.sin(THREE.MathUtils.clamp(t, 0.02, 0.98) * Math.PI), 0.42);
      const shape = 0.24 + Math.sin(t * Math.PI) * 0.21 + Math.exp(-Math.pow((t - 0.65) / 0.24, 2)) * 0.11;
      return shape * endRound * torsoWidthScale;
    },
    radiusY: (t) => {
      const endRound = Math.pow(Math.sin(THREE.MathUtils.clamp(t, 0.02, 0.98) * Math.PI), 0.4);
      const shape = 0.29 + Math.sin(t * Math.PI) * 0.26 + Math.exp(-Math.pow((t - 0.62) / 0.26, 2)) * 0.14;
      return shape * endRound;
    },
    deform: (t, theta, rx, ry) => {
      const topRidge = Math.pow(Math.max(0, Math.sin(theta)), 6) * 0.048 * (1 - t * 0.4);
      return {
        x: Math.cos(theta) * rx,
        y: Math.sin(theta) * ry + topRidge,
      };
    },
    vertexColor: (t, theta) => countershade(t, theta, 1.0),
    capStart: false,
    capEnd: false,
  });
  disposables.push(torsoGeo);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  torsoMesh.castShadow = options.castShadow;
  torsoMesh.receiveShadow = options.castShadow;
  bodyPivot.add(torsoMesh);

  // 2. ARTICULATED 3-SEGMENT TAPERING WHIP TAIL (base buried inside pelvis; no open start cap!)
  const tailSegments: THREE.Group[] = [];
  let tailParent: THREE.Group = bodyPivot;
  const tailSpecs = [
    { len: 1.18, r0: 0.25, r1: 0.16, offsetZ: -0.44, arcY: 0.05 },
    { len: 1.1, r0: 0.16, r1: 0.09, offsetZ: -1.12, arcY: 0.08 },
    { len: 1.05, r0: 0.09, r1: 0.012, offsetZ: -1.04, arcY: 0.18 },
  ];
  for (let sIdx = 0; sIdx < tailSpecs.length; sIdx++) {
    const spec = tailSpecs[sIdx];
    const segPivot = new THREE.Group();
    segPivot.position.set(0, sIdx === 0 ? -0.02 : 0.03, spec.offsetZ);
    const segCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, spec.arcY * 0.5, -spec.len * 0.5),
      new THREE.Vector3(0, spec.arcY, -spec.len),
    ]);
    const segGeo = createLoftedOrganGeometry({
      curve: segCurve,
      tubularSegments: 14,
      radialSegments: 16,
      radiusX: (t) => THREE.MathUtils.lerp(spec.r0 * 0.85, spec.r1 * 0.85, t) * torsoWidthScale,
      radiusY: (t) => THREE.MathUtils.lerp(spec.r0, spec.r1, t),
      vertexColor: (t, theta) => countershade(t, theta, 0.78),
      capStart: false,
      capEnd: sIdx === tailSpecs.length - 1,
    });
    disposables.push(segGeo);
    const segMesh = new THREE.Mesh(segGeo, skinMat);
    segMesh.castShadow = options.castShadow;
    segPivot.add(segMesh);
    tailParent.add(segPivot);
    tailSegments.push(segPivot);
    tailParent = segPivot;
  }

  // 3. BENT MUSCULAR PREDATOR ARMS (shoulders rooted inside ribcage — zero cap seams!)
  const clawGeo = createCurvedClawGeometry(isRaptor ? 0.2 : 0.14, isRaptor ? 0.024 : 0.019, isRaptor ? 0.08 : 0.05);
  disposables.push(clawGeo);

  const armPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.11 * torsoWidthScale, -0.02, 0.56);

    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.16, -0.09, 0.03),
      new THREE.Vector3(side * 0.21, -0.31, 0.02),
      new THREE.Vector3(side * 0.17, -0.47, 0.28),
      new THREE.Vector3(side * 0.13, -0.53, 0.42),
    ]);
    const armScale = isRaptor ? 1.2 : 0.82;
    const armGeo = createLoftedOrganGeometry({
      curve: armCurve,
      tubularSegments: 18,
      radialSegments: 14,
      radiusX: (t) => (0.072 * (1 - t * 0.56) + Math.sin(t * Math.PI) * 0.016) * armScale,
      radiusY: (t) => (0.082 * (1 - t * 0.56) + Math.sin(t * Math.PI) * 0.02) * armScale,
      vertexColor: (t, theta) => countershade(t, theta, 0.85),
      capStart: false,
      capEnd: true,
    });
    disposables.push(armGeo);
    const armMesh = new THREE.Mesh(armGeo, skinMat);
    armMesh.castShadow = options.castShadow;
    armPivot.add(armMesh);

    for (let f = 0; f < 3; f++) {
      const fOffset = (f - 1) * 0.042;
      const claw = new THREE.Mesh(clawGeo, clawMat);
      claw.position.set(side * 0.13 + fOffset, -0.53, 0.42);
      claw.rotation.x = 0.72;
      claw.rotation.z = side * -0.15;
      armPivot.add(claw);
    }

    bodyPivot.add(armPivot);
    armPivots.push(armPivot);
  }

  // 4. SEAMLESS S-CURVED NECK & FIERCE SCULPTED THEROPOD SKULL
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.12, 0.66);
  bodyPivot.add(headPivot);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.16, -0.26),
    new THREE.Vector3(0, 0.16, -0.02),
    new THREE.Vector3(0, 0.52, 0.14),
    new THREE.Vector3(0, 0.7, 0.28),
  ]);
  const neckGeo = createLoftedOrganGeometry({
    curve: neckCurve,
    tubularSegments: 22,
    radialSegments: 18,
    radiusX: (t) => (0.29 - t * 0.1 + Math.sin(t * Math.PI) * 0.03) * (isRaptor ? 0.78 : 0.94),
    radiusY: (t) => 0.34 - t * 0.11 + Math.sin(t * Math.PI) * 0.03,
    vertexColor: (t, theta) => countershade(t, theta, 1.0),
    capStart: false,
    capEnd: false,
  });
  disposables.push(neckGeo);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.castShadow = options.castShadow;
  headPivot.add(neckMesh);

  const skullGroup = new THREE.Group();
  skullGroup.position.set(0, 0.7, 0.28);
  headPivot.add(skullGroup);

  const snoutLen = isRaptor ? 1.08 : 1.02;
  const skullWidth = isRaptor ? 0.82 : 0.96;
  const upperSkullCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, -0.22),
    new THREE.Vector3(0, 0.09, 0.16),
    new THREE.Vector3(0, 0.06, snoutLen * 0.58),
    new THREE.Vector3(0, -0.015, snoutLen),
  ]);
  const upperSkullGeo = createLoftedOrganGeometry({
    curve: upperSkullCurve,
    tubularSegments: 24,
    radialSegments: 22,
    radiusX: (t) => {
      const cheek = Math.exp(-Math.pow((t - 0.26) / 0.18, 2)) * 0.09;
      const tipRound = t > 0.84 ? Math.max(0.14, Math.cos(((t - 0.84) / 0.16) * Math.PI * 0.46)) : 1.0;
      const backRound = t < 0.12 ? 0.62 + (t / 0.12) * 0.38 : 1.0;
      return (0.22 * (1 - t * 0.64) + cheek) * tipRound * backRound * skullWidth;
    },
    radiusY: (t) => {
      const tipRound = t > 0.84 ? Math.max(0.18, Math.cos(((t - 0.84) / 0.16) * Math.PI * 0.46)) : 1.0;
      const backRound = t < 0.12 ? 0.68 + (t / 0.12) * 0.32 : 1.0;
      return 0.25 * (1 - t * 0.48) * tipRound * backRound;
    },
    deform: (t, theta, rx, ry) => {
      const s = Math.sin(theta);
      const y = s < 0 ? s * ry * 0.32 : s * ry * (1.12 - t * 0.08);
      const ridgeNarrow = s > 0.45 ? 0.86 : 1.0;
      return { x: Math.cos(theta) * rx * ridgeNarrow, y };
    },
    vertexColor: (t, theta) => countershade(t, theta, 0.72),
    capStart: false,
    capEnd: true,
  });
  disposables.push(upperSkullGeo);
  const upperSkullMesh = new THREE.Mesh(upperSkullGeo, skinMat);
  upperSkullMesh.castShadow = options.castShadow;
  skullGroup.add(upperSkullMesh);

  // Hooded Supraorbital Brow Ridges, Nostrils & Deep-Set Amber Slit-Pupil Eyes
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.01, -0.14),
    new THREE.Vector3(0, 0.05, 0.02),
    new THREE.Vector3(0, 0.0, 0.16),
  ]);
  const browGeo = createLoftedOrganGeometry({
    curve: browCurve,
    tubularSegments: 10,
    radialSegments: 10,
    radiusX: (t) => 0.036 * Math.sin(THREE.MathUtils.clamp(t, 0.06, 0.94) * Math.PI),
    radiusY: (t) => 0.024 * Math.sin(THREE.MathUtils.clamp(t, 0.06, 0.94) * Math.PI),
    vertexColor: () => [0.72, 0.61, 0.46],
  });
  const eyeGeo = new THREE.SphereGeometry(0.052, 16, 14);
  const nostrilGeo = new THREE.SphereGeometry(0.016, 8, 8);
  disposables.push(browGeo, eyeGeo, nostrilGeo);

  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(browGeo, skinMat);
    brow.position.set(side * 0.132 * skullWidth, 0.142, 0.21);
    brow.rotation.z = side * -0.44;
    brow.rotation.y = side * 0.12;
    skullGroup.add(brow);

    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.165 * skullWidth, 0.105, 0.215);
    eye.scale.set(0.7, 0.96, 0.96);
    // Lock eyes slightly forward toward the viewer during direct charge
    eye.rotation.y = side * (Math.PI * 0.31);
    skullGroup.add(eye);

    const nostril = new THREE.Mesh(nostrilGeo, nostrilMat);
    nostril.scale.set(0.6, 0.8, 1.5);
    nostril.position.set(side * 0.068 * skullWidth, 0.04, snoutLen * 0.88);
    skullGroup.add(nostril);
  }

  // Wet Recessed Upper Mouth Roof + Fine Curved Upper Fang Rows + Stretching Saliva Strands
  const upperPalateCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.008, 0.22),
    new THREE.Vector3(0, -0.014, snoutLen * 0.76),
  ]);
  const upperPalateGeo = createLoftedOrganGeometry({
    curve: upperPalateCurve,
    tubularSegments: 10,
    radialSegments: 10,
    radiusX: (t) => 0.108 * (1 - t * 0.64) * skullWidth,
    radiusY: () => 0.018,
    capStart: false,
    capEnd: true,
  });
  const fangGeo = createCurvedClawGeometry(0.065, 0.011, 0.016);
  const salivaGeo = new THREE.CylinderGeometry(0.0045, 0.0028, 1.0, 6);
  salivaGeo.translate(0, -0.5, 0);
  disposables.push(upperPalateGeo, fangGeo, salivaGeo);

  const upperPalate = new THREE.Mesh(upperPalateGeo, mouthMat);
  skullGroup.add(upperPalate);

  // Dark deep inner throat shadow tucked strictly inside skull cheeks (never protruding!)
  const throatGeo = new THREE.SphereGeometry(0.052 * skullWidth, 10, 10);
  throatGeo.scale(0.85, 0.72, 2.2);
  disposables.push(throatGeo);
  const throatMesh = new THREE.Mesh(throatGeo, throatMat);
  throatMesh.position.set(0, -0.008, 0.25);
  skullGroup.add(throatMesh);

  // Subtle dark raptor head-crest quills for fierce movie silhouette
  if (isRaptor) {
    const quillGeo = createCurvedClawGeometry(0.24, 0.014, 0.035);
    const quillMat = new THREE.MeshStandardMaterial({ color: 0x221d1a, roughness: 0.78 });
    disposables.push(quillGeo, quillMat);
    for (let q = 0; q < 7; q++) {
      const quill = new THREE.Mesh(quillGeo, quillMat);
      quill.position.set(((q % 2) - 0.5) * 0.045, 0.17 - q * 0.016, 0.05 - q * 0.068);
      quill.rotation.x = -Math.PI * 0.82 - q * 0.05;
      quill.rotation.z = ((q % 2) - 0.5) * 0.25;
      quill.scale.setScalar(1.05 - q * 0.08);
      skullGroup.add(quill);
    }
  }

  const salivaStrands: THREE.Mesh[] = [];
  const strandConfigs = [
    { x: -0.088 * skullWidth, y: -0.025, z: 0.42 },
    { x: 0.088 * skullWidth, y: -0.025, z: 0.44 },
    { x: -0.062 * skullWidth, y: -0.032, z: 0.66 },
    { x: 0.058 * skullWidth, y: -0.032, z: 0.68 },
  ];
  for (const sc of strandConfigs) {
    const strand = new THREE.Mesh(salivaGeo, salivaMat);
    strand.position.set(sc.x, sc.y, sc.z);
    strand.userData.spanZ = sc.z - 0.1;
    skullGroup.add(strand);
    salivaStrands.push(strand);
  }

  const numUpperTeeth = 10;
  for (let i = 0; i < numUpperTeeth; i++) {
    const frac = i / (numUpperTeeth - 1);
    const tz = 0.24 + frac * (snoutLen - 0.34);
    const tx = 0.145 * (1 - frac * 0.62) * skullWidth;
    const altScale = i % 2 === 0 ? 1.06 : 0.84;
    const fangScale = (0.68 + Math.sin(frac * Math.PI) * 0.45) * altScale;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(fangGeo, toothMat);
      tooth.position.set(side * tx, -0.025, tz);
      tooth.rotation.x = Math.PI * (0.54 + (i % 3) * 0.02);
      tooth.rotation.z = side * 0.06;
      tooth.scale.setScalar(fangScale);
      skullGroup.add(tooth);
    }
  }

  // 5. HINGED TAPERED LOWER JAW + WET TONGUE + LOWER FANGS
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.04, 0.1);
  skullGroup.add(jawPivot);

  const lowerJawCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.0, -0.04),
    new THREE.Vector3(0, -0.02, snoutLen * 0.44),
    new THREE.Vector3(0, 0.0, snoutLen * 0.84),
  ]);
  const lowerJawGeo = createLoftedOrganGeometry({
    curve: lowerJawCurve,
    tubularSegments: 18,
    radialSegments: 16,
    radiusX: (t) => {
      const tipRound = t > 0.84 ? Math.max(0.18, Math.cos(((t - 0.84) / 0.16) * Math.PI * 0.46)) : 1.0;
      return 0.175 * (1 - t * 0.64) * tipRound * skullWidth;
    },
    radiusY: (t) => {
      const tipRound = t > 0.84 ? Math.max(0.2, Math.cos(((t - 0.84) / 0.16) * Math.PI * 0.46)) : 1.0;
      return 0.084 * (1 - t * 0.45) * tipRound;
    },
    deform: (_t, theta, rx, ry) => {
      const s = Math.sin(theta);
      return {
        x: Math.cos(theta) * rx,
        y: s > 0 ? s * ry * 0.36 : s * ry * 1.12,
      };
    },
    vertexColor: (_t, theta) => countershade(_t, theta, 1.15),
    capStart: false,
    capEnd: true,
  });
  const tongueCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.015, 0.08),
    new THREE.Vector3(0, 0.028, snoutLen * 0.34),
    new THREE.Vector3(0, 0.014, snoutLen * 0.58),
  ]);
  const tongueGeo = createLoftedOrganGeometry({
    curve: tongueCurve,
    tubularSegments: 10,
    radialSegments: 10,
    radiusX: (t) => 0.074 * (1 - t * 0.62) * skullWidth,
    radiusY: () => 0.018,
    capStart: false,
    capEnd: true,
  });
  disposables.push(lowerJawGeo, tongueGeo);

  const lowerJawMesh = new THREE.Mesh(lowerJawGeo, skinMat);
  lowerJawMesh.castShadow = options.castShadow;
  jawPivot.add(lowerJawMesh);

  const tongueMesh = new THREE.Mesh(tongueGeo, mouthMat);
  jawPivot.add(tongueMesh);

  const numLowerTeeth = 9;
  for (let i = 0; i < numLowerTeeth; i++) {
    const frac = i / (numLowerTeeth - 1);
    const tz = 0.18 + frac * (snoutLen - 0.34);
    const tx = 0.128 * (1 - frac * 0.62) * skullWidth;
    const fangScale = 0.56 + Math.sin(frac * Math.PI) * 0.4;
    for (const side of [-1, 1]) {
      const tooth = new THREE.Mesh(fangGeo, toothMat);
      tooth.position.set(side * tx, 0.02, tz);
      tooth.rotation.x = -Math.PI * 0.46;
      tooth.scale.setScalar(fangScale);
      jawPivot.add(tooth);
    }
  }

  // 6. ARTICULATED 3-JOINT DIGITIGRADE HIND LEGS (Hip -> Knee/Shin -> Ankle/Talons)
  const toeTalonGeo = createCurvedClawGeometry(0.24, 0.034, 0.09);
  disposables.push(toeTalonGeo);

  interface BuiltHindLeg {
    hipPivot: THREE.Group;
    shinPivot: THREE.Group;
    footPivot: THREE.Group;
  }

  const buildHindLeg = (side: number): BuiltHindLeg => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.16 * torsoWidthScale, hipY, -0.06);

    const outX = side * 0.21 * torsoWidthScale;
    const legMass = isRaptor ? 0.76 : 1.0;

    // 6A. Upper Thigh (Hip -> Knee, rounded slightly past knee center for seamless bend)
    const kneePos = new THREE.Vector3(outX * 1.04, -0.64, 0.28);
    const thighCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.04, 0.0),
      new THREE.Vector3(outX * 0.92, -0.28, 0.14),
      new THREE.Vector3(kneePos.x, kneePos.y - 0.04, kneePos.z + 0.02),
    ]);
    const thighGeo = createLoftedOrganGeometry({
      curve: thighCurve,
      tubularSegments: 14,
      radialSegments: 16,
      radiusX: (t) => {
        const muscle = Math.exp(-Math.pow((t - 0.36) / 0.34, 2)) * 0.21;
        const endTaper = t > 0.85 ? 1 - (t - 0.85) * 1.6 : 1;
        return (0.105 + muscle * (1 - t * 0.35)) * endTaper * legMass;
      },
      radiusY: (t) => {
        const muscle = Math.exp(-Math.pow((t - 0.36) / 0.34, 2)) * 0.26;
        const endTaper = t > 0.85 ? 1 - (t - 0.85) * 1.6 : 1;
        return (0.115 + muscle * (1 - t * 0.35)) * endTaper * legMass;
      },
      vertexColor: (t, theta) => countershade(t, theta, 0.8),
      capStart: false,
      capEnd: true,
    });
    disposables.push(thighGeo);
    const thighMesh = new THREE.Mesh(thighGeo, skinMat);
    thighMesh.castShadow = options.castShadow;
    hipPivot.add(thighMesh);

    // 6B. Articulated Shin / Calf (tucked 0.06m inside thigh knee -> past ankle for seamless joint)
    const shinPivot = new THREE.Group();
    shinPivot.position.copy(kneePos);
    hipPivot.add(shinPivot);

    const ankleRelPos = new THREE.Vector3(-outX * 0.1, -0.56, -0.42);
    const shinCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.06, -0.02),
      new THREE.Vector3(-outX * 0.05, -0.24, -0.22),
      new THREE.Vector3(ankleRelPos.x, ankleRelPos.y - 0.03, ankleRelPos.z - 0.02),
    ]);
    const shinGeo = createLoftedOrganGeometry({
      curve: shinCurve,
      tubularSegments: 12,
      radialSegments: 14,
      radiusX: (t) => {
        const capFade = Math.sin(THREE.MathUtils.clamp(t, 0.05, 0.95) * Math.PI);
        return (0.118 * (1 - t * 0.38) + capFade * 0.032) * legMass;
      },
      radiusY: (t) => {
        const capFade = Math.sin(THREE.MathUtils.clamp(t, 0.05, 0.95) * Math.PI);
        return (0.138 * (1 - t * 0.38) + capFade * 0.042) * legMass;
      },
      vertexColor: (t, theta) =>
        countershade(t, theta, 0.72, THREE.MathUtils.smoothstep(t, 0.35, 1.0) * 0.55),
      capStart: true,
      capEnd: true,
    });
    disposables.push(shinGeo);
    const shinMesh = new THREE.Mesh(shinGeo, skinMat);
    shinMesh.castShadow = options.castShadow;
    shinPivot.add(shinMesh);

    // 6C. Articulated Metatarsus & 3-Toed Foot + Sickle Claw (tucked cleanly into ankle)
    const footPivot = new THREE.Group();
    footPivot.position.copy(ankleRelPos);
    shinPivot.add(footPivot);

    const groundRelY = -(hipY + kneePos.y + ankleRelPos.y - 0.08);
    const metaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, -0.02),
      new THREE.Vector3(0, groundRelY * 0.5, 0.12),
      new THREE.Vector3(0, groundRelY, 0.22),
    ]);
    const metaGeo = createLoftedOrganGeometry({
      curve: metaCurve,
      tubularSegments: 10,
      radialSegments: 12,
      radiusX: (t) => (0.076 - t * 0.014) * legMass,
      radiusY: (t) => (0.086 - t * 0.016) * legMass,
      vertexColor: (t, theta) => countershade(t, theta, 0.65, 0.65),
      capStart: true,
      capEnd: true,
    });
    disposables.push(metaGeo);
    const metaMesh = new THREE.Mesh(metaGeo, skinMat);
    metaMesh.castShadow = options.castShadow;
    footPivot.add(metaMesh);

    const toeAngles = [-0.34, 0, 0.34];
    const toeLengths = [0.32, 0.4, 0.32];
    for (let ti = 0; ti < 3; ti++) {
      const ang = toeAngles[ti];
      const tLen = toeLengths[ti];
      const toeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, groundRelY, 0.22),
        new THREE.Vector3(Math.sin(ang) * tLen * 0.55, groundRelY - 0.03, 0.22 + Math.cos(ang) * tLen * 0.55),
        new THREE.Vector3(Math.sin(ang) * tLen, groundRelY - 0.04, 0.22 + Math.cos(ang) * tLen),
      ]);
      const toeGeo = createLoftedOrganGeometry({
        curve: toeCurve,
        tubularSegments: 8,
        radialSegments: 8,
        radiusX: (t) => (0.05 - t * 0.02) * legMass,
        radiusY: (t) => (0.046 - t * 0.018) * legMass,
        vertexColor: () => [0.46, 0.4, 0.32],
        capStart: false,
        capEnd: true,
      });
      disposables.push(toeGeo);
      const toeMesh = new THREE.Mesh(toeGeo, skinMat);
      footPivot.add(toeMesh);

      const talon = new THREE.Mesh(toeTalonGeo, clawMat);
      talon.position.set(Math.sin(ang) * tLen, groundRelY - 0.04, 0.22 + Math.cos(ang) * tLen);
      talon.rotation.y = ang;
      footPivot.add(talon);
    }

    // Iconic raised inner sickle killing-claw on Velociraptor!
    const dewclaw = new THREE.Mesh(toeTalonGeo, clawMat);
    dewclaw.scale.setScalar(isRaptor ? 1.48 : 0.65);
    dewclaw.position.set(-side * 0.09, groundRelY + (isRaptor ? 0.16 : 0.1), 0.3);
    dewclaw.rotation.x = isRaptor ? -0.95 : -0.35;
    dewclaw.rotation.z = side * 0.22;
    footPivot.add(dewclaw);

    root.add(hipPivot);
    return { hipPivot, shinPivot, footPivot };
  };

  const leftLeg = buildHindLeg(-1);
  const rightLeg = buildHindLeg(1);

  return {
    root,
    bodyPivot,
    headPivot,
    jawPivot,
    leftLegPivot: leftLeg.hipPivot,
    rightLegPivot: rightLeg.hipPivot,
    leftShinPivot: leftLeg.shinPivot,
    rightShinPivot: rightLeg.shinPivot,
    leftFootPivot: leftLeg.footPivot,
    rightFootPivot: rightLeg.footPivot,
    armPivots,
    tailSegments,
    salivaStrands,
    shadowDisc: options.shadowDisc,
    baseY: hipY,
    heavySteps: specimen.archetype === 'trex',
    disposables,
  };
}
