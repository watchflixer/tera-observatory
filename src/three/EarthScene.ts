import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ATMOSPHERE_LAYERS,
  EARTH_LANDMARKS,
  HISTORY_ERAS,
  INTERIOR_LAYERS,
  type AtmosphereLayerId,
  type HistoryEraId,
  type InteriorLayerId,
  type LeafletBaseLayerId,
  type ObservatoryMode,
} from '../data/earthData';
import {
  cameraDistanceToZoomAndAltitudeKm,
  computeCutawayAngles,
  getExplodedOffset,
  latLonToVector3,
  vector3ToLatLon,
} from '../utils/earthMath';
import {
  disposeLeafletTextureCache,
  getDetailPatchKey,
  loadLeafletDetailPatch,
  loadLeafletGlobeTexture,
  type LeafletDetailPatchResult,
  type LeafletGlobeTextureResult,
} from './leafletGlobeTexture';
import {
  createEarthTextures,
  loadPhotorealisticEarthMaps,
  type EarthTextureBundle,
  type PhotorealisticMaps,
} from './proceduralTextures';
import { createSpaceObjectsSystem, type SpaceObjectsSystem } from './spaceObjects';
import { createHadeanMaterial } from './hadeanMaterial';
import { advanceCloudDrift, alignCloudShell, applyCloudDrift } from './cloudShell';
import { getGlobeDetailZoom, getRenderPixelRatio, isModernGlobeView } from './renderQuality';

export interface SceneControlState {
  mode: ObservatoryMode;
  cutawayDegrees: number;
  explodeFactor: number;
  selectedInterior: InteriorLayerId;
  selectedAtmosphere: AtmosphereLayerId;
  selectedHistory: HistoryEraId;
  selectedLandmarkId: string | null;
  inspectedCoords: { lat: number; lon: number } | null;
  leafletBaseLayer: LeafletBaseLayerId;
  showLeafletLabels: boolean;
  showClouds: boolean;
  showTectonics: boolean;
  showMagnetosphere: boolean;
  showLandmarks: boolean;
  showSatellites: boolean;
  showAsteroids: boolean;
  autoRotate: boolean;
  dossierOpen: boolean;
  paused?: boolean;
}

export interface SceneCallbacks {
  onSelectInterior: (id: InteriorLayerId) => void;
  onSelectAtmosphere: (id: AtmosphereLayerId) => void;
  onSelectLandmark: (id: string) => void;
  onInspectLocation: (coords: { lat: number; lon: number }) => void;
  onSelectSpaceObject: (obj: { kind: 'satellite' | 'asteroid'; id: string }) => void;
  onCameraZoomUpdate: (info: {
    centerCoords: { lat: number; lon: number };
    altitudeKm: number;
    leafletZoom: number;
  }) => void;
  onHoverCoords: (coords: { lat: number; lon: number } | null) => void;
  onContextLost: () => void;
  onGlobeImageryError: (failed: boolean) => void;
}

const EARTH_RADIUS = 2.0;

// Opening / reset framing: well farther out than the old 7.16-unit view
// (~10.3 units) so the globe reads smaller on first load, on every device.
const HOME_CAMERA_POSITION = new THREE.Vector3(5.89, 2.56, 8.06);
const CAMERA_VERTICAL_FOV_DEG = 42;

// Mode framing presets — each ~12% farther out than the original framing so
// every mode opens a little more zoomed out (same viewing angles as before).
const CUTAWAY_CAMERA_POSITION = new THREE.Vector3(4.59, 1.96, 5.49);
const ATMOSPHERE_CAMERA_POSITION = new THREE.Vector3(5.38, 2.13, 6.16);
const SYSTEMS_CAMERA_POSITION = new THREE.Vector3(5.71, 2.35, 6.61);

// Distance at which the globe fits the screen width for a given aspect ratio.
function getFitDistance(aspect: number): number {
  const halfVerticalFov = THREE.MathUtils.degToRad(CAMERA_VERTICAL_FOV_DEG / 2);
  const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * Math.max(aspect, 0.2));
  return (EARTH_RADIUS / Math.sin(halfHorizontalFov)) * 1.25;
}

// On narrow portrait screens (Android / iPhone) the horizontal field of view
// is much tighter, so the same camera distance crops the globe's left/right
// edges. Push the home camera farther out until the globe fits the width.
function getHomeCameraPosition(aspect: number): THREE.Vector3 {
  const baseDistance = HOME_CAMERA_POSITION.length();
  const distance = THREE.MathUtils.clamp(
    Math.max(baseDistance, getFitDistance(aspect)),
    baseDistance,
    13.0
  );
  return HOME_CAMERA_POSITION.clone().setLength(distance);
}

// Push a framing position farther out when needed so the globe fits the
// screen width on narrow portrait screens (phones).
function fitCameraToWidth(pos: THREE.Vector3, aspect: number): THREE.Vector3 {
  const fitDistance = getFitDistance(aspect);
  if (pos.length() < fitDistance) {
    pos.setLength(Math.min(fitDistance, 13.0));
  }
  return pos;
}

// Pre-allocated scratch vectors to avoid GC pressure inside render loop
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _camGoalDir = new THREE.Vector3();
const _camCurrDir = new THREE.Vector3();
const _camStartDir = new THREE.Vector3();
const _camStartTarget = new THREE.Vector3();
const _camTargetOffset = new THREE.Vector3();
const _camSlerpQuat = new THREE.Quaternion();
const _camStepQuat = new THREE.Quaternion();
const _camAntipodalAxis = new THREE.Vector3(0, 1, 0);
const _rayMouse = new THREE.Vector2();
const _localHit = new THREE.Vector3();
const _centerRayDir = new THREE.Vector3();

function isObjectEffectivelyVisible(obj: THREE.Object3D): boolean {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (!curr.visible) return false;
    curr = curr.parent;
  }
  return true;
}

