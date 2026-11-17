import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ExtinctSpecimen } from '../data/extinctCatalog';
import {
  computeClipKinematics,
  computeMovieCameraFrame,
  type ClipKinematicsState,
  type ExtinctClipPhase,
} from '../utils/extinctShowcaseLogic';
import { createCgiTexturePack, type CgiTexturePack } from './cgiTextures';
import { buildSculptedTheropodRig } from './theropodBuilder';

export interface ExtinctSceneCallbacks {
  onPhaseChange?: (phase: ExtinctClipPhase) => void;
  onFootstep?: (proximity: number, heavy: boolean) => void;
  onRoarStart?: () => void;
}

interface SpecimenRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headPivot: THREE.Group;
  jawPivot: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  leftShinPivot?: THREE.Group;
  rightShinPivot?: THREE.Group;
  leftFootPivot?: THREE.Group;
  rightFootPivot?: THREE.Group;
  armPivots?: THREE.Group[];
  backLeftLegPivot?: THREE.Group;
  backRightLegPivot?: THREE.Group;
  leftWingPivot?: THREE.Group;
  rightWingPivot?: THREE.Group;
  trunkPivot?: THREE.Group;
  tailSegments: THREE.Group[];
  salivaStrands?: THREE.Mesh[];
  shadowDisc: THREE.Mesh;
  baseY: number;
  isBotanical?: boolean;
  isFlying?: boolean;
  isAquatic?: boolean;
  heavySteps?: boolean;
  extraDisposables?: Array<{ dispose: () => void }>;
}

interface DebrisParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  sx: number;
  sy: number;
  sz: number;
  life: number;
  maxLife: number;
}

const CinematicActionShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uSpeedBlur: { value: 0.014 },
    uGrain: { value: 0.028 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSpeedBlur;
    uniform float uGrain;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 center = vec2(0.5, 0.54);
      vec2 dir = vUv - center;
      float dist = length(dir);
      // Keep the central roaring head razor-sharp while streaking peripheral forest/limbs
      float blurMask = smoothstep(0.19, 0.72, dist);
      vec2 stepUv = dir * uSpeedBlur * blurMask;

      vec3 accum = texture2D(tDiffuse, vUv).rgb * 0.34;
      accum += texture2D(tDiffuse, clamp(vUv - stepUv * 0.45, 0.001, 0.999)).rgb * 0.24;
      accum += texture2D(tDiffuse, clamp(vUv - stepUv * 0.95, 0.001, 0.999)).rgb * 0.18;
      accum += texture2D(tDiffuse, clamp(vUv + stepUv * 0.55, 0.001, 0.999)).rgb * 0.14;
      accum += texture2D(tDiffuse, clamp(vUv + stepUv * 1.15, 0.001, 0.999)).rgb * 0.10;

      // Subtle atmospheric lens vignette + 35mm cinematic grain
      float vig = 1.0 - smoothstep(0.45, 1.05, dist) * 0.34;
      float grain = (hash12(vUv * 960.0 + fract(uTime * 17.3)) - 0.5) * uGrain;
      gl_FragColor = vec4(max(vec3(0.0), accum * vig + grain), 1.0);
    }
  `,
};

const _lookTarget = new THREE.Vector3();
const _debrisDummy = new THREE.Object3D();
const _vaporDummy = new THREE.Object3D();
const _headWorldPos = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}


function createForestGroundTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#242c1a';
    ctx.fillRect(0, 0, 512, 512);

    // Rich mossy floor, damp mud ruts & dark wet rain streaks
    for (let i = 0; i < 3600; i++) {
      const x = (i * 97 + (i % 7) * 19) % 512;
      const y = (i * 193 + (i % 11) * 13) % 512;
      const r = 1.5 + (i % 6);
      ctx.fillStyle =
        i % 5 === 0
          ? 'rgba(72, 92, 46, 0.45)'
          : i % 4 === 0
            ? 'rgba(54, 42, 28, 0.55)'
            : 'rgba(18, 22, 12, 0.48)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let m = 0; m < 18; m++) {
      const mx = (m * 137 + 40) % 512;
      const my = (m * 211 + 80) % 512;
      const g = ctx.createRadialGradient(mx, my, 4, mx, my, 26 + (m % 4) * 12);
      g.addColorStop(0, 'rgba(14, 16, 9, 0.52)');
      g.addColorStop(1, 'rgba(14, 16, 9, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, my, 38 + (m % 4) * 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createSoftShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ExtinctPrehistoricScene {
  private container: HTMLElement;
  private callbacks: ExtinctSceneCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private activeSpecimen: ExtinctSpecimen;
  private rig: SpecimenRig | null = null;
  private textures: CgiTexturePack;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private actionPass: ShaderPass | null = null;
  private disposableResources: Array<{ dispose: () => void }> = [];
  private dustPoints: THREE.Points | null = null;
  private debrisMesh: THREE.InstancedMesh | null = null;
  private debrisParticles: DebrisParticle[] = [];
  private debrisCursor = 0;
  private vaporMesh: THREE.InstancedMesh | null = null;
  private vaporParticles: DebrisParticle[] = [];
  private vaporCursor = 0;
  private vaporSpawnTimer = 0;
  private mistMeshes: THREE.Mesh[] = [];
  private forestGroup: THREE.Group;

  private frameId = 0;
  private disposed = false;
  private lastTickMs = 0;
  private clipElapsed = 0;
  private lastPhase: ExtinctClipPhase = 'approach';
  private lastFootstepCount = 0;
  private roarTriggeredThisClip = false;

  private resizeObserver: ResizeObserver | null = null;

  constructor(
    container: HTMLElement,
    initialSpecimen: ExtinctSpecimen,
    callbacks: ExtinctSceneCallbacks = {}
  ) {
    this.container = container;
    this.activeSpecimen = initialSpecimen;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareGl();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const forestHorizonColor = new THREE.Color('#252917');
    this.scene.background = forestHorizonColor;
    this.scene.fog = new THREE.FogExp2('#252917', 0.015);

    this.camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 160);
    this.camera.position.set(1.35, 2.15, 3.25);

    this.textures = createCgiTexturePack(this.renderer.capabilities.getMaxAnisotropy());

    // Studio & natural rainforest reflections
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.52;

    this.setupLighting();

    this.forestGroup = new THREE.Group();
    this.scene.add(this.forestGroup);
    this.buildPrehistoricForest();

    this.loadSpecimen(initialSpecimen);

    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.24,
        0.44,
        0.82
      );
      this.composer.addPass(this.bloomPass);
      this.actionPass = new ShaderPass(CinematicActionShader);
      this.composer.addPass(this.actionPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTickMs = performance.now();
    this.startLoop();
  }

  private setupLighting(): void {
    // Deep damp jungle canopy ambient vs dark forest floor bounce for theatrical contrast
    const hemi = new THREE.HemisphereLight(0x8ea07a, 0x161c0f, 0.78);
    this.scene.add(hemi);

    // Rich golden-hour sunlight piercing the Mesozoic redwood canopy
    const sun = new THREE.DirectionalLight(0xffd28e, 3.15);
    sun.position.set(11, 20, 11);
    if (!this.isSoftwareGl) {
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 65;
      const d = 18;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
    }
    this.scene.add(sun);

    // Intense amber-gold atmospheric rim light sculpting wet scales, saliva & fangs
    const rim = new THREE.DirectionalLight(0xffb140, 1.85);
    rim.position.set(-10, 9, -22);
    this.scene.add(rim);
  }

  private buildPrehistoricForest(): void {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const groundTex = createForestGroundTexture();
    groundTex.anisotropy = maxAniso;
    this.disposableResources.push(groundTex);

    // 1. PHOTOREALISTIC MISTY RAINFOREST PANORAMA CYCLORAMA (Golden Sunbeams & Ancient Redwoods)
    const vistaGeo = new THREE.CylinderGeometry(36, 36, 40, 48, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    const vistaMat = new THREE.MeshBasicMaterial({
      map: this.textures.vistaMap,
      side: THREE.BackSide,
      fog: false,
    });
    const vistaCyclorama = new THREE.Mesh(vistaGeo, vistaMat);
    vistaCyclorama.position.set(0, 15.0, 5);
    this.disposableResources.push(vistaGeo, vistaMat);
    this.forestGroup.add(vistaCyclorama);

    // 2. UNDULATING DAMP FOREST SOIL, MUD RUTS & MOSS TRAIL (with wet puddles)
    const groundGeo = new THREE.PlaneGeometry(90, 90, 48, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const sideFactor = Math.max(0, Math.abs(x) - 3.0) * 0.14;
      const trailRut = Math.sin(x * 1.8 + Math.cos(z * 0.65)) * 0.045;
      const hills =
        trailRut +
        (Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.65 + Math.sin(z * 0.16) * 0.24) *
          Math.min(1.85, sideFactor);
      pos.setY(i, hills);
    }
    groundGeo.computeVertexNormals();
    this.disposableResources.push(groundGeo);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xbcb89f,
      map: groundTex,
      normalMap: this.textures.barkNormalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.74,
      metalness: 0.05,
    });
    this.disposableResources.push(groundMat);

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = !this.isSoftwareGl;
    this.forestGroup.add(ground);

    // 3. GNARLED MOSS-COVERED ANCIENT TREE TRUNKS (Real Bark + Normal Map, Root Flare, NO Cartoon Cones!)
    const treePositions: Array<{ x: number; z: number; scale: number; rot: number; tiltZ: number }> = [];
    for (let i = 0; i < 38; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const laneOffset = 4.3 + ((i * 17) % 18) * 0.78;
      const x = side * laneOffset;
      const z = 4 - ((i * 11) % 34);
      const scale = 0.85 + ((i * 7) % 9) * 0.095;
      const tiltZ = side * (0.015 + (i % 4) * 0.012);
      treePositions.push({ x, z, scale, rot: (i * 1.37) % (Math.PI * 2), tiltZ });
    }

    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.68, 15.0, 14, 6);
    trunkGeo.translate(0, 7.5, 0);
    const tPos = trunkGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const vx = tPos.getX(i);
      const vy = tPos.getY(i);
      const vz = tPos.getZ(i);
      const angle = Math.atan2(vz, vx);
      // Buttress root flare near ground + organic bark gnarl
      const rootFlare = vy < 1.8 ? (1.8 - vy) * (0.28 + 0.14 * Math.sin(angle * 5)) : 0;
      const warp = 1 + rootFlare + Math.sin(vy * 0.9 + angle * 3) * 0.06;
      tPos.setXYZ(i, vx * warp, vy, vz * warp);
    }
    trunkGeo.computeVertexNormals();

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.barkAlbedoMap,
      normalMap: this.textures.barkNormalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.92,
      metalness: 0.02,
    });
    this.disposableResources.push(trunkGeo, trunkMat);

    const treeCount = treePositions.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    trunks.castShadow = !this.isSoftwareGl;
    trunks.receiveShadow = !this.isSoftwareGl;

    const dummy = new THREE.Object3D();
    const tintColor = new THREE.Color();

    for (let i = 0; i < treeCount; i++) {
      const tp = treePositions[i];
      dummy.position.set(tp.x, -0.1, tp.z);
      dummy.rotation.set(0, tp.rot, tp.tiltZ);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      tintColor.setHSL(0.08 + (i % 4) * 0.01, 0.16, 0.72 + (i % 3) * 0.1);
      trunks.setColorAt(i, tintColor);
    }
    trunks.computeBoundingSphere();
    this.forestGroup.add(trunks);

    // 4. CRAGGY MOSS-COVERED VOLCANIC BOULDERS (Displaced high-res stone + bark/moss texture)
    const rockGeo = new THREE.IcosahedronGeometry(0.72, 3);
    const rPos = rockGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const vx = rPos.getX(i);
      const vy = rPos.getY(i);
      const vz = rPos.getZ(i);
      const crag =
        1 +
        Math.sin(vx * 4.2 + vz * 2.9) * 0.16 +
        Math.cos(vy * 5.1 - vx * 3.4) * 0.12 +
        Math.sin(vz * 6.3 + vy * 3.8) * 0.08;
      // Flatten bottom slightly so boulder sits heavy in the mud
      const ny = vy < -0.15 ? vy * 0.55 : vy * 0.72;
      rPos.setXYZ(i, vx * 1.22 * crag, ny * crag, vz * 1.05 * crag);
    }
    rockGeo.translate(0, 0.22, 0);
    rockGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.rockAlbedoMap,
      normalMap: this.textures.barkNormalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.88,
      metalness: 0.04,
    });
    this.disposableResources.push(rockGeo, rockMat);

    const rockCount = 26;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = !this.isSoftwareGl;
    rocks.receiveShadow = !this.isSoftwareGl;
    for (let i = 0; i < rockCount; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (3.3 + ((i * 11) % 10) * 0.68);
      const z = 2.4 - ((i * 17) % 28);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0.08 * (i % 3), i * 1.1, 0.06);
      dummy.scale.setScalar(0.68 + (i % 4) * 0.25);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      tintColor.setHSL(0.24, 0.14, 0.52 + (i % 3) * 0.14);
      rocks.setColorAt(i, tintColor);
    }
    rocks.computeBoundingSphere();
    this.forestGroup.add(rocks);

    // 5. ARCHED SERRATED PREHISTORIC FERNS & TREE-FERN CANOPY BOUGHS (Photorealistic Alpha-Cutout!)
    const frondGeo = new THREE.PlaneGeometry(0.92, 1.55, 2, 6);
    const fPos = frondGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const x = fPos.getX(i);
      const y = fPos.getY(i);
      // Normalize v from bottom stem (0) to arched tip (1)
      const t = (y + 0.775) / 1.55;
      const forwardArcZ = Math.pow(t, 1.35) * 0.95;
      const droopY = Math.sin(t * Math.PI * 0.78) * 0.92;
      const cupY = -Math.abs(x) * 0.12;
      fPos.setXYZ(i, x, droopY + cupY, forwardArcZ);
    }
    frondGeo.computeVertexNormals();

    const fernMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.fernAlbedoMap,
      alphaMap: this.textures.fernAlphaMap,
      alphaTest: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.58,
      metalness: 0.02,
    });
    this.disposableResources.push(frondGeo, fernMat);

    const floorClusters = 26;
    const frondsPerCluster = 7;
    const treeCanopyCount = 18 * 6; // High overhanging boughs on foreground trunks
    const ferns = new THREE.InstancedMesh(
      frondGeo,
      fernMat,
      floorClusters * frondsPerCluster + treeCanopyCount
    );
    ferns.castShadow = !this.isSoftwareGl;

    let fIdx = 0;
    for (let c = 0; c < floorClusters; c++) {
      const side = c % 2 === 0 ? 1 : -1;
      const cx = side * (2.95 + ((c * 9) % 9) * 0.74);
      const cz = 2.8 - ((c * 13) % 28);
      const cScale = 0.78 + (c % 4) * 0.24;
      for (let f = 0; f < frondsPerCluster; f++) {
        dummy.position.set(cx, 0.02, cz);
        dummy.rotation.set(0.12 * (f % 2), (f / frondsPerCluster) * Math.PI * 2 + c * 0.45, 0);
        dummy.scale.setScalar(cScale);
        dummy.updateMatrix();
        ferns.setMatrixAt(fIdx, dummy.matrix);
        tintColor.setHSL(0.24 + (f % 3) * 0.015, 0.22, 0.74 + (f % 3) * 0.12);
        ferns.setColorAt(fIdx, tintColor);
        fIdx++;
      }
    }
    for (let t = 0; t < 18; t++) {
      const tp = treePositions[t];
      const crownY = (4.8 + (t % 3) * 1.4) * tp.scale;
      for (let b = 0; b < 6; b++) {
        dummy.position.set(tp.x, crownY, tp.z);
        dummy.rotation.set(0.25, (b / 6) * Math.PI * 2 + t, 0);
        dummy.scale.setScalar(1.9 * tp.scale);
        dummy.updateMatrix();
        ferns.setMatrixAt(fIdx, dummy.matrix);
        tintColor.setHSL(0.24, 0.18, 0.56 + (b % 2) * 0.1);
        ferns.setColorAt(fIdx, tintColor);
        fIdx++;
      }
    }
    ferns.computeBoundingSphere();
    this.forestGroup.add(ferns);

    // Foreground edge-framing jungle ferns close to the low action-cam lens
    const fgFernCoords = [
      { x: -1.65, z: 1.85, s: 1.08, ry: 0.65 },
      { x: 1.68, z: 1.92, s: 1.12, ry: -0.75 },
      { x: -2.05, z: 0.75, s: 1.24, ry: 0.45 },
      { x: 2.1, z: 0.65, s: 1.2, ry: -0.5 },
    ];
    for (const fg of fgFernCoords) {
      for (let f = 0; f < 4; f++) {
        const frond = new THREE.Mesh(frondGeo, fernMat);
        frond.position.set(fg.x, 0.02, fg.z);
        frond.rotation.set(0.1, fg.ry + (f - 1.5) * 0.55, 0);
        frond.scale.setScalar(fg.s);
        this.forestGroup.add(frond);
      }
    }

    // 6. VOLUMETRIC GOLDEN GOD RAYS PIERCING THE MISTY REDWOOD CANOPY
    const beamCanvas = document.createElement('canvas');
    beamCanvas.width = 128;
    beamCanvas.height = 256;
    const bctx = beamCanvas.getContext('2d');
    if (bctx) {
      const hGrad = bctx.createLinearGradient(0, 0, 128, 0);
      hGrad.addColorStop(0, 'rgba(255, 224, 155, 0)');
      hGrad.addColorStop(0.5, 'rgba(255, 226, 160, 0.78)');
      hGrad.addColorStop(1, 'rgba(255, 224, 155, 0)');
      bctx.fillStyle = hGrad;
      bctx.fillRect(0, 0, 128, 256);

      bctx.globalCompositeOperation = 'destination-in';
      const vGrad = bctx.createLinearGradient(0, 0, 0, 256);
      vGrad.addColorStop(0, 'rgba(255,255,255,0.0)');
      vGrad.addColorStop(0.28, 'rgba(255,255,255,0.9)');
      vGrad.addColorStop(1, 'rgba(255,255,255,0.0)');
      bctx.fillStyle = vGrad;
      bctx.fillRect(0, 0, 128, 256);
    }
    const beamTex = new THREE.CanvasTexture(beamCanvas);
    beamTex.colorSpace = THREE.SRGBColorSpace;
    const beamGeo = new THREE.PlaneGeometry(4.8, 25);
    const beamMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.disposableResources.push(beamTex, beamGeo, beamMat);

    const beamSpecs = [
      { x: 4.2, y: 7.5, z: -13, rz: 0.42 },
      { x: 1.5, y: 8.0, z: -18, rz: 0.45 },
      { x: -3.8, y: 7.2, z: -15, rz: 0.38 },
      { x: 6.5, y: 6.8, z: -9, rz: 0.44 },
      { x: -1.6, y: 6.5, z: -6, rz: 0.41 },
      { x: 2.2, y: 6.4, z: -4, rz: 0.39 },
    ];
    for (const bs of beamSpecs) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(bs.x, bs.y, bs.z);
      beam.rotation.z = bs.rz;
      beam.rotation.y = -0.15;
      this.forestGroup.add(beam);
    }

    // 7. DRIFTING LOW-ALTITUDE FOREST MIST LAYERS
    const mistCanvas = document.createElement('canvas');
    mistCanvas.width = 256;
    mistCanvas.height = 128;
    const mctx = mistCanvas.getContext('2d');
    if (mctx) {
      const mg = mctx.createRadialGradient(128, 64, 12, 128, 64, 122);
      mg.addColorStop(0, 'rgba(218, 214, 185, 0.38)');
      mg.addColorStop(0.55, 'rgba(182, 184, 154, 0.16)');
      mg.addColorStop(1, 'rgba(150, 155, 130, 0)');
      mctx.fillStyle = mg;
      mctx.fillRect(0, 0, 256, 128);
    }
    const mistTex = new THREE.CanvasTexture(mistCanvas);
    mistTex.colorSpace = THREE.SRGBColorSpace;
    const mistGeo = new THREE.PlaneGeometry(14, 4.2);
    const mistMat = new THREE.MeshBasicMaterial({
      map: mistTex,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposableResources.push(mistTex, mistGeo, mistMat);
    const mistPositions = [
      { x: -2.2, y: 0.85, z: -7.5 },
      { x: 2.8, y: 0.95, z: -11.5 },
      { x: -0.6, y: 1.1, z: -15.5 },
      { x: 1.6, y: 0.7, z: -4.2 },
    ];
    for (const mp of mistPositions) {
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.position.set(mp.x, mp.y, mp.z);
      this.forestGroup.add(m);
      this.mistMeshes.push(m);
    }

    // 8. KICKED MUD SPRAY, SOIL CRUMBS & FALLEN FOREST LEAVES SYSTEM (InstancedMesh)
    const debrisCount = 140;
    const debrisGeo = new THREE.SphereGeometry(0.024, 6, 5);
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    });
    this.disposableResources.push(debrisGeo, debrisMat);
    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, debrisCount);
    this.debrisMesh.frustumCulled = false;

    const leafDirtPalette = [
      new THREE.Color('#3a2c1c'), // wet mud droplet
      new THREE.Color('#4f3c24'), // forest soil crumb
      new THREE.Color('#8c5324'), // fallen amber redwood leaf
      new THREE.Color('#5a6b2e'), // torn fern leaflet
      new THREE.Color('#271e14'), // dark damp dirt
    ];
    for (let i = 0; i < debrisCount; i++) {
      const isLeaf = i % 3 === 0;
      this.debrisParticles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: i * 0.7,
        ry: i * 1.1,
        rz: i * 0.4,
        sx: isLeaf ? 1.55 : 0.75 + (i % 3) * 0.2,
        sy: isLeaf ? 0.14 : 0.62,
        sz: isLeaf ? 1.05 : 0.8 + (i % 4) * 0.15,
        life: 0,
        maxLife: 1,
      });
      _debrisDummy.position.set(0, -10, 0);
      _debrisDummy.scale.setScalar(0);
      _debrisDummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, _debrisDummy.matrix);
      this.debrisMesh.setColorAt(i, leafDirtPalette[i % leafDirtPalette.length]);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;
    if (this.debrisMesh.instanceColor) this.debrisMesh.instanceColor.needsUpdate = true;
    this.forestGroup.add(this.debrisMesh);

    // 8B. WARM BREATH VAPOR MIST JETTING FROM ROARING JAWS IN COOL MORNING FOREST
    const vaporCount = 48;
    const vaporGeo = new THREE.PlaneGeometry(0.45, 0.45);
    const vaporMat = new THREE.MeshBasicMaterial({
      map: mistTex,
      color: 0xf4ecd8,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposableResources.push(vaporGeo, vaporMat);
    this.vaporMesh = new THREE.InstancedMesh(vaporGeo, vaporMat, vaporCount);
    this.vaporMesh.frustumCulled = false;
    for (let i = 0; i < vaporCount; i++) {
      this.vaporParticles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: i * 0.5,
        sx: 1,
        sy: 1,
        sz: 1,
        life: 0,
        maxLife: 1,
      });
      _vaporDummy.position.set(0, -10, 0);
      _vaporDummy.scale.setScalar(0);
      _vaporDummy.updateMatrix();
      this.vaporMesh.setMatrixAt(i, _vaporDummy.matrix);
    }
    this.vaporMesh.instanceMatrix.needsUpdate = true;
    this.forestGroup.add(this.vaporMesh);

    // 9. SUNLIT GOLDEN FOREST SPORES & MIST MOTES
    const moteCount = 240;
    const motePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePositions[i * 3] = ((i * 37) % 22) - 11;
      motePositions[i * 3 + 1] = 0.4 + ((i * 53) % 68) * 0.1;
      motePositions[i * 3 + 2] = 3.5 - ((i * 41) % 28);
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xffe4a8,
      size: 0.068,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.disposableResources.push(moteGeo, moteMat);
    this.dustPoints = new THREE.Points(moteGeo, moteMat);
    this.forestGroup.add(this.dustPoints);
  }

  private emitBreathVapor(x: number, y: number, z: number, count: number): void {
    if (!this.vaporMesh) return;
    for (let n = 0; n < count; n++) {
      const p = this.vaporParticles[this.vaporCursor];
      this.vaporCursor = (this.vaporCursor + 1) % this.vaporParticles.length;
      const seed = (n + 1) * 1.93 + this.clipElapsed * 19.1;
      p.active = true;
      p.x = x + ((seed % 1) - 0.5) * 0.14;
      p.y = y + (((seed * 2.1) % 1) - 0.5) * 0.1;
      p.z = z + 0.25;
      p.vx = ((seed % 1) - 0.5) * 0.75;
      p.vy = 0.35 + ((seed * 3.1) % 1) * 0.45;
      p.vz = 1.85 + ((seed * 4.7) % 1) * 1.1;
      p.life = 0;
      p.maxLife = 0.65 + ((seed * 5.9) % 1) * 0.35;
    }
  }

  private updateVaporParticles(delta: number): void {
    if (!this.vaporMesh) return;
    let dirty = false;
    for (let i = 0; i < this.vaporParticles.length; i++) {
      const p = this.vaporParticles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        _vaporDummy.position.set(0, -10, 0);
        _vaporDummy.scale.setScalar(0);
        _vaporDummy.updateMatrix();
        this.vaporMesh.setMatrixAt(i, _vaporDummy.matrix);
        continue;
      }
      const prog = p.life / p.maxLife;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;
      p.vx *= 0.96;
      p.vz *= 0.94;
      const expand = (0.35 + prog * 1.45) * Math.sin(prog * Math.PI);
      _vaporDummy.position.set(p.x, p.y, p.z);
      _vaporDummy.rotation.set(0, 0, p.rz + p.life);
      _vaporDummy.scale.setScalar(Math.max(0.01, expand));
      _vaporDummy.updateMatrix();
      this.vaporMesh.setMatrixAt(i, _vaporDummy.matrix);
    }
    if (dirty) {
      this.vaporMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private emitDirtAndLeaves(originX: number, originZ: number, count: number, boost = 1.0): void {
    if (!this.debrisMesh) return;
    for (let n = 0; n < count; n++) {
      const p = this.debrisParticles[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debrisParticles.length;
      const seed = (n + 1) * 1.618 + this.clipElapsed * 13.7;
      const angle = (seed % 1) * Math.PI * 2;
      const spread = (0.55 + ((seed * 3.7) % 1) * 1.85) * boost;
      p.active = true;
      p.x = originX + Math.cos(angle) * 0.24;
      p.y = 0.04;
      p.z = originZ + Math.sin(angle) * 0.22;
      p.vx = Math.cos(angle) * spread * 1.45;
      p.vy = (1.1 + ((seed * 7.3) % 1) * 1.65) * boost;
      p.vz = Math.sin(angle) * spread * 0.85 - 0.35 * boost;
      p.life = 0;
      p.maxLife = 0.68 + ((seed * 5.1) % 1) * 0.48;
    }
  }

  private updateDebrisParticles(delta: number): void {
    if (!this.debrisMesh) return;
    let dirty = false;
    for (let i = 0; i < this.debrisParticles.length; i++) {
      const p = this.debrisParticles[i];
      if (!p.active) continue;
      dirty = true;
      p.life += delta;
      if (p.life >= p.maxLife) {
        p.active = false;
        _debrisDummy.position.set(0, -10, 0);
        _debrisDummy.scale.setScalar(0);
        _debrisDummy.updateMatrix();
        this.debrisMesh.setMatrixAt(i, _debrisDummy.matrix);
        continue;
      }
      p.vy -= 9.6 * delta;
      p.x += p.vx * delta;
      p.y = Math.max(0.02, p.y + p.vy * delta);
      p.z += p.vz * delta;
      p.rx += 7.5 * delta;
      p.ry += 5.2 * delta;
      const fade = Math.min(1, (1 - p.life / p.maxLife) * 2.5);
      _debrisDummy.position.set(p.x, p.y, p.z);
      _debrisDummy.rotation.set(p.rx, p.ry, p.rz);
      _debrisDummy.scale.set(p.sx * fade, p.sy * fade, p.sz * fade);
      _debrisDummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, _debrisDummy.matrix);
    }
    if (dirty) {
      this.debrisMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public loadSpecimen(specimen: ExtinctSpecimen): void {
    this.activeSpecimen = specimen;
    this.clearCurrentRig();
    this.rig = this.buildRigForSpecimen(specimen);
    this.scene.add(this.rig.root);
    this.replayClip();
  }

  public replayClip(): void {
    this.lastTickMs = performance.now();
    this.clipElapsed = 0;
    this.lastPhase = 'approach';
    this.lastFootstepCount = 0;
    this.roarTriggeredThisClip = false;
    this.callbacks.onPhaseChange?.('approach');
  }

  private clearCurrentRig(): void {
    if (!this.rig) return;
    this.scene.remove(this.rig.root);
    this.rig.root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });
    if (this.rig.extraDisposables) {
      for (const res of this.rig.extraDisposables) {
        res.dispose();
      }
    }
    this.rig = null;
  }

  private createContactShadowDisc(radius: number): THREE.Mesh {
    const tex = createSoftShadowTexture();
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const disc = new THREE.Mesh(geo, mat);
    disc.position.y = 0.025;
    return disc;
  }

  private buildRigForSpecimen(specimen: ExtinctSpecimen): SpecimenRig {
    switch (specimen.archetype) {
      case 'trex':
      case 'raptor':
        return this.buildTheropodRig(specimen);
      case 'triceratops':
        return this.buildTriceratopsRig(specimen);
      case 'sauropod':
        return this.buildSauropodRig(specimen);
      case 'pterosaur':
        return this.buildPterosaurRig(specimen);
      case 'mammoth':
        return this.buildMammothRig(specimen);
      case 'sabertooth':
      case 'thylacine':
        return this.buildQuadrupedPredatorRig(specimen);
      case 'dodo':
        return this.buildDodoRig(specimen);
      case 'hominin':
        return this.buildHomininRig(specimen);
      case 'marine-predator':
      case 'trilobite':
        return this.buildMarineRig(specimen);
      case 'flower':
        return this.buildPrehistoricFlowerRig(specimen);
      case 'tree':
      default:
        return this.buildPrehistoricTreeRig(specimen);
    }
  }

  /**
   * Sculpted organic bipedal theropod (`Tyrannosaurus rex` / `Velociraptor`)
   * built from smooth lofted spine/neck/skull/limb curves, pebbled scale bump maps,
   * amber slit-pupil predator eyes, curved teeth rows, and 3-toed talons.
   */
  private buildTheropodRig(specimen: ExtinctSpecimen): SpecimenRig {
    const built = buildSculptedTheropodRig(specimen, {
      maxAnisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      castShadow: !this.isSoftwareGl,
      shadowDisc: this.createContactShadowDisc(1.75),
      textures: this.textures,
    });
    return {
      root: built.root,
      bodyPivot: built.bodyPivot,
      headPivot: built.headPivot,
      jawPivot: built.jawPivot,
      leftLegPivot: built.leftLegPivot,
      rightLegPivot: built.rightLegPivot,
      leftShinPivot: built.leftShinPivot,
      rightShinPivot: built.rightShinPivot,
      leftFootPivot: built.leftFootPivot,
      rightFootPivot: built.rightFootPivot,
      armPivots: built.armPivots,
      tailSegments: built.tailSegments,
      salivaStrands: built.salivaStrands,
      shadowDisc: built.shadowDisc,
      baseY: built.baseY,
      heavySteps: built.heavySteps,
      extraDisposables: built.disposables,
    };
  }

  private buildTriceratopsRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: specimen.primaryColor,
      map: this.textures.dinoAlbedoMap,
      normalMap: this.textures.dinoNormalMap,
      roughnessMap: this.textures.dinoRoughnessMap,
      roughness: 0.82,
    });
    const hornMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.3 });
    const shadowDisc = this.createContactShadowDisc(1.8);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 1.35, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.45, 8, 12), bodyMat);
    torso.rotation.x = Math.PI / 2;
    bodyPivot.add(torso);

    const tail = new THREE.Group();
    tail.position.set(0, -0.05, -0.95);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.25, 8), bodyMat);
    tailMesh.rotation.x = -Math.PI / 2;
    tailMesh.position.z = -0.6;
    tail.add(tailMesh);
    bodyPivot.add(tail);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.12, 1.05);
    bodyPivot.add(headPivot);

    const frill = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.14, 14), bodyMat);
    frill.rotation.x = Math.PI * 0.38;
    frill.position.set(0, 0.46, 0.08);
    headPivot.add(frill);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.86), bodyMat);
    head.position.set(0, 0.05, 0.42);
    headPivot.add(head);

    const noseHorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 8), hornMat);
    noseHorn.rotation.x = Math.PI * 0.36;
    noseHorn.position.set(0, 0.28, 0.86);
    headPivot.add(noseHorn);

    for (const side of [-1, 1]) {
      const browHorn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 1.15, 8), hornMat);
      browHorn.rotation.x = Math.PI * 0.42;
      browHorn.rotation.z = side * -0.1;
      browHorn.position.set(side * 0.28, 0.48, 0.72);
      headPivot.add(browHorn);
    }

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, -0.2, 0.3);
    const lowerBeak = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.55), bodyMat);
    lowerBeak.position.z = 0.25;
    jawPivot.add(lowerBeak);
    headPivot.add(jawPivot);

    const makeLeg = (x: number, z: number) => {
      const p = new THREE.Group();
      p.position.set(x, 1.2, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 1.2, 8), bodyMat);
      leg.position.y = -0.6;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftLegPivot: makeLeg(-0.56, 0.65),
      rightLegPivot: makeLeg(0.56, 0.65),
      backLeftLegPivot: makeLeg(-0.56, -0.65),
      backRightLegPivot: makeLeg(0.56, -0.65),
      tailSegments: [tail],
      shadowDisc,
      baseY: 1.35,
      heavySteps: true,
    };
  }

  private buildSauropodRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.84 });
    const shadowDisc = this.createContactShadowDisc(2.1);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 2.25, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.88, 1.9, 8, 12), mat);
    torso.rotation.x = Math.PI * 0.44;
    bodyPivot.add(torso);

    const tail = new THREE.Group();
    tail.position.set(0, -0.2, -1.2);
    const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.6, 8), mat);
    tailMesh.rotation.x = -Math.PI / 2;
    tailMesh.position.z = -1.25;
    tail.add(tailMesh);
    bodyPivot.add(tail);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.6, 1.0);
    bodyPivot.add(headPivot);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 3.2, 10), mat);
    neck.position.set(0, 1.45, 0.55);
    neck.rotation.x = 0.34;
    headPivot.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.68), mat);
    head.position.set(0, 2.95, 1.2);
    headPivot.add(head);

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, 2.75, 1.15);
    headPivot.add(jawPivot);

    const makeLeg = (x: number, z: number, h: number) => {
      const p = new THREE.Group();
      p.position.set(x, h, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, h, 8), mat);
      leg.position.y = -h / 2;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftLegPivot: makeLeg(-0.62, 0.8, 2.3),
      rightLegPivot: makeLeg(0.62, 0.8, 2.3),
      backLeftLegPivot: makeLeg(-0.62, -0.8, 1.95),
      backRightLegPivot: makeLeg(0.62, -0.8, 1.95),
      tailSegments: [tail],
      shadowDisc,
      baseY: 2.25,
      heavySteps: true,
    };
  }

  private buildMammothRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const furMat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.92 });
    const tuskMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.24, metalness: 0.05 });
    const shadowDisc = this.createContactShadowDisc(1.9);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 1.75, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.35, 8, 14), furMat);
    torso.rotation.x = Math.PI / 2;
    bodyPivot.add(torso);

    const shoulderHump = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 10), furMat);
    shoulderHump.position.set(0, 0.42, 0.48);
    bodyPivot.add(shoulderHump);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.36, 1.05);
    bodyPivot.add(headPivot);

    const domeHead = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 12), furMat);
    domeHead.position.set(0, 0.22, 0.2);
    headPivot.add(domeHead);

    // Sweeping curved ivory tusks
    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.26, -0.05, 0.45),
        new THREE.Vector3(side * 0.45, -0.35, 1.2),
        new THREE.Vector3(side * 0.36, 0.25, 1.85),
        new THREE.Vector3(side * 0.14, 0.72, 1.92),
      ]);
      const tusk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.085, 8, false), tuskMat);
      headPivot.add(tusk);
    }

    // Articulated trunk that lifts up during trumpet!
    const trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.02, 0.72);
    const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.2, 1.45, 10), furMat);
    trunkMesh.position.set(0, -0.68, 0.15);
    trunkMesh.rotation.x = -0.2;
    trunkPivot.add(trunkMesh);
    headPivot.add(trunkPivot);

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    const makeLeg = (x: number, z: number) => {
      const p = new THREE.Group();
      p.position.set(x, 1.55, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.55, 10), furMat);
      leg.position.y = -0.77;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      trunkPivot,
      leftLegPivot: makeLeg(-0.62, 0.65),
      rightLegPivot: makeLeg(0.62, 0.65),
      backLeftLegPivot: makeLeg(-0.62, -0.65),
      backRightLegPivot: makeLeg(0.62, -0.65),
      tailSegments: [],
      shadowDisc,
      baseY: 1.75,
      heavySteps: true,
    };
  }

  private buildQuadrupedPredatorRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const coatMat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.76 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: specimen.secondaryColor, roughness: 0.8 });
    const fangMat = new THREE.MeshStandardMaterial({ color: 0xf8f3e6, roughness: 0.2 });
    const shadowDisc = this.createContactShadowDisc(1.25);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 1.12, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 8, 12), coatMat);
    torso.rotation.x = Math.PI / 2;
    bodyPivot.add(torso);

    const tail = new THREE.Group();
    tail.position.set(0, 0.08, -0.78);
    const tailMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, specimen.archetype === 'thylacine' ? 0.95 : 0.45, 8),
      stripeMat
    );
    tailMesh.rotation.x = Math.PI * 0.42;
    tailMesh.position.set(0, -0.1, -0.35);
    tail.add(tailMesh);
    bodyPivot.add(tail);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.25, 0.8);
    bodyPivot.add(headPivot);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.64), coatMat);
    skull.position.set(0, 0.08, 0.24);
    headPivot.add(skull);

    if (specimen.archetype === 'sabertooth') {
      for (const side of [-1, 1]) {
        const saber = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.44, 6), fangMat);
        saber.rotation.x = Math.PI;
        saber.position.set(side * 0.14, -0.24, 0.48);
        headPivot.add(saber);
      }
    }

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, -0.1, 0.12);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.5), coatMat);
    jaw.position.z = 0.25;
    jawPivot.add(jaw);
    headPivot.add(jawPivot);

    const makeLeg = (x: number, z: number) => {
      const p = new THREE.Group();
      p.position.set(x, 1.05, z);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 1.05, 8), coatMat);
      leg.position.y = -0.52;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftLegPivot: makeLeg(-0.32, 0.55),
      rightLegPivot: makeLeg(0.32, 0.55),
      backLeftLegPivot: makeLeg(-0.32, -0.55),
      backRightLegPivot: makeLeg(0.32, -0.55),
      tailSegments: [tail],
      shadowDisc,
      baseY: 1.12,
      heavySteps: false,
    };
  }

  private buildPterosaurRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.72 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: specimen.secondaryColor,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const crestMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.45 });
    const shadowDisc = this.createContactShadowDisc(1.2);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 2.55, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.8, 8, 10), mat);
    torso.rotation.x = Math.PI / 2;
    bodyPivot.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.12, 0.55);
    bodyPivot.add(headPivot);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.25, 6), crestMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.02, 0.7);
    headPivot.add(beak);

    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.95, 5), crestMat);
    crest.rotation.x = -Math.PI * 0.42;
    crest.position.set(0, 0.28, -0.2);
    headPivot.add(crest);

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    const makeWing = (side: number) => {
      const wp = new THREE.Group();
      wp.position.set(side * 0.25, 0.08, 0.15);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.95), wingMat);
      wing.rotation.x = -Math.PI / 2;
      wing.position.set(side * 1.3, 0, -0.15);
      wp.add(wing);
      bodyPivot.add(wp);
      return wp;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftWingPivot: makeWing(-1),
      rightWingPivot: makeWing(1),
      tailSegments: [],
      shadowDisc,
      baseY: 2.55,
      isFlying: true,
    };
  }

  private buildDodoRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.8 });
    const beakMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.35 });
    const shadowDisc = this.createContactShadowDisc(0.95);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.95, 0);
    root.add(bodyPivot);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), mat);
    body.scale.set(0.9, 1.0, 1.2);
    bodyPivot.add(body);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.55, 0.45);
    bodyPivot.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), mat);
    head.position.set(0, 0.28, 0.1);
    headPivot.add(head);

    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.46, 8), beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.24, 0.4);
    headPivot.add(beak);

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    const makeLeg = (x: number) => {
      const p = new THREE.Group();
      p.position.set(x, 0.72, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), beakMat);
      leg.position.y = -0.36;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftLegPivot: makeLeg(-0.22),
      rightLegPivot: makeLeg(0.22),
      tailSegments: [],
      shadowDisc,
      baseY: 0.95,
    };
  }

  private buildHomininRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.75 });
    const furMat = new THREE.MeshStandardMaterial({ color: specimen.secondaryColor, roughness: 0.9 });
    const spearMat = new THREE.MeshStandardMaterial({ color: 0x6b4c30, roughness: 0.85 });
    const shadowDisc = this.createContactShadowDisc(0.9);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 1.35, 0);
    root.add(bodyPivot);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.68, 8, 12), furMat);
    bodyPivot.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.62, 0.04);
    bodyPivot.add(headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    head.position.y = 0.22;
    headPivot.add(head);

    const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8), spearMat);
    spear.position.set(0.45, 0.25, 0.2);
    spear.rotation.x = 0.25;
    bodyPivot.add(spear);

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    const makeLeg = (x: number) => {
      const p = new THREE.Group();
      p.position.set(x, 1.0, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.78, 6, 8), skinMat);
      leg.position.y = -0.5;
      p.add(leg);
      root.add(p);
      return p;
    };

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      leftLegPivot: makeLeg(-0.18),
      rightLegPivot: makeLeg(0.18),
      tailSegments: [],
      shadowDisc,
      baseY: 1.35,
    };
  }

  private buildMarineRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.42, metalness: 0.12 });
    const finMat = new THREE.MeshStandardMaterial({ color: specimen.secondaryColor, roughness: 0.55 });
    const shadowDisc = this.createContactShadowDisc(1.5);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 1.6, 0);
    root.add(bodyPivot);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.9, 8, 14), mat);
    body.rotation.x = Math.PI / 2;
    if (specimen.archetype === 'trilobite') {
      body.scale.set(1.25, 1.0, 0.45);
    }
    bodyPivot.add(body);

    if (specimen.archetype === 'marine-predator') {
      const dorsalFin = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 4), finMat);
      dorsalFin.position.set(0, 0.82, -0.1);
      dorsalFin.rotation.x = -0.25;
      bodyPivot.add(dorsalFin);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0, -1.25);
    const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.15, 4), finMat);
    tailFin.rotation.x = Math.PI / 2;
    tailFin.position.z = -0.5;
    tail.add(tailFin);
    bodyPivot.add(tail);

    const headPivot = new THREE.Group();
    const jawPivot = new THREE.Group();
    bodyPivot.add(headPivot);
    headPivot.add(jawPivot);

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      tailSegments: [tail],
      shadowDisc,
      baseY: 1.6,
      isAquatic: true,
    };
  }

  private buildPrehistoricFlowerRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: specimen.secondaryColor, roughness: 0.8 });
    const petalMat = new THREE.MeshStandardMaterial({
      color: specimen.primaryColor,
      emissive: specimen.primaryColor,
      emissiveIntensity: 0.18,
      roughness: 0.42,
    });
    const pollenMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.3 });
    const shadowDisc = this.createContactShadowDisc(1.1);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0, 0);
    root.add(bodyPivot);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.1, 10), stemMat);
    stem.position.y = 1.05;
    bodyPivot.add(stem);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 2.15, 0);
    bodyPivot.add(headPivot);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), pollenMat);
    headPivot.add(core);

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 6), petalMat);
      petal.position.set(Math.cos(angle) * 0.48, 0.08, Math.sin(angle) * 0.48);
      petal.rotation.z = -Math.cos(angle) * 1.1;
      petal.rotation.x = Math.sin(angle) * 1.1;
      headPivot.add(petal);
    }

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      tailSegments: [],
      shadowDisc,
      baseY: 0,
      isBotanical: true,
    };
  }

  private buildPrehistoricTreeRig(specimen: ExtinctSpecimen): SpecimenRig {
    const root = new THREE.Group();
    const barkMat = new THREE.MeshStandardMaterial({
      color: specimen.secondaryColor,
      map: this.textures.barkAlbedoMap,
      normalMap: this.textures.barkNormalMap,
      roughness: 0.92,
    });
    const frondMat = new THREE.MeshStandardMaterial({ color: specimen.primaryColor, roughness: 0.72 });
    const sporeMat = new THREE.MeshStandardMaterial({ color: specimen.accentColor, roughness: 0.5 });
    const shadowDisc = this.createContactShadowDisc(1.4);
    root.add(shadowDisc);

    const bodyPivot = new THREE.Group();
    root.add(bodyPivot);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 4.1, 10), barkMat);
    trunk.position.y = 2.05;
    bodyPivot.add(trunk);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 4.1, 0);
    bodyPivot.add(headPivot);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const branch = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.8, 7), frondMat);
      branch.position.set(Math.cos(a) * 0.65, 0.25, Math.sin(a) * 0.65);
      branch.rotation.z = -Math.cos(a) * 0.55;
      branch.rotation.x = Math.sin(a) * 0.55;
      headPivot.add(branch);

      const cone = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), sporeMat);
      cone.position.set(Math.cos(a) * 1.15, -0.05, Math.sin(a) * 1.15);
      headPivot.add(cone);
    }

    const jawPivot = new THREE.Group();
    headPivot.add(jawPivot);

    return {
      root,
      bodyPivot,
      headPivot,
      jawPivot,
      tailSegments: [],
      shadowDisc,
      baseY: 0,
      isBotanical: true,
    };
  }

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const delta = Math.min(0.32, Math.max(0.001, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;
      this.clipElapsed += delta;
      this.updateClipAnimation(this.clipElapsed, delta);

      if (this.composer && !this.isSoftwareGl) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateClipAnimation(elapsed: number, delta = 0.016): void {
    if (!this.rig) return;
    const rig = this.rig;

    // Slowly drift golden forest dust motes, mist ribbons, kicked debris & warm breath vapor
    if (this.dustPoints) {
      this.dustPoints.rotation.y = Math.sin(elapsed * 0.12) * 0.08;
    }
    for (let i = 0; i < this.mistMeshes.length; i++) {
      this.mistMeshes[i].position.x += Math.sin(elapsed * 0.35 + i * 1.4) * 0.0025;
    }
    this.updateDebrisParticles(delta);
    this.updateVaporParticles(delta);

    if (rig.isBotanical) {
      const approach = Math.min(1, elapsed / 2.8);
      rig.root.position.set(0, 0, -4.4);
      rig.headPivot.rotation.z = Math.sin(elapsed * 1.4) * 0.05;
      rig.bodyPivot.rotation.z = Math.sin(elapsed * 0.9) * 0.025;
      const camZ = 5.4 - approach * 3.8;
      this.camera.position.set(Math.sin(elapsed * 0.4) * 0.35, 2.25, camZ);
      _lookTarget.set(0, rig.root.children.length > 1 ? 1.85 : 1.5, -4.4);
      this.camera.lookAt(_lookTarget);
      if (this.actionPass) {
        this.actionPass.uniforms.uTime.value = elapsed;
        this.actionPass.uniforms.uSpeedBlur.value = 0.004;
      }
      if (!this.roarTriggeredThisClip && elapsed >= 1.2) {
        this.roarTriggeredThisClip = true;
        this.callbacks.onRoarStart?.();
      }
      return;
    }

    const k: ClipKinematicsState = computeClipKinematics(elapsed);

    if (k.phase !== this.lastPhase) {
      this.lastPhase = k.phase;
      this.callbacks.onPhaseChange?.(k.phase);
    }

    const isRaptor = this.activeSpecimen.archetype === 'raptor';
    const isTrex = this.activeSpecimen.archetype === 'trex';
    const isTheropod = isTrex || isRaptor;
    const camFrame = computeMovieCameraFrame(elapsed, k, isRaptor);

    const specimenZ =
      (isRaptor ? k.z + 2.75 + k.approachProgress * 0.35 : k.z) + camFrame.skidSlide;
    const weaveX = isRaptor
      ? k.phase === 'approach'
        ? Math.sin(k.approachProgress * Math.PI * 1.35) * 0.34
        : 0.16 + Math.sin(elapsed * 1.2) * 0.03
      : k.phase === 'approach'
        ? Math.sin(k.approachProgress * Math.PI) * 1.0
        : isTrex
          ? 0.14
          : 0;

    if (k.phase === 'approach' && k.footstepCount > this.lastFootstepCount) {
      this.lastFootstepCount = k.footstepCount;
      if (!rig.isFlying && !rig.isAquatic) {
        this.callbacks.onFootstep?.(k.approachProgress, Boolean(rig.heavySteps));
        this.emitDirtAndLeaves(
          weaveX,
          specimenZ + 0.1,
          isRaptor ? 26 : 16,
          isRaptor ? 1.15 : 0.95
        );
      }
    }

    if (k.phase === 'roar' && !this.roarTriggeredThisClip) {
      this.roarTriggeredThisClip = true;
      this.callbacks.onRoarStart?.();
      if (!rig.isFlying && !rig.isAquatic) {
        // Mud-skid stamp kicks spray of damp earth & fallen leaves!
        this.emitDirtAndLeaves(weaveX, specimenZ + 0.15, 38, isRaptor ? 1.25 : 1.1);
      }
    }

    const stanceYaw = isRaptor ? -0.42 : isTrex ? -0.78 : 0;

    rig.root.position.set(weaveX, 0, specimenZ);
    rig.root.rotation.y = isRaptor
      ? k.phase === 'approach'
        ? Math.sin(k.approachProgress * Math.PI) * -0.18 + Math.pow(k.approachProgress, 2) * stanceYaw
        : stanceYaw + Math.sin(elapsed * 1.1) * 0.04
      : k.phase === 'approach'
        ? -Math.cos(k.approachProgress * Math.PI) * 0.18 + Math.pow(k.approachProgress, 2) * stanceYaw
        : stanceYaw + Math.sin(elapsed * 0.8) * 0.03;

    // Subtle agile lateral bank roll as the predator weaves between redwoods
    rig.bodyPivot.rotation.z =
      k.phase === 'approach' ? Math.sin(k.approachProgress * Math.PI * 2) * (isRaptor ? 0.08 : 0.04) : 0;

    if (rig.isFlying) {
      rig.bodyPivot.position.y = rig.baseY + Math.sin(elapsed * 5.2) * 0.25;
      const flap = Math.sin(elapsed * 7.5) * 0.55;
      if (rig.leftWingPivot) rig.leftWingPivot.rotation.z = flap;
      if (rig.rightWingPivot) rig.rightWingPivot.rotation.z = -flap;
    } else if (rig.isAquatic) {
      rig.bodyPivot.position.y = rig.baseY + Math.sin(elapsed * 3.2) * 0.16;
      rig.bodyPivot.rotation.y = Math.sin(elapsed * 4.0) * 0.12;
      rig.tailSegments.forEach((seg, idx) => {
        seg.rotation.y = Math.sin(elapsed * 5.4 - idx) * 0.28;
      });
    } else {
      // Continuous organic ribcage breathing heave + sprint bounce
      const breathScale = 1 + camFrame.breathCycle * 0.025;
      rig.bodyPivot.scale.set(breathScale, 1 + camFrame.breathCycle * 0.015, 1);

      const shiftY = k.phase === 'roar' ? -0.05 + k.bodyBounceY * 0.45 : k.bodyBounceY;
      rig.bodyPivot.position.y = rig.baseY + shiftY + camFrame.breathCycle * 0.018;
      rig.bodyPivot.rotation.x =
        isRaptor && k.phase === 'roar'
          ? 0.2 - k.roarIntensity * 0.1 + camFrame.breathCycle * 0.025
          : k.torsoPitchRad + camFrame.breathCycle * 0.018;

      // 3-Joint Articulated Running & Weight-Shifting Stance (Hip -> Shin/Knee -> Ankle/Foot)
      const strideFreq = isRaptor ? 1.35 : 1.0;
      const phaseL = k.strideAngle * strideFreq;
      const phaseR = phaseL + Math.PI;
      const strideSinL = k.phase === 'approach' ? Math.sin(phaseL) : 0;
      const strideSinR = k.phase === 'approach' ? Math.sin(phaseR) : 0;

      if (isTheropod && k.phase !== 'approach') {
        const weightShift = Math.sin(elapsed * 2.2) * 0.05;
        if (isRaptor) {
          // Left leg planted deep in wet mud; right leg flexed mid-kick with sickle talon poised!
          if (rig.leftLegPivot) rig.leftLegPivot.rotation.x = 0.22 + weightShift;
          if (rig.leftShinPivot) rig.leftShinPivot.rotation.x = 0.2;
          if (rig.leftFootPivot) rig.leftFootPivot.rotation.x = -0.32;

          const kickPulse = Math.sin(elapsed * 3.6) * 0.08;
          if (rig.rightLegPivot) rig.rightLegPivot.rotation.x = -0.58 + kickPulse;
          if (rig.rightShinPivot) rig.rightShinPivot.rotation.x = 0.88 - kickPulse * 0.5;
          if (rig.rightFootPivot) rig.rightFootPivot.rotation.x = -0.34;
        } else {
          if (rig.leftLegPivot) rig.leftLegPivot.rotation.x = 0.2 + weightShift;
          if (rig.leftShinPivot) rig.leftShinPivot.rotation.x = 0.14;
          if (rig.leftFootPivot) rig.leftFootPivot.rotation.x = -0.26;
          if (rig.rightLegPivot) rig.rightLegPivot.rotation.x = -0.22 - weightShift;
          if (rig.rightShinPivot) rig.rightShinPivot.rotation.x = 0.22;
          if (rig.rightFootPivot) rig.rightFootPivot.rotation.x = -0.1;
        }
      } else {
        // Athletic crouched S-curve digitigrade stride at all phase angles
        const hipMag = isRaptor ? 0.68 : 0.56;
        const baseHip = isTheropod ? -0.22 : 0;
        const baseKnee = isTheropod ? 0.46 : 0;
        const baseFoot = isTheropod ? -0.22 : 0;

        if (rig.leftLegPivot) rig.leftLegPivot.rotation.x = baseHip + strideSinL * hipMag;
        if (rig.rightLegPivot) rig.rightLegPivot.rotation.x = baseHip + strideSinR * hipMag;

        if (rig.leftShinPivot) {
          rig.leftShinPivot.rotation.x = Math.max(0.18, baseKnee - strideSinL * 0.62 + Math.cos(phaseL) * 0.2);
        }
        if (rig.rightShinPivot) {
          rig.rightShinPivot.rotation.x = Math.max(0.18, baseKnee - strideSinR * 0.62 + Math.cos(phaseR) * 0.2);
        }
        if (rig.leftFootPivot) {
          rig.leftFootPivot.rotation.x = baseFoot + strideSinL * 0.28;
        }
        if (rig.rightFootPivot) {
          rig.rightFootPivot.rotation.x = baseFoot + strideSinR * 0.28;
        }
      }

      if (rig.backLeftLegPivot) rig.backLeftLegPivot.rotation.x = -strideSinL * 0.65;
      if (rig.backRightLegPivot) rig.backRightLegPivot.rotation.x = -strideSinR * 0.65;

      // Dynamic forelimb slash / pump motion
      if (rig.armPivots) {
        rig.armPivots.forEach((arm, idx) => {
          const sign = idx === 0 ? -1 : 1;
          const armSwing =
            k.phase === 'approach'
              ? Math.sin(phaseL + idx * Math.PI) * 0.22
              : k.phase === 'roar'
                ? -0.28 * k.roarIntensity + Math.sin(elapsed * 8 + idx) * 0.08
                : Math.sin(elapsed * 2.1 + idx) * 0.06;
          arm.rotation.x = armSwing;
          arm.rotation.z = sign * (k.phase === 'roar' ? 0.12 * k.roarIntensity : 0.03);
        });
      }

      // Tail sweeps continuously with muscular whip-counterbalance
      rig.tailSegments.forEach((seg, idx) => {
        const baseCurve = isRaptor
          ? idx === 0
            ? 0.24
            : idx === 1
              ? 0.18
              : -0.1
          : isTrex
            ? idx === 0
              ? 0.16
              : idx === 1
                ? 0.12
                : -0.14
            : 0;
        seg.rotation.y =
          baseCurve + Math.sin(elapsed * (k.phase === 'approach' ? 7.6 : 2.9) - idx * 0.75) * 0.16;
        seg.rotation.x = Math.cos(elapsed * 4.4 - idx * 0.5) * 0.07;
      });

      if (rig.trunkPivot) {
        rig.trunkPivot.rotation.x =
          k.phase === 'roar' ? -0.95 * k.roarIntensity : Math.sin(elapsed * 3.0) * 0.14;
      }
    }

    // Furious mid-sprint roar jaws + stretching glistening saliva strands + breath vapor!
    const sprintSnarl =
      isRaptor && k.phase === 'approach'
        ? THREE.MathUtils.smoothstep(k.approachProgress, 0.38, 0.98) * 0.62
        : 0;
    const jawOpen = Math.max(k.jawOpenRad, sprintSnarl);
    rig.jawPivot.rotation.x = jawOpen;

    if (rig.salivaStrands) {
      for (let i = 0; i < rig.salivaStrands.length; i++) {
        const strand = rig.salivaStrands[i];
        const spanZ = Number(strand.userData.spanZ ?? 0.35);
        const gap = Math.max(0.015, Math.sin(jawOpen) * spanZ * 0.72);
        strand.visible = jawOpen > 0.18;
        strand.scale.set(1, gap, 1);
        strand.rotation.x = jawOpen * 0.42;
      }
    }

    // Emit warm morning breath vapor plumes when predator bellows
    if (jawOpen > 0.42 && !rig.isAquatic) {
      this.vaporSpawnTimer += delta;
      if (this.vaporSpawnTimer >= 0.085) {
        this.vaporSpawnTimer = 0;
        rig.headPivot.getWorldPosition(_headWorldPos);
        this.emitBreathVapor(_headWorldPos.x, _headWorldPos.y + 0.42, _headWorldPos.z + 0.52, 2);
      }
    }

    rig.headPivot.rotation.x = isRaptor
      ? k.phase === 'roar'
        ? -0.05 * k.roarIntensity + Math.sin(elapsed * 10) * 0.04
        : k.phase === 'alert'
          ? Math.sin(elapsed * 1.4) * 0.06
          : -0.04
      : k.phase === 'roar'
        ? -0.2 * k.roarIntensity + Math.sin(elapsed * 8) * 0.04
        : k.phase === 'alert'
          ? Math.sin(elapsed * 1.4) * 0.06
          : -0.12;

    const headTurn = isRaptor
      ? k.phase === 'approach'
        ? Math.pow(k.approachProgress, 1.5) * 0.32
        : 0.32 + Math.sin(elapsed * 2.6) * 0.09
      : isTrex
        ? k.phase === 'approach'
          ? Math.pow(k.approachProgress, 1.8) * 0.56
          : 0.6 + Math.sin(elapsed * 2.1) * 0.08
        : 0;
    rig.headPivot.rotation.y =
      headTurn +
      (k.phase === 'roar'
        ? Math.sin(elapsed * 15) * 0.045 * k.roarIntensity
        : k.phase === 'alert'
          ? Math.sin(elapsed * 0.9) * 0.14
          : Math.sin(elapsed * 4.5) * 0.04);

    // Blockbuster 3-Act Handheld Pursuit & Hero Arc Camera
    const shakeX = Math.sin(elapsed * 44) * 0.085 * k.cameraShake;
    const shakeY = Math.cos(elapsed * 55) * 0.068 * k.cameraShake;
    if (Math.abs(this.camera.fov - camFrame.fov) > 0.1) {
      this.camera.fov = camFrame.fov;
      this.camera.updateProjectionMatrix();
    }

    if (k.phase === 'approach') {
      // Racing backward ahead of the sprinting predator so it fills the lens right through the forest!
      const followDist = isRaptor ? 4.4 - k.approachProgress * 1.45 : 6.1 - k.approachProgress * 1.75;
      const camZ = specimenZ + followDist;
      this.camera.position.set(
        weaveX * 0.55 + camFrame.camOffsetX + shakeX,
        camFrame.camHeightY + shakeY,
        camZ
      );
      _lookTarget.set(
        weaveX * 0.72,
        isRaptor ? 1.24 + k.approachProgress * 0.14 : rig.baseY * 0.9 + 0.32,
        specimenZ + 0.25
      );
    } else {
      // Hero roar close-up arc + full-silhouette cinema headroom
      const camZ = specimenZ + (isRaptor ? 3.55 : 4.55) - k.roarIntensity * (isRaptor ? 0.22 : 0.28);
      this.camera.position.set(
        camFrame.camOffsetX + shakeX,
        camFrame.camHeightY + shakeY,
        camZ
      );
      _lookTarget.set(
        weaveX * 0.65 + (isTrex ? 0.14 : 0.04),
        isRaptor ? 1.48 + k.roarIntensity * 0.06 : rig.baseY * 0.95 + 0.52 + k.roarIntensity * 0.14,
        specimenZ + 0.3
      );
    }
    this.camera.lookAt(_lookTarget);
    this.camera.rotation.z += camFrame.dutchRollRad;

    if (this.actionPass) {
      this.actionPass.uniforms.uTime.value = elapsed;
      const speedImpulse =
        k.phase === 'approach'
          ? (isRaptor ? 0.024 : 0.015) * (0.5 + k.approachProgress * 0.75)
          : k.phase === 'roar'
            ? (isRaptor ? 0.018 : 0.01) * k.roarIntensity
            : 0.004;
      this.actionPass.uniforms.uSpeedBlur.value = speedImpulse;
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer?.setSize(width, height);
    this.bloomPass?.setSize(width, height);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver?.disconnect();
    this.clearCurrentRig();

    for (const res of this.disposableResources) {
      res.dispose();
    }
    this.disposableResources = [];

    this.textures.dispose();
    this.composer?.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