function detectSoftwareWebGL(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

function createFresnelAtmosphereMaterial(colorHex: string, intensity: number, power: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
      uPower: { value: power },
      uOpacity: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uPower;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float ndotv = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
        float rim = pow(1.0 - ndotv, uPower) * uIntensity;
        gl_FragColor = vec4(uColor, clamp(rim * uOpacity, 0.0, 0.85));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

function createCrossSectionGeometry(radius: number): THREE.BufferGeometry {
  // Semi-circle in +X half-plane spanning -Y to +Y, mapped to radial cross-section UV
  const segments = 56;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Center vertex (0,0,0) -> UV (0.5, 0.5)
  positions.push(0, 0, 0);
  normals.push(0, 0, 1);
  uvs.push(0.5, 0.5);

  for (let i = 0; i <= segments; i++) {
    const theta = -Math.PI / 2 + (i / segments) * Math.PI;
    const x = Math.cos(theta) * radius;
    const y = Math.sin(theta) * radius;
    positions.push(x, y, 0);
    normals.push(0, 0, 1);
    uvs.push(0.5 + (x / radius) * 0.5, 0.5 + (y / radius) * 0.5);
  }

  for (let i = 1; i <= segments; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export class EarthScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private textures: EarthTextureBundle;
  private maxAniso = 1;
  private photoMaps: PhotorealisticMaps | null = null;
  private leafletTex: LeafletGlobeTextureResult | null = null;
  private globeReady = false;
  private leafletLayerPending = false;
  private leafletRetryTimer: number | undefined;
  private detailPatchMesh: THREE.Mesh;
  private detailPatchMat: THREE.MeshStandardMaterial;
  private detailUniforms = {
    uBaseMap: { value: null as THREE.Texture | null },
    uPatchOffset: { value: new THREE.Vector2() },
    uPatchScale: { value: new THREE.Vector2(1, 1) },
  };
  private activeDetailPatchKey = '';
  private requestedDetailPatchKey = '';
  private cancelPhotoLoad: () => void = () => {};
  private cancelLeafletLoad: () => void = () => {};
  private cancelDetailPatchLoad: () => void = () => {};
  private nightUniforms = {
    uNightMap: { value: null as THREE.Texture | null },
    uSunDir: { value: new THREE.Vector3(8.8, 2.6, 2.0).normalize() },
    uUseNightLights: { value: 0.0 },
  };
  private rayleighHaloMesh!: THREE.Mesh;

  private earthTiltGroup: THREE.Group;
  private earthSpinGroup: THREE.Group;
  private coreLight: THREE.PointLight;
  private keyLight: THREE.DirectionalLight;

  // Interior meshes
  private interiorMeshes = new Map<InteriorLayerId, THREE.Mesh>();
  private interiorMaterials = new Map<InteriorLayerId, THREE.MeshStandardMaterial>();
  private hadeanMaterial: THREE.ShaderMaterial | null = null;
  private sliceCapOne: THREE.Mesh;
  private sliceCapTwo: THREE.Mesh;
  private cloudsMesh: THREE.Mesh;
  private cloudDrift = 0;
  private tectonicMesh: THREE.Mesh;
  private atmosphereMeshes = new Map<AtmosphereLayerId, THREE.Mesh>();
  private atmosphereMaterials = new Map<AtmosphereLayerId, THREE.ShaderMaterial>();
  private auroraGroup: THREE.Group;
  private magnetosphereGroup: THREE.Group;
  private spaceObjects: SpaceObjectsSystem;
  private landmarksGroup: THREE.Group;
  private landmarkPins = new Map<string, { group: THREE.Group; ring: THREE.Mesh; core: THREE.Mesh }>();
  private locationPinGroup: THREE.Group;

  private raycaster = new THREE.Raycaster();
  private interactables: THREE.Object3D[] = [];

  private state: SceneControlState;
  private currentCutawayDeg = -1;
  private smoothCutawayDeg = 0;
  private smoothExplode = 0;
  private smoothTiltRad = (23.44 * Math.PI) / 180;

  private cameraAnimating = false;
  private userHasInteracted = false;
  private camAnimStartMs = 0;
  private camAnimDurationMs = 950;
  private camStartRadius = 6.5;
  private camGoalRadius = 6.5;
  private startMs = performance.now();
  private lastMs = performance.now();
  private frameId = 0;
  private loopRunning = false;
  private wakePausedLoop: (() => void) | null = null;
  private documentHidden = document.hidden;
  private disposed = false;
  private lastHoverCheck = 0;
  private lastZoomCheck = 0;
  private lastDetailTileTrigger = 0;
  private lastReportedZoomKey = '';
  private pointerDownPos = { x: 0, y: 0 };

  constructor(container: HTMLElement, initialState: SceneControlState, callbacks: SceneCallbacks) {
    this.container = container;
    this.state = { ...initialState };
    this.callbacks = callbacks;
    this.smoothCutawayDeg = initialState.cutawayDegrees;
    this.smoothExplode = initialState.explodeFactor;

    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    // Keep the 3D Globe crisp on phones while retaining bounded rendering costs.
    this.renderer.setPixelRatio(getRenderPixelRatio(isModernGlobeView(initialState.mode, initialState.selectedHistory) ? 'systems' : initialState.mode, window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches, this.isSoftwareGl));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.scene.fog = new THREE.FogExp2('#000000', 0.008);

    // Subtle studio reflection for metallic core & ISS without softbox glare on Earth's oceans
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.16;
    pmrem.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(CAMERA_VERTICAL_FOV_DEG, width / height, 0.1, 200);
    this.camera.position.copy(getHomeCameraPosition(width / height));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.42;
    this.controls.maxDistance = 13.5;
    this.controls.zoomSpeed = 0.85;
    this.controls.target.set(initialState.dossierOpen && width >= 1024 ? 0.52 : 0, -0.22, 0);
    this.controls.addEventListener('start', () => {
      this.cameraAnimating = false;
      this.userHasInteracted = true;
    });

    // Lighting rig: calibrated solar key for crisp terminator, cool space fill, subtle rim, core light
    this.keyLight = new THREE.DirectionalLight('#fff6e8', 2.35);
    this.keyLight.position.set(8.8, 2.6, 2.0);
    this.scene.add(this.keyLight);

    const hemiLight = new THREE.HemisphereLight('#4b7bec', '#060a14', 0.18);
    this.scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.45);
    rimLight.position.set(-7, -2, -6);
    this.scene.add(rimLight);

    this.coreLight = new THREE.PointLight('#fb923c', 2.4, 7.5, 1.5);
    this.coreLight.position.set(0, 0, 0);
    this.scene.add(this.coreLight);

    // Textures (procedural ready immediately + async upgrade to Leaflet live map & Black Marble night lights)
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createEarthTextures(this.maxAniso);
    this.nightUniforms.uNightMap.value = this.textures.modernAlbedo;

    // Starfield
    this.buildStarfield();

    // Planetary Hierarchy
    this.earthTiltGroup = new THREE.Group();
    this.earthTiltGroup.rotation.z = -this.smoothTiltRad;
    this.scene.add(this.earthTiltGroup);

    this.earthSpinGroup = new THREE.Group();
    this.earthTiltGroup.add(this.earthSpinGroup);

    // Build interior shells + crust
    this.buildInteriorAndCrust();

    // Google-Earth dynamic high-res Leaflet zoom patch overlay
    this.detailPatchMat = new THREE.MeshStandardMaterial({
      roughness: 0.86,
      metalness: 0.04,
      envMapIntensity: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    // Blend the high-resolution region into the current global map and sample
    // night lights in global coordinates, rather than drawing a visible rectangle.
    this.detailPatchMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.detailUniforms, this.nightUniforms);
      shader.vertexShader = 'varying vec3 vWorldNormal;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldNormal = normalize(mat3(modelMatrix) * normal);'
      );
      shader.fragmentShader =
        'uniform sampler2D uBaseMap;\nuniform sampler2D uNightMap;\nuniform vec2 uPatchOffset;\nuniform vec2 uPatchScale;\nuniform vec3 uSunDir;\nuniform float uUseNightLights;\nvarying vec3 vWorldNormal;\n' +
        shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec2 globalUv = vec2(fract(uPatchOffset.x + vMapUv.x * uPatchScale.x), uPatchOffset.y + vMapUv.y * uPatchScale.y);
          float edge = min(min(vMapUv.x, 1.0 - vMapUv.x), min(vMapUv.y, 1.0 - vMapUv.y));
          diffuseColor.rgb = mix(texture2D(uBaseMap, globalUv).rgb, diffuseColor.rgb, smoothstep(0.0, 0.08, edge));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
          float nightMask = smoothstep(0.12, -0.24, sunDot);
          float twilight = exp(-pow((sunDot + 0.02) / 0.14, 2.0));
          vec3 nightCol = texture2D(uNightMap, globalUv).rgb;
          totalEmissiveRadiance += nightCol * nightMask * 1.7 * uUseNightLights;
          totalEmissiveRadiance += vec3(0.95, 0.42, 0.14) * twilight * uUseNightLights * 0.14;`);
    };
    this.detailPatchMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.0018, 32, 24, 0, 0.2, 1.4, 0.2),
      this.detailPatchMat
    );
    this.detailPatchMesh.visible = false;
    this.earthSpinGroup.add(this.detailPatchMesh);

    // Build cutaway slice caps
    const capGeo = createCrossSectionGeometry(EARTH_RADIUS);
    const capMat = new THREE.MeshStandardMaterial({
      map: this.textures.crossSectionMap,
      roughness: 0.65,
      metalness: 0.15,
      emissive: new THREE.Color('#431407'),
      emissiveMap: this.textures.crossSectionMap,
      emissiveIntensity: 0.42,
      side: THREE.DoubleSide,
    });
    this.sliceCapOne = new THREE.Mesh(capGeo, capMat);
    this.sliceCapTwo = new THREE.Mesh(capGeo, capMat);
    this.sliceCapOne.visible = false;
    this.sliceCapTwo.visible = false;
    this.earthSpinGroup.add(this.sliceCapOne, this.sliceCapTwo);

    // Clouds & Tectonic plates overlays
    const cloudMat = new THREE.MeshStandardMaterial({
      map: this.textures.cloudsMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.0,
    });
    this.cloudsMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.011, 84, 56), cloudMat);
    this.earthSpinGroup.add(this.cloudsMesh);

    const tecMat = new THREE.MeshBasicMaterial({
      map: this.textures.tectonicMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.tectonicMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.007, 64, 44), tecMat);
    this.tectonicMesh.visible = initialState.showTectonics;
    this.earthSpinGroup.add(this.tectonicMesh);

    // Rayleigh back-side orbital atmospheric scatter halo
    const haloMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#38bdf8') },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float intensity = pow(clamp(0.55 - dot(vNormal, vViewDir), 0.0, 1.0), 2.8);
          gl_FragColor = vec4(uColor, intensity * 0.72);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    this.rayleighHaloMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.11, 64, 44), haloMat);
    this.earthTiltGroup.add(this.rayleighHaloMesh);

    // Load Black Marble night lights & clean cyclone clouds
    this.cancelPhotoLoad = loadPhotorealisticEarthMaps(this.maxAniso, (maps) => {
      if (this.disposed) return;
      this.photoMaps = maps;
      this.nightUniforms.uNightMap.value = maps.nightMap;

      const cMat = this.cloudsMesh.material as THREE.MeshStandardMaterial;
      cMat.map = null;
      cMat.color.set('#ffffff');
      cMat.alphaMap = maps.cloudAlphaMap;
      cMat.opacity = 0.45;
      cMat.needsUpdate = true;

      this.updateSurfaceForEra();
    });

    // Load live Leaflet tile map (EPSG:3857 -> Equirectangular) directly onto the 3D Globe
    this.loadActiveLeafletLayer(initialState.leafletBaseLayer, initialState.showLeafletLabels);

    // Atmosphere 5 shells + Aurora
    this.buildAtmosphereShells();
    this.auroraGroup = this.buildAuroraRings();
    this.earthTiltGroup.add(this.auroraGroup);

    // Magnetosphere field lines
    this.magnetosphereGroup = this.buildMagnetosphere();
    this.earthTiltGroup.add(this.magnetosphereGroup);

    // Upgraded Composite Satellites (ISS, Hubble, Sentinel) & Near-Earth Asteroids
    this.spaceObjects = createSpaceObjectsSystem(this.maxAniso);
    this.earthTiltGroup.add(this.spaceObjects.satellitesRoot);
    this.scene.add(this.spaceObjects.asteroidsRoot);
    this.interactables.push(...this.spaceObjects.interactables);

    // Interactive 3D Landmarks & Google-Earth Click-to-Inspect Location Pin
    this.landmarksGroup = new THREE.Group();
    this.buildLandmarks();
    this.earthSpinGroup.add(this.landmarksGroup);

    this.locationPinGroup = this.buildLocationPin();
    this.locationPinGroup.visible = false;
    this.earthSpinGroup.add(this.locationPinGroup);

    // Apply initial geometry & visual state
    this.rebuildCutawayGeometries(this.state.cutawayDegrees);
    this.applyStateToScene();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.startLoop();
  }

  private buildStarfield(): void {
    const starCount = 1800;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const palette = [
      new THREE.Color('#e2e8f0'),
      new THREE.Color('#bae6fd'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#cbd5e1'),
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 42 + Math.random() * 35;
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = Math.random() * Math.PI * 2;
      positions[i * 3] = r * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = r * Math.cos(theta);
      positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);

      const c = palette[i % palette.length];
      const dim = 0.55 + Math.random() * 0.45;
      colors[i * 3] = c.r * dim;
      colors[i * 3 + 1] = c.g * dim;
      colors[i * 3 + 2] = c.b * dim;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const stars = new THREE.Points(geo, mat);
    this.scene.add(stars);
  }

  private buildInteriorAndCrust(): void {
    INTERIOR_LAYERS.forEach((layer) => {
      const radius = layer.radiusRatio * EARTH_RADIUS;
      let mat: THREE.MeshStandardMaterial;

      if (layer.id === 'crust') {
        mat = new THREE.MeshStandardMaterial({
          map: this.textures.modernAlbedo,
          roughnessMap: this.textures.roughnessMap,
          bumpMap: this.textures.bumpMap,
          bumpScale: 0.045,
          roughness: 0.85,
          metalness: 0.04,
          envMapIntensity: 0.04,
          side: THREE.DoubleSide,
        });
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uNightMap = this.nightUniforms.uNightMap;
          shader.uniforms.uSunDir = this.nightUniforms.uSunDir;
          shader.uniforms.uUseNightLights = this.nightUniforms.uUseNightLights;

          shader.vertexShader =
            'varying vec3 vWorldNormal;\n' +
            shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
              vWorldNormal = normalize(mat3(modelMatrix) * normal);`
            );

          shader.fragmentShader =
            'uniform sampler2D uNightMap;\nuniform vec3 uSunDir;\nuniform float uUseNightLights;\nvarying vec3 vWorldNormal;\n' +
            shader.fragmentShader.replace(
              '#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
              float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
              float nightMask = smoothstep(0.12, -0.24, sunDot);
              float twilight = exp(-pow((sunDot + 0.02) / 0.14, 2.0));
              vec3 nightCol = texture2D(uNightMap, vMapUv).rgb;
              totalEmissiveRadiance += nightCol * nightMask * 1.7 * uUseNightLights;
              totalEmissiveRadiance += vec3(0.95, 0.42, 0.14) * twilight * uUseNightLights * 0.14;`
            );
        };
      } else if (layer.id === 'inner-core') {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(layer.colorHex),
          emissive: new THREE.Color(layer.emissiveHex),
          emissiveIntensity: 1.5,
          roughness: 0.25,
          metalness: 0.85,
        });
      } else if (layer.id === 'outer-core') {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(layer.colorHex),
          emissive: new THREE.Color(layer.emissiveHex),
          emissiveIntensity: 0.85,
          roughness: 0.35,
          metalness: 0.55,
          side: THREE.DoubleSide,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(layer.colorHex),
          emissive: new THREE.Color(layer.emissiveHex),
          emissiveIntensity: 0.35,
          roughness: 0.78,
          metalness: 0.1,
          side: THREE.DoubleSide,
        });
      }

      const segW = layer.id === 'crust' ? 84 : 52;
      const segH = layer.id === 'crust' ? 56 : 36;
      const geo = new THREE.SphereGeometry(radius, segW, segH);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { kind: 'interior', id: layer.id };
      this.earthSpinGroup.add(mesh);
      this.interiorMeshes.set(layer.id, mesh);
      this.interiorMaterials.set(layer.id, mat);
      this.interactables.push(mesh);
    });
  }

  private buildAtmosphereShells(): void {
    ATMOSPHERE_LAYERS.forEach((layer, idx) => {
      const radius = EARTH_RADIUS * layer.radiusRatio;
      const mat = createFresnelAtmosphereMaterial(
        layer.colorHex,
        idx === 0 ? 1.05 : 0.75,
        idx === 0 ? 3.2 : 2.6
      );
      const geo = new THREE.SphereGeometry(radius, 48, 32);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2 + idx;
      mesh.userData = { kind: 'atmosphere', id: layer.id };
      this.earthTiltGroup.add(mesh);
      this.atmosphereMeshes.set(layer.id, mesh);
      this.atmosphereMaterials.set(layer.id, mat);
    });
  }

  private buildAuroraRings(): THREE.Group {
    const group = new THREE.Group();
    const curtainGeo = new THREE.CylinderGeometry(0.86, 0.68, 0.24, 48, 1, true);
    const auroraMat = new THREE.ShaderMaterial({
      uniforms: {
        uColorA: { value: new THREE.Color('#a78bfa') },
        uColorB: { value: new THREE.Color('#38bdf8') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        void main() {
          float vFade = sin(vUv.y * 3.14159265);
          float shimmer = 0.65 + 0.35 * sin(vUv.x * 37.699);
          vec3 col = mix(uColorA, uColorB, vUv.y);
          gl_FragColor = vec4(col, vFade * vFade * shimmer * 0.42);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const north = new THREE.Mesh(curtainGeo, auroraMat);
    north.position.y = EARTH_RADIUS * 0.99;

    const south = new THREE.Mesh(curtainGeo, auroraMat);
    south.rotation.x = Math.PI;
    south.position.y = -EARTH_RADIUS * 0.99;

    group.add(north, south);
    return group;
  }

  private buildMagnetosphere(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const longitudes = 10;
    const shells = [3.1, 4.0];

    for (const L of shells) {
      for (let i = 0; i < longitudes; i++) {
        const azimuth = (i / longitudes) * Math.PI * 2;
        const pts: THREE.Vector3[] = [];
        const steps = 32;
        for (let s = 0; s <= steps; s++) {
          const lat = -1.18 + (s / steps) * 2.36;
          const r = Math.max(EARTH_RADIUS * 0.95, L * Math.cos(lat) * Math.cos(lat));
          const x = r * Math.cos(lat) * Math.cos(azimuth);
          const y = r * Math.sin(lat);
          const z = r * Math.cos(lat) * Math.sin(azimuth);
          pts.push(new THREE.Vector3(x, y, z));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.011, 5, false);
        const line = new THREE.Mesh(tubeGeo, mat);
        group.add(line);
      }
    }

    return group;
  }

  private buildLocationPin(): THREE.Group {
    const group = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.003, 0.085, 10),
      new THREE.MeshBasicMaterial({ color: '#e0a43b' })
    );
    stem.position.y = 0.0425;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 14, 14),
      new THREE.MeshStandardMaterial({
        color: '#e0a43b',
        emissive: '#d97706',
        emissiveIntensity: 1.35,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    head.position.y = 0.09;

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.022, 0.031, 24),
      new THREE.MeshBasicMaterial({
        color: '#e0a43b',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.005;

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.042, 0.05, 28),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      })
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.004;

    group.add(stem, head, innerRing, outerRing);
    return group;
  }

  private buildLandmarks(): void {
    EARTH_LANDMARKS.forEach((lm) => {
      const pos = latLonToVector3(lm.lat, lm.lon, EARTH_RADIUS * 1.008);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();

      const pinGroup = new THREE.Group();
      pinGroup.position.set(pos.x, pos.y, pos.z);
      pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const color =
        lm.category === 'Tectonic'
          ? '#f97316'
          : lm.category === 'Oceanic'
            ? '#38bdf8'
            : lm.category === 'Atmospheric'
              ? '#e0a43b'
              : lm.category === 'Impact'
                ? '#f43f5e'
                : '#a78bfa';

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      stem.position.y = 0.045;

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 12, 12),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.9,
          roughness: 0.25,
          metalness: 0.2,
        })
      );
      core.position.y = 0.095;

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.042, 0.056, 20),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;

      // Invisible generous click collider
      const hitProxy = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitProxy.position.y = 0.07;
      hitProxy.userData = { kind: 'landmark', id: lm.id };
      this.interactables.push(hitProxy);

      pinGroup.add(stem, core, ring, hitProxy);
      this.landmarksGroup.add(pinGroup);
      this.landmarkPins.set(lm.id, { group: pinGroup, ring, core });
    });
  }

  private rebuildCutawayGeometries(wedgeDegrees: number): void {
    const quantized = Math.round(wedgeDegrees * 2) / 2;
    if (Math.abs(quantized - this.currentCutawayDeg) < 0.25) return;
    this.currentCutawayDeg = quantized;

    const { phiStart, phiLength, faceOneAngle, faceTwoAngle, openingRadians } =
      computeCutawayAngles(quantized);

    const wSeg = 76;
    const hSeg = 50;

    INTERIOR_LAYERS.forEach((layer) => {
      if (layer.id === 'inner-core') return; // Solid full sphere in the center
      const mesh = this.interiorMeshes.get(layer.id);
      if (!mesh) return;
      const oldGeo = mesh.geometry;
      mesh.geometry = new THREE.SphereGeometry(
        layer.radiusRatio * EARTH_RADIUS,
        layer.id === 'crust' ? 84 : wSeg,
        layer.id === 'crust' ? 56 : hSeg,
        phiStart,
        phiLength
      );
      oldGeo.dispose();
    });

    // Sync clouds & tectonic overlays with cutaway opening so interior isn't occluded
    const oldCloudGeo = this.cloudsMesh.geometry;
    this.cloudsMesh.geometry = new THREE.SphereGeometry(
      EARTH_RADIUS * 1.011,
      84,
      56,
      phiStart,
      phiLength
    );
    oldCloudGeo.dispose();

    const oldTecGeo = this.tectonicMesh.geometry;
    this.tectonicMesh.geometry = new THREE.SphereGeometry(
      EARTH_RADIUS * 1.007,
      wSeg,
      hSeg,
      phiStart,
      phiLength
    );
    oldTecGeo.dispose();

    const showCaps = openingRadians > 0.02 && this.smoothExplode < 0.12;
    this.sliceCapOne.visible = showCaps;
    this.sliceCapTwo.visible = showCaps;
    if (showCaps) {
      this.sliceCapOne.rotation.y = faceOneAngle + Math.PI;
      this.sliceCapTwo.rotation.y = faceTwoAngle + Math.PI;
    }
  }

  private loadActiveLeafletLayer(layerId: LeafletBaseLayerId, showLabels: boolean): void {
    this.cancelLeafletLoad();
    window.clearTimeout(this.leafletRetryTimer);
    this.cancelDetailPatchLoad();
    this.requestedDetailPatchKey = '';
    this.leafletLayerPending = true;
    // Keep any previously displayed map in place while the new selection loads.
    this.cancelLeafletLoad = loadLeafletGlobeTexture(layerId, showLabels, this.maxAniso, (res) => {
      if (this.disposed) return;
      this.leafletLayerPending = false;
      this.leafletTex = res;
      this.detailPatchMesh.visible = false;
      this.activeDetailPatchKey = '';
      this.detailUniforms.uBaseMap.value = res.map;
      this.callbacks.onGlobeImageryError(false);
      this.updateSurfaceForEra();
    }, () => {
      if (this.disposed) return;
      this.callbacks.onGlobeImageryError(true);
      // Retry without flashing a procedural or low-resolution globe.
      this.leafletRetryTimer = window.setTimeout(() => {
        this.loadActiveLeafletLayer(layerId, showLabels);
      }, 15000);
    });
  }

  private revealGlobe(): void {
    if (this.globeReady) return;
    this.globeReady = true;
    this.earthTiltGroup.visible = true;
    this.callbacks.onGlobeImageryError(false);
  }

  private applyDetailPatch(patch: LeafletDetailPatchResult): void {
    if (this.disposed || !isModernGlobeView(this.state.mode, this.state.selectedHistory) || this.state.cutawayDegrees > 1) return;
    if (patch.key === this.activeDetailPatchKey && this.detailPatchMesh.visible) return;

    this.activeDetailPatchKey = patch.key;
    const { latNorth, latSouth, lonWest, lonEast } = patch.bounds;
    this.detailUniforms.uPatchOffset.value.set((lonWest + 180) / 360, (latSouth + 90) / 180);
    this.detailUniforms.uPatchScale.value.set((lonEast - lonWest) / 360, (latNorth - latSouth) / 180);
    const phiStart = (lonWest * Math.PI) / 180 + Math.PI;
    const phiLength = ((lonEast - lonWest) * Math.PI) / 180;
    const thetaStart = Math.PI / 2 - (latNorth * Math.PI) / 180;
    const thetaLength = ((latNorth - latSouth) * Math.PI) / 180;

    const oldGeo = this.detailPatchMesh.geometry;
    this.detailPatchMesh.geometry = new THREE.SphereGeometry(
      EARTH_RADIUS * 1.0018,
      64,
      48,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );
    oldGeo.dispose();

    const isSatellite = this.state.leafletBaseLayer === 'satellite';
    this.detailPatchMat.map = patch.map;
    this.detailPatchMat.roughness = isSatellite ? 0.85 : 0.92;
    this.detailPatchMat.needsUpdate = true;
    this.detailPatchMesh.visible = true;
    this.revealGlobe();
  }

  public updateState(next: SceneControlState): void {
    const wasPaused = this.state.paused;
    const prevMode = this.state.mode;
    const prevEra = this.state.selectedHistory;
    const prevDossier = this.state.dossierOpen;
    const prevLeafletLayer = this.state.leafletBaseLayer;
    const prevLeafletLabels = this.state.showLeafletLabels;
    const wasModernGlobe = isModernGlobeView(prevMode, prevEra);
    const modernGlobe = isModernGlobeView(next.mode, next.selectedHistory);
    this.state = { ...next };
    if (!wasModernGlobe && modernGlobe) {
      // Wait for the current hemisphere's detail before showing the globe,
      // instead of flashing the global-only map on entry to either modern view.
      this.globeReady = false;
      this.lastDetailTileTrigger = 0;
    }
    if (prevMode !== next.mode || wasModernGlobe !== modernGlobe) {
      const ratio = getRenderPixelRatio(modernGlobe ? 'systems' : next.mode, window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches, this.isSoftwareGl);
      if (this.renderer.getPixelRatio() !== ratio) this.renderer.setPixelRatio(ratio);
    }
    if (wasPaused && !next.paused && !this.documentHidden) this.wakePausedLoop?.();

    this.applyStateToScene();

    // Immediately close cutaway geometry when leaving Interior mode so no slice seam lingers
    if (next.mode !== 'interior' && next.cutawayDegrees === 0 && (this.smoothCutawayDeg > 0 || this.currentCutawayDeg > 0)) {
      this.smoothCutawayDeg = 0;
      this.smoothExplode = 0;
      this.sliceCapOne.visible = false;
      this.sliceCapTwo.visible = false;
      this.rebuildCutawayGeometries(0);
    }

    if (prevLeafletLayer !== next.leafletBaseLayer || prevLeafletLabels !== next.showLeafletLabels) {
      this.loadActiveLeafletLayer(next.leafletBaseLayer, next.showLeafletLabels);
    }

    if (prevEra !== next.selectedHistory || prevMode !== next.mode) {
      this.updateSurfaceForEra();
      if (next.mode === 'history' && next.selectedHistory === 'paleozoic') {
        // Put the Pangaea-facing hemisphere in view when this era is selected,
        // without changing the user's camera, spin setting, or other era maps.
        const cameraInGlobe = this.earthSpinGroup.worldToLocal(this.camera.position.clone());
        const { lon } = vector3ToLatLon(cameraInGlobe.x, cameraInGlobe.y, cameraInGlobe.z);
        this.textures.getHistoryMap('paleozoic').offset.x = (-15 - lon) / 360;
      }
    }

    if (prevDossier !== next.dossierOpen) {
      this.updateCameraOffsetForDossier();
    }
  }

  private beginCameraFlight(durationMs = 950): void {
    _camStartDir.copy(this.camera.position).normalize();
    _camGoalDir.copy(_camGoalPos).normalize();
    this.camStartRadius = Math.max(EARTH_RADIUS + 0.42, this.camera.position.length());
    this.camGoalRadius = Math.max(EARTH_RADIUS + 0.45, _camGoalPos.length());
    _camStartTarget.copy(this.controls.target);

    const dot = _camStartDir.dot(_camGoalDir);
    if (dot < -0.999) {
      // Opposite hemispheres: pick clean orthogonal axis for 180° great-circle arc
      _camAntipodalAxis.set(0, 1, 0);
      if (Math.abs(_camStartDir.y) > 0.9) _camAntipodalAxis.set(1, 0, 0);
      _camAntipodalAxis.crossVectors(_camStartDir, _camAntipodalAxis).normalize();
      _camSlerpQuat.setFromAxisAngle(_camAntipodalAxis, Math.PI);
    } else {
      _camSlerpQuat.setFromUnitVectors(_camStartDir, _camGoalDir);
    }

    this.camAnimStartMs = performance.now();
    this.camAnimDurationMs = durationMs;
    this.cameraAnimating = true;
  }

  private updateCameraOffsetForDossier(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const targetX = this.state.dossierOpen && width >= 1024 ? 0.58 : 0;
    _camGoalTarget.set(targetX, -0.22, 0);
    _camGoalPos.copy(this.camera.position);
    this.beginCameraFlight(550);
  }

  private updateSurfaceForEra(): void {
    const crustMat = this.interiorMaterials.get('crust');
    if (!crustMat) return;

    const eraId = this.state.mode === 'history' ? this.state.selectedHistory : 'cenozoic';
    const era = HISTORY_ERAS.find((e) => e.id === eraId) ?? HISTORY_ERAS[5];
    const isModern = eraId === 'cenozoic';
    const isSatellite = this.state.leafletBaseLayer === 'satellite';
    const crust = this.interiorMeshes.get('crust');
    if (eraId === 'hadean') {
      this.hadeanMaterial ??= createHadeanMaterial();
      if (crust) crust.material = this.hadeanMaterial;
    } else if (crust) {
      crust.material = crustMat;
    }

    if (eraId === 'hadean') {
      // The animated material replaces the static historical map only for Hadean.
      this.nightUniforms.uUseNightLights.value = 0.0;
    } else if (isModern && this.leafletTex) {
      crustMat.map = this.leafletTex.map;
      crustMat.roughnessMap = isSatellite ? this.leafletTex.roughnessMap : null;
      crustMat.bumpMap = isSatellite ? (this.photoMaps?.derivedBumpMap ?? this.textures.bumpMap) : null;
      crustMat.bumpScale = isSatellite ? 0.045 : 0;
      crustMat.roughness = isSatellite ? 0.85 : 0.92;
      this.nightUniforms.uUseNightLights.value = isSatellite && this.photoMaps ? 0.75 : 0.0;
    } else if (isModern && this.photoMaps) {
      crustMat.map = this.photoMaps.dayMap;
      crustMat.roughnessMap = this.photoMaps.derivedRoughnessMap;
      crustMat.bumpMap = this.photoMaps.derivedBumpMap;
      crustMat.bumpScale = 0.05;
      crustMat.roughness = 0.85;
      this.nightUniforms.uUseNightLights.value = 1.0;
    } else {
      crustMat.map = this.textures.getHistoryMap(eraId);
      // Modern-continent relief would leave misleading shapes on historical maps.
      const isAncientContinents = eraId === 'paleozoic' || eraId === 'mesozoic';
      crustMat.roughnessMap = isAncientContinents ? null : this.textures.roughnessMap;
      crustMat.bumpMap = isAncientContinents ? null : this.textures.bumpMap;
      crustMat.bumpScale = isAncientContinents ? 0 : 0.03;
      crustMat.roughness = eraId === 'proterozoic' ? 0.52 : 0.85;
      this.nightUniforms.uUseNightLights.value = 0.0;
    }

    crustMat.emissive.set(eraId === 'hadean' ? '#ea580c' : '#000000');
    crustMat.emissiveIntensity = eraId === 'hadean' ? 0.42 : 0;
    crustMat.needsUpdate = true;

    // Tint primary atmosphere halo subtly for Archean/Hadean
    const tropMat = this.atmosphereMaterials.get('troposphere');
    if (tropMat) {
      tropMat.uniforms.uColor.value.set(
        this.state.mode === 'history' ? era.atmosphereTint : '#38bdf8'
      );
    }
    const haloMat = this.rayleighHaloMesh.material as THREE.ShaderMaterial;
    haloMat.uniforms.uColor.value.set(
      this.state.mode === 'history' ? era.atmosphereTint : '#38bdf8'
    );
  }

  private applyStateToScene(): void {
    // Only present-day globe views wait for their final satellite imagery.
    this.earthTiltGroup.visible = !isModernGlobeView(this.state.mode, this.state.selectedHistory) || this.globeReady;
    this.cloudsMesh.visible =
      this.state.showClouds &&
      !(this.state.mode === 'history' && this.state.selectedHistory === 'hadean');
    this.tectonicMesh.visible = this.state.showTectonics && this.state.mode !== 'history';
    this.magnetosphereGroup.visible = this.state.showMagnetosphere;
    this.landmarksGroup.visible =
      this.state.mode === 'systems' &&
      this.state.showLandmarks &&
      this.state.cutawayDegrees < 10;

    // Highlight selected interior layer
    INTERIOR_LAYERS.forEach((layer) => {
      const mat = this.interiorMaterials.get(layer.id);
      if (!mat) return;
      const isSelected = this.state.mode === 'interior' && this.state.selectedInterior === layer.id;
      if (layer.id === 'inner-core') {
        mat.emissiveIntensity = isSelected ? 2.1 : 1.45;
      } else if (layer.id === 'outer-core') {
        mat.emissiveIntensity = isSelected ? 1.35 : 0.78;
      } else if (layer.id !== 'crust') {
        mat.emissiveIntensity = isSelected ? 0.8 : 0.32;
      }
    });

    // Show atmospheric layers in Atmosphere, without the bands in other views.
    const atmoMode = this.state.mode === 'atmosphere';
    const hideAtmosphereBands = !atmoMode;
    this.rayleighHaloMesh.visible = !hideAtmosphereBands;
    ATMOSPHERE_LAYERS.forEach((layer, idx) => {
      const mesh = this.atmosphereMeshes.get(layer.id);
      const mat = this.atmosphereMaterials.get(layer.id);
      if (!mesh || !mat) return;

      if (atmoMode) {
        mesh.visible = true;
        const isSelected = this.state.selectedAtmosphere === layer.id;
        mat.uniforms.uIntensity.value = isSelected ? 1.85 : 0.52;
        mat.uniforms.uPower.value = isSelected ? 2.1 : 3.4;
        mat.uniforms.uOpacity.value = isSelected ? 1.0 : 0.55;
      } else {
        mesh.visible = false;
        mat.uniforms.uIntensity.value = idx === 0 ? 1.05 : 0.45;
        mat.uniforms.uPower.value = idx === 0 ? 3.4 : 4.2;
        mat.uniforms.uOpacity.value = idx === 0 ? 0.85 : 0.35;
      }
    });

    // Hide the polar aurora curtains in 3D Globe and Atmosphere only.
    this.auroraGroup.visible =
      this.state.mode !== 'systems' && !atmoMode && this.state.showMagnetosphere;
    this.spaceObjects.satellitesRoot.visible =
      (atmoMode &&
        (this.state.selectedAtmosphere === 'thermosphere' ||
          this.state.selectedAtmosphere === 'exosphere')) ||
      (this.state.mode === 'systems' && this.state.showSatellites);
    this.spaceObjects.asteroidsRoot.visible =
      this.state.mode === 'systems' && this.state.showAsteroids;

    if (!isModernGlobeView(this.state.mode, this.state.selectedHistory) || this.state.cutawayDegrees > 1) {
      this.detailPatchMesh.visible = false;
      if (this.requestedDetailPatchKey) {
        this.cancelDetailPatchLoad();
        this.requestedDetailPatchKey = '';
      }
    }

    // Update Google-Earth click-to-inspect target pin
    if (this.state.inspectedCoords && this.state.mode === 'systems' && this.state.cutawayDegrees < 5) {
      const { lat, lon } = this.state.inspectedCoords;
      const pos = latLonToVector3(lat, lon, EARTH_RADIUS * 1.003);
      const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
      this.locationPinGroup.position.set(pos.x, pos.y, pos.z);
      this.locationPinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const camDist = this.camera.position.length();
      const pinScale = THREE.MathUtils.clamp((camDist - EARTH_RADIUS) * 0.34, 0.24, 0.82);
      this.locationPinGroup.scale.setScalar(pinScale);
      this.locationPinGroup.visible = true;
    } else {
      this.locationPinGroup.visible = false;
    }

    // Highlight selected landmark pin
    this.landmarkPins.forEach(({ core, ring }, id) => {
      const active = this.state.selectedLandmarkId === id;
      core.scale.setScalar(active ? 1.5 : 1.0);
      ring.scale.setScalar(active ? 1.6 : 1.0);
    });
  }

  public focusCameraPreset(
    preset: 'reset' | 'cutaway' | 'atmosphere' | 'systems' | 'landmark' | 'location',
    latLon?: { lat: number; lon: number },
    distanceOverride?: number
  ): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const isCloseTarget = preset === 'location' || preset === 'landmark';
    if (isCloseTarget) {
      this.state.autoRotate = false;
    }
    const targetX = !isCloseTarget && this.state.dossierOpen && width >= 1024 ? 0.52 : 0;
    const targetY = isCloseTarget ? 0 : -0.22;
    _camGoalTarget.set(targetX, targetY, 0);

    if (preset === 'cutaway') {
      // Frame the cutaway quadrant directly in front-right +X/+Z
      _camGoalPos.copy(fitCameraToWidth(CUTAWAY_CAMERA_POSITION.clone(), width / height));
      this.earthSpinGroup.rotation.y = 0;
    } else if (preset === 'atmosphere') {
      _camGoalPos.copy(fitCameraToWidth(ATMOSPHERE_CAMERA_POSITION.clone(), width / height));
    } else if (preset === 'systems') {
      _camGoalPos.copy(fitCameraToWidth(SYSTEMS_CAMERA_POSITION.clone(), width / height));
    } else if ((preset === 'landmark' || preset === 'location') && latLon) {
      const dist = Math.max(2.48, distanceOverride ?? (preset === 'location' ? 2.68 : 4.2));
      const v = latLonToVector3(latLon.lat, latLon.lon, dist);
      const localVec = new THREE.Vector3(v.x, v.y, v.z);
      localVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.earthSpinGroup.rotation.y);
      localVec.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.earthTiltGroup.rotation.z);
      _camGoalPos.copy(localVec);
    } else {
      _camGoalPos.copy(getHomeCameraPosition(width / height));
    }

    this.beginCameraFlight(isCloseTarget ? 1050 : 800);
  }

  private bindEvents(): void {
    const canvas = this.renderer.domElement;

    const onResize = () => {
      if (this.disposed) return;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      // Before the user takes control, keep the opening framing fitted to the
      // current screen (e.g. rotating a phone to portrait zooms back out).
      if (!this.userHasInteracted && !this.cameraAnimating) {
        this.camera.position.copy(getHomeCameraPosition(w / h));
      }
      const qualityMode = isModernGlobeView(this.state.mode, this.state.selectedHistory) ? 'systems' : this.state.mode;
      this.renderer.setPixelRatio(getRenderPixelRatio(qualityMode, window.devicePixelRatio, window.matchMedia('(pointer: coarse)').matches, this.isSoftwareGl));
      this.renderer.setSize(w, h);
      if (!this.state.paused && !this.documentHidden) this.renderer.render(this.scene, this.camera);
    };
    const onVisibilityChange = () => {
      this.documentHidden = document.hidden;
      if (!this.documentHidden && !this.state.paused) this.wakePausedLoop?.();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onPointerDown = (e: PointerEvent) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return; // Dragging camera, not clicking

      const rect = canvas.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(_rayMouse, this.camera);

      const hits = this.raycaster
        .intersectObjects(this.interactables, false)
        .filter((h) => isObjectEffectivelyVisible(h.object));

      if (hits.length > 0) {
        // Prioritize pins, satellites, and asteroids before falling back to crust surface click
        const specialHit = hits.find(
          (h) =>
            h.object.userData?.kind === 'landmark' ||
            h.object.userData?.kind === 'satellite' ||
            h.object.userData?.kind === 'asteroid'
        );
        if (specialHit) {
          const { kind, id } = specialHit.object.userData;
          if (kind === 'landmark') {
            this.callbacks.onSelectLandmark(id);
            return;
          }
          if (kind === 'satellite' || kind === 'asteroid') {
            this.callbacks.onSelectSpaceObject({ kind, id });
            return;
          }
        }

        const primary = hits[0];
        if (primary.object.userData?.kind === 'interior') {
          if (this.state.mode === 'interior') {
            this.callbacks.onSelectInterior(primary.object.userData.id);
            return;
          }
          if (primary.object.userData.id === 'crust' && this.state.mode === 'systems') {
            _localHit.copy(primary.point);
            this.earthSpinGroup.worldToLocal(_localHit);
            const coords = vector3ToLatLon(_localHit.x, _localHit.y, _localHit.z);
            this.callbacks.onInspectLocation(coords);
            return;
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - this.lastHoverCheck < 75) return;
      this.lastHoverCheck = now;

      const rect = canvas.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(_rayMouse, this.camera);

      const crust = this.interiorMeshes.get('crust');
      const hits = crust && isObjectEffectivelyVisible(crust) ? this.raycaster.intersectObject(crust, false) : [];
      if (hits.length > 0) {
        _localHit.copy(hits[0].point);
        this.earthSpinGroup.worldToLocal(_localHit);
        const coords = vector3ToLatLon(_localHit.x, _localHit.y, _localHit.z);
        this.callbacks.onHoverCoords(coords);
        canvas.style.cursor = 'crosshair';
      } else {
        this.callbacks.onHoverCoords(null);
        canvas.style.cursor = 'grab';
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('webglcontextlost', onContextLost);

    this.cleanupListeners = () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('webglcontextlost', onContextLost);
    };
  }

  private cleanupListeners: () => void = () => {};

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
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

  private startLoop(): void {
    if (this.loopRunning || this.disposed) return;
    this.loopRunning = true;

    const tick = () => {
      if (this.disposed) {
        this.loopRunning = false;
        return;
      }

      if (this.state.paused || this.documentHidden) {
        this.lastMs = performance.now();
        this.frameId = window.setTimeout(tick, 220);
        this.wakePausedLoop = () => {
          window.clearTimeout(this.frameId);
          this.wakePausedLoop = null;
          this.frameId = requestAnimationFrame(tick);
        };
        return;
      }
      this.wakePausedLoop = null;

      const now = performance.now();
      const delta = Math.min((now - this.lastMs) / 1000, 0.1);
      this.lastMs = now;
      const elapsed = (now - this.startMs) / 1000;
      if (this.state.mode === 'history' && this.state.selectedHistory === 'hadean' && this.hadeanMaterial) {
        this.hadeanMaterial.uniforms.uTime.value += delta;
      }

      // Smooth cutaway wedge & explosion transitions
      this.smoothCutawayDeg = THREE.MathUtils.damp(
        this.smoothCutawayDeg,
        this.state.cutawayDegrees,
        14.0,
        delta
      );
      if (Math.abs(this.smoothCutawayDeg - this.state.cutawayDegrees) < 0.6) {
        this.smoothCutawayDeg = this.state.cutawayDegrees;
      }
      this.smoothExplode = THREE.MathUtils.damp(
        this.smoothExplode,
        this.state.explodeFactor,
        11.0,
        delta
      );

      if (Math.abs(this.smoothCutawayDeg - this.currentCutawayDeg) > 0.25) {
        this.rebuildCutawayGeometries(this.smoothCutawayDeg);
      }

      // Apply exploded offsets to interior shells
      INTERIOR_LAYERS.forEach((layer) => {
        const mesh = this.interiorMeshes.get(layer.id);
        if (!mesh) return;
        const offset = getExplodedOffset(layer.order, this.smoothExplode);
        const dir = layer.order === 0 ? 0 : 1;
        // Shift outer shells gently along the cutaway axis so all 5 concentric layers separate clearly
        mesh.position.set(-offset * 0.55 * dir, offset * 0.25 * dir, offset * 0.45 * dir);
      });

      const crust = this.interiorMeshes.get('crust');
      if (crust) alignCloudShell(this.cloudsMesh, crust);

      const hideCaps = this.smoothExplode >= 0.12 || this.smoothCutawayDeg <= 2.0;
      this.sliceCapOne.visible = !hideCaps;
      this.sliceCapTwo.visible = !hideCaps;

      // Smooth axial tilt (23.44° when whole globe, 11.5° in cutaway/other views)
      const modernGlobeView = isModernGlobeView(this.state.mode, this.state.selectedHistory);
      const targetTilt = modernGlobeView ? (23.44 * Math.PI) / 180 : (11.5 * Math.PI) / 180;
      this.smoothTiltRad = THREE.MathUtils.damp(this.smoothTiltRad, targetTilt, 6, delta);
      this.earthTiltGroup.rotation.z = -this.smoothTiltRad;

      // Planetary rotation & drifting clouds & orbiting satellites + asteroids
      if (this.state.autoRotate && this.state.cutawayDegrees < 5 && (!modernGlobeView || this.globeReady)) {
        this.earthSpinGroup.rotation.y += delta * 0.085;
      }
      this.cloudDrift = advanceCloudDrift(this.cloudDrift, delta);
      applyCloudDrift(this.cloudsMesh.material as THREE.MeshStandardMaterial, this.cloudDrift);
      this.spaceObjects.update(delta, elapsed);

      // Smooth spherical great-circle camera transition (always finishes on schedule across hemispheres)
      if (this.cameraAnimating) {
        const rawT = Math.min(1, (now - this.camAnimStartMs) / Math.max(1, this.camAnimDurationMs));
        const ease = 1 - Math.pow(1 - rawT, 3);

        _camStepQuat.identity().slerp(_camSlerpQuat, ease);
        _camCurrDir.copy(_camStartDir).applyQuaternion(_camStepQuat).normalize();
        const nextR = THREE.MathUtils.lerp(this.camStartRadius, this.camGoalRadius, ease);
        this.camera.position.copy(_camCurrDir).multiplyScalar(nextR);
        this.controls.target.lerpVectors(_camStartTarget, _camGoalTarget, ease);

        if (rawT >= 1) {
          this.camera.position.copy(_camGoalPos);
          this.controls.target.copy(_camGoalTarget);
          this.cameraAnimating = false;
          // Force immediate altitude/zoom telemetry & high-res Leaflet patch refresh on arrival
          this.lastZoomCheck = 0;
          this.lastDetailTileTrigger = 0;
        }
      } else {
        // When user zooms in manually close to the globe, gradually center target so camera never grazes crust
        const distFromCenter = this.camera.position.length();
        const zoomBlend = THREE.MathUtils.clamp((distFromCenter - 3.0) / 1.4, 0, 1);
        const width = this.container.clientWidth || window.innerWidth;
        const desiredTargetX = (this.state.dossierOpen && width >= 1024 ? 0.52 : 0) * zoomBlend;
        const desiredTargetY = -0.22 * zoomBlend;
        _camTargetOffset.set(desiredTargetX, desiredTargetY, 0);
        this.controls.target.lerp(_camTargetOffset, 1 - Math.exp(-6.0 * delta));
      }

      // Google-Earth zoom-adaptive rotate speed, pin scale & live center location/tile patch check
      const postFlightDist = this.camera.position.length();
      this.controls.rotateSpeed = Math.max(
        0.18,
        Math.min(0.85, (postFlightDist - EARTH_RADIUS) * 0.28)
      );
      if (this.locationPinGroup.visible) {
        const pinScale = THREE.MathUtils.clamp(
          (postFlightDist - EARTH_RADIUS) * 0.34,
          0.24,
          0.82
        );
        this.locationPinGroup.scale.setScalar(pinScale);
      }
      if (now - this.lastZoomCheck > 320 && modernGlobeView) {
        this.lastZoomCheck = now;
        const { leafletZoom, altitudeKm } = cameraDistanceToZoomAndAltitudeKm(
          postFlightDist,
          EARTH_RADIUS
        );
        _centerRayDir.copy(this.camera.position).normalize().multiplyScalar(EARTH_RADIUS);
        this.earthSpinGroup.worldToLocal(_centerRayDir);
        const centerCoords = vector3ToLatLon(_centerRayDir.x, _centerRayDir.y, _centerRayDir.z);

        const zoomKey = `${leafletZoom}:${Math.round(altitudeKm / 120)}:${centerCoords.lat.toFixed(1)},${centerCoords.lon.toFixed(1)}`;
        if (this.state.mode === 'systems' && zoomKey !== this.lastReportedZoomKey) {
          this.lastReportedZoomKey = zoomKey;
          this.callbacks.onCameraZoomUpdate({ centerCoords, altitudeKm, leafletZoom });
        }

        const detailZoom = getGlobeDetailZoom(postFlightDist, leafletZoom);
        const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
        const widePatch = this.state.leafletBaseLayer === 'satellite' && detailZoom === 4 && !saveData && !this.isSoftwareGl && this.renderer.capabilities.maxTextureSize >= 1536;
        const patchSize: 4 | 6 = widePatch ? 6 : 4;
        // Other map providers, Data Saver and software rendering retain the cheaper
        // global view until zoomed in rather than prefetching at the opening view.
        const detailEnabled = (this.state.leafletBaseLayer === 'satellite' && !saveData && !this.isSoftwareGl) || postFlightDist <= 5.4;
        if (this.leafletLayerPending) {
          // Keep the previously displayed selection unchanged during a reload.
        } else if (detailEnabled && this.leafletTex && detailZoom >= 4 && this.state.cutawayDegrees <= 1) {
          const key = getDetailPatchKey(this.state.leafletBaseLayer, this.state.showLeafletLabels, centerCoords.lat, centerCoords.lon, detailZoom, patchSize);
          // Do not cancel and restart the same tile request every frame check.
          if (key !== this.requestedDetailPatchKey && now - this.lastDetailTileTrigger > 550) {
            this.lastDetailTileTrigger = now;
            this.cancelDetailPatchLoad();
            this.requestedDetailPatchKey = key;
            this.cancelDetailPatchLoad = loadLeafletDetailPatch(
              this.state.leafletBaseLayer,
              this.state.showLeafletLabels,
              centerCoords.lat,
              centerCoords.lon,
              detailZoom,
              this.maxAniso,
              (patch) => this.applyDetailPatch(patch),
              () => {
                if (this.requestedDetailPatchKey === key) {
                  this.requestedDetailPatchKey = '';
                  if (!this.globeReady) this.callbacks.onGlobeImageryError(true);
                  // Back off after a network failure rather than continuously retrying.
                  this.lastDetailTileTrigger = performance.now() + 14450;
                }
              },
              patchSize
            );
          }
        } else {
          this.detailPatchMesh.visible = false;
          if (this.requestedDetailPatchKey) {
            this.cancelDetailPatchLoad();
            this.requestedDetailPatchKey = '';
          }
          // On Data Saver or software rendering, the final supported quality is
          // the complete global map; no high-resolution patch is requested.
          if (this.leafletTex && !detailEnabled) this.revealGlobe();
        }
      }

      // Subtle inner core thermal shimmer
      this.coreLight.intensity = 2.2 + Math.sin(elapsed * 2.4) * 0.25;

      this.controls.update();

      // Safety guard: guarantee camera never dips inside Earth's crust sphere
      if (this.camera.position.length() < EARTH_RADIUS + 0.36) {
        this.camera.position.setLength(EARTH_RADIUS + 0.36);
      }
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.wakePausedLoop = null;
    this.cancelPhotoLoad();
    this.cancelLeafletLoad();
    window.clearTimeout(this.leafletRetryTimer);
    this.cancelDetailPatchLoad();
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupListeners();
    this.controls.dispose();
    this.textures.disposeAll();
    this.spaceObjects.dispose();
    disposeLeafletTextureCache();
    if (this.photoMaps) {
      this.photoMaps.dayMap.dispose();
      this.photoMaps.nightMap.dispose();
      this.photoMaps.cloudAlphaMap.dispose();
      this.photoMaps.derivedRoughnessMap.dispose();
      this.photoMaps.derivedBumpMap.dispose();
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    // One of these may be detached from the crust when the scene is disposed.
    this.hadeanMaterial?.dispose();
    this.interiorMaterials.get('crust')?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
