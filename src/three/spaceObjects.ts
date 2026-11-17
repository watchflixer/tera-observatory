import * as THREE from 'three';
import { NEAR_EARTH_ASTEROIDS, SPACE_SATELLITES } from '../data/earthData';

export interface SpaceObjectsSystem {
  satellitesRoot: THREE.Group;
  asteroidsRoot: THREE.Group;
  interactables: THREE.Object3D[];
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

interface BeltAsteroidInstance {
  radius: number;
  angle: number;
  speed: number;
  yOffset: number;
  inclination: number;
  rotX: number;
  rotY: number;
  spinX: number;
  spinY: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

const _dummy = new THREE.Object3D();

function createPhotovoltaicTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep silicon photovoltaic midnight blue
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#0c234a');
  grad.addColorStop(0.5, '#133774');
  grad.addColorStop(1, '#091a38');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Crisp solar cell grid & copper/gold busbars
  ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.fillRect(126, 0, 4, 256);
  ctx.fillRect(0, 126, 256, 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createGoldKaptonTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 0, 128, 128);

  // Deterministic metallic thermal-foil facets
  for (let i = 0; i < 180; i++) {
    const x = ((i * 73) % 120);
    const y = ((i * 41) % 120);
    const w = 6 + (i % 10);
    const h = 6 + ((i * 3) % 10);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(254, 240, 138, 0.48)'
        : i % 3 === 1
          ? 'rgba(180, 83, 9, 0.45)'
          : 'rgba(245, 158, 11, 0.45)';
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createAsteroidRegolithTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#78716c';
  ctx.fillRect(0, 0, 256, 256);

  // Fine mineral grain & impact crater shading
  for (let i = 0; i < 420; i++) {
    const x = (i * 97) % 256;
    const y = (i * 53) % 256;
    const r = 1 + (i % 4);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(41, 37, 36, 0.32)' : 'rgba(214, 211, 209, 0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let c = 0; c < 18; c++) {
    const cx = 16 + ((c * 67) % 224);
    const cy = 16 + ((c * 113) % 224);
    const cr = 6 + (c % 14);
    const grad = ctx.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr);
    grad.addColorStop(0, 'rgba(28, 25, 23, 0.55)');
    grad.addColorStop(0.75, 'rgba(87, 83, 78, 0.25)');
    grad.addColorStop(1, 'rgba(214, 211, 209, 0.38)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates an irregular, cratered, bilobed/faceted procedural rocky asteroid BufferGeometry.
 */
function createCrateredAsteroidGeometry(
  baseRadius: number,
  seed: number,
  detail = 2,
  elongation: [number, number, number] = [1.35, 0.85, 1.0]
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(baseRadius, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  // Deterministic crater centers
  const craters = [
    new THREE.Vector3(Math.sin(seed * 1.3), Math.cos(seed * 2.1), Math.sin(seed * 0.7)).normalize(),
    new THREE.Vector3(Math.cos(seed * 2.9), -Math.sin(seed * 1.7), Math.cos(seed * 1.1)).normalize(),
    new THREE.Vector3(-Math.sin(seed * 0.9), Math.cos(seed * 3.1), -Math.sin(seed * 2.3)).normalize(),
  ];

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // Multi-frequency rocky ridge displacement
    const n1 = Math.sin(dir.x * 3.1 + seed) * Math.cos(dir.y * 2.7 - seed * 0.5);
    const n2 = Math.sin(dir.z * 5.2 + dir.x * 3.7 + seed * 1.7) * 0.45;
    const n3 = Math.cos(dir.y * 8.4 - dir.z * 6.1 + seed) * 0.2;
    let disp = 1.0 + n1 * 0.18 + n2 * 0.12 + n3 * 0.08;

    // Carve subtle impact crater bowls + raised rims
    for (const c of craters) {
      const ang = dir.angleTo(c);
      if (ang < 0.52) {
        const t = ang / 0.52;
        const bowl = -0.22 * (1 - t * t);
        const rim = 0.07 * Math.exp(-Math.pow((t - 0.85) / 0.15, 2));
        disp += bowl + rim;
      }
    }

    v.multiplyScalar(disp);
    v.set(v.x * elongation[0], v.y * elongation[1], v.z * elongation[2]);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

function buildParabolicDishGeometry(radius: number, depth: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = t * radius;
    const y = t * t * depth;
    pts.push(new THREE.Vector2(r, y));
  }
  return new THREE.LatheGeometry(pts, 18);
}

/**
 * 12-part International Space Station (ISS) composite group.
 */
function buildDetailedISS(
  solarMat: THREE.MeshStandardMaterial,
  metalMat: THREE.MeshStandardMaterial,
  moduleMat: THREE.MeshStandardMaterial,
  radiatorMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial
): THREE.Group {
  const iss = new THREE.Group();

  // Integrated main truss backbone + structural ribs
  const truss = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.34), metalMat);
  iss.add(truss);

  for (const zOff of [-0.11, -0.04, 0.04, 0.11]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.024, 0.01), goldMat);
    brace.position.z = zOff;
    iss.add(brace);
  }

  // Pressurized habitat & lab core (Destiny, Harmony, Zvezda)
  const coreHab = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.17, 14), moduleMat);
  coreHab.rotation.z = Math.PI / 2;
  iss.add(coreHab);

  // Cross-axis Columbus & Kibo lab modules
  const crossLab = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.095, 12), moduleMat);
  crossLab.rotation.x = Math.PI / 2;
  crossLab.position.set(0.035, 0, 0);
  iss.add(crossLab);

  // Docking node collar rings & Cupola observation dome
  const nodeRing = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.022, 12), metalMat);
  nodeRing.rotation.z = Math.PI / 2;
  nodeRing.position.set(0.035, 0, 0);
  iss.add(nodeRing);

  const cupola = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), goldMat);
  cupola.position.set(-0.048, -0.014, 0);
  iss.add(cupola);

  // 8 articulated photovoltaic solar array wings (4 starboard/port pairs)
  const wingGeo = new THREE.BoxGeometry(0.056, 0.003, 0.042);
  const zPositions = [-0.15, -0.10, 0.10, 0.15];
  for (const zPos of zPositions) {
    for (const xSign of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, solarMat);
      wing.position.set(xSign * 0.044, 0.002, zPos);
      wing.rotation.x = 0.25;
      iss.add(wing);
    }
  }

  // White thermal control radiator wings
  const radGeo = new THREE.BoxGeometry(0.036, 0.0025, 0.058);
  for (const zOff of [-0.042, 0.042]) {
    const rad = new THREE.Mesh(radGeo, radiatorMat);
    rad.position.set(-0.028, 0.014, zOff);
    rad.rotation.y = 0.2;
    iss.add(rad);
  }

  // K-band parabolic comm dish
  const dish = new THREE.Mesh(buildParabolicDishGeometry(0.018, 0.009), radiatorMat);
  dish.position.set(0.02, 0.022, 0);
  iss.add(dish);

  return iss;
}

/**
 * 8-part Hubble Space Telescope composite group.
 */
function buildHubbleModel(
  solarMat: THREE.MeshStandardMaterial,
  silverMat: THREE.MeshStandardMaterial,
  darkMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial
): THREE.Group {
  const hubble = new THREE.Group();

  // Main optical telescope cylinder
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 16), silverMat);
  tube.rotation.z = Math.PI / 2;
  hubble.add(tube);

  // Aft equipment bay collar
  const aftBay = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.042, 16), goldMat);
  aftBay.rotation.z = Math.PI / 2;
  aftBay.position.x = -0.055;
  hubble.add(aftBay);

  // Angled aperture door & recessed mirror rim
  const apertureRim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 18), darkMat);
  apertureRim.rotation.y = Math.PI / 2;
  apertureRim.position.x = 0.07;
  hubble.add(apertureRim);

  const door = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.004, 14), silverMat);
  door.position.set(0.084, 0.018, 0);
  door.rotation.z = -0.55;
  hubble.add(door);

  // Twin articulated photovoltaic wings
  const wingGeo = new THREE.BoxGeometry(0.038, 0.003, 0.11);
  const boomGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.24, 8);
  const boom = new THREE.Mesh(boomGeo, silverMat);
  boom.rotation.x = Math.PI / 2;
  hubble.add(boom);

  const leftWing = new THREE.Mesh(wingGeo, solarMat);
  leftWing.position.set(0, 0, 0.085);
  leftWing.rotation.x = 0.35;
  hubble.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, solarMat);
  rightWing.position.set(0, 0, -0.085);
  rightWing.rotation.x = 0.35;
  hubble.add(rightWing);

  // High-gain antenna mast + dish
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 8), silverMat);
  mast.position.set(-0.02, 0.04, 0);
  hubble.add(mast);

  const dish = new THREE.Mesh(buildParabolicDishGeometry(0.016, 0.008), silverMat);
  dish.position.set(-0.02, 0.065, 0);
  hubble.add(dish);

  return hubble;
}

/**
 * 9-part Gold Kapton Sentinel / GNSS Spacecraft composite group.
 */
function buildGoldSentinelModel(
  solarMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial,
  metalMat: THREE.MeshStandardMaterial,
  radiatorMat: THREE.MeshStandardMaterial
): THREE.Group {
  const sat = new THREE.Group();

  // Hexagonal gold MLI spacecraft bus
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.064, 6), goldMat);
  sat.add(bus);

  // Instrument deck collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.015, 12), metalMat);
  collar.position.y = -0.038;
  sat.add(collar);

  // Earth-pointing parabolic radar dish + feed horn
  const dish = new THREE.Mesh(buildParabolicDishGeometry(0.032, 0.013), radiatorMat);
  dish.rotation.x = Math.PI;
  dish.position.y = -0.048;
  sat.add(dish);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.004, 0.028, 8), metalMat);
  feedHorn.position.y = -0.066;
  sat.add(feedHorn);

  // Top telemetry whip & beacon cap
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.045, 6), metalMat);
  whip.position.y = 0.052;
  sat.add(whip);

  // Solar wing drive yoke + twin solar wings
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.28, 8), metalMat);
  yoke.rotation.x = Math.PI / 2;
  sat.add(yoke);

  const panelGeo = new THREE.BoxGeometry(0.048, 0.0035, 0.115);
  const w1 = new THREE.Mesh(panelGeo, solarMat);
  w1.position.set(0, 0, 0.095);
  w1.rotation.z = 0.3;
  sat.add(w1);

  const w2 = new THREE.Mesh(panelGeo, solarMat);
  w2.position.set(0, 0, -0.095);
  w2.rotation.z = 0.3;
  sat.add(w2);

  return sat;
}

export function createSpaceObjectsSystem(maxAniso: number): SpaceObjectsSystem {
  const satellitesRoot = new THREE.Group();
  const asteroidsRoot = new THREE.Group();
  const interactables: THREE.Object3D[] = [];

  const solarTex = createPhotovoltaicTexture(maxAniso);
  const kaptonTex = createGoldKaptonTexture(maxAniso);
  const regolithTex = createAsteroidRegolithTexture(maxAniso);

  const solarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    metalness: 0.72,
    roughness: 0.18,
    emissive: new THREE.Color('#0c4a6e'),
    emissiveIntensity: 0.25,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.88,
    roughness: 0.25,
  });
  const moduleMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    metalness: 0.55,
    roughness: 0.42,
  });
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    metalness: 0.15,
    roughness: 0.75,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    map: kaptonTex,
    metalness: 0.85,
    roughness: 0.34,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.6,
    roughness: 0.45,
  });

  // 1. Build 3 distinct high-detail satellites on inclined orbits
  const satOrbitGroups: Array<{ group: THREE.Group; speed: number; craft: THREE.Group }> = [];

  SPACE_SATELLITES.forEach((satInfo, idx) => {
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = (satInfo.inclinationDeg * Math.PI) / 180;
    orbitGroup.rotation.z = idx * 0.75;

    // Crisp orbital track ring
    const trackGeo = new THREE.TorusGeometry(satInfo.orbitRadius, 0.0035, 6, 128);
    const trackMat = new THREE.MeshBasicMaterial({
      color: satInfo.accentColor,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = Math.PI / 2;
    orbitGroup.add(track);

    const craft =
      satInfo.id === 'iss'
        ? buildDetailedISS(solarMat, metalMat, moduleMat, radiatorMat, goldMat)
        : satInfo.id === 'hubble'
          ? buildHubbleModel(solarMat, metalMat, darkMat, goldMat)
          : buildGoldSentinelModel(solarMat, goldMat, metalMat, radiatorMat);

    // Subtle navigation beacon marker + click proxy
    const hitProxy = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitProxy.userData = { kind: 'satellite', id: satInfo.id };
    craft.add(hitProxy);
    interactables.push(hitProxy);

    // Position on orbit with staggered initial phase
    const startAngle = idx * 2.1;
    craft.position.set(
      Math.cos(startAngle) * satInfo.orbitRadius,
      0,
      Math.sin(startAngle) * satInfo.orbitRadius
    );
    craft.lookAt(0, 0, 0);

    orbitGroup.add(craft);
    satellitesRoot.add(orbitGroup);
    satOrbitGroups.push({ group: orbitGroup, speed: satInfo.orbitSpeed, craft });
  });

  // 2. Build 4 Hero Named Near-Earth Asteroids + Elliptical Trajectory Arcs
  const heroAsteroids: Array<{
    orbitGroup: THREE.Group;
    rock: THREE.Mesh;
    speed: number;
  }> = [];

  NEAR_EARTH_ASTEROIDS.forEach((ast, idx) => {
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = ast.inclinationRad;
    orbitGroup.rotation.y = ast.nodeAngleRad;

    // Subtle orbital trajectory ellipse ring
    const arcGeo = new THREE.TorusGeometry(ast.orbitRadius, 0.004, 6, 128);
    const arcMat = new THREE.MeshBasicMaterial({
      color: ast.colorHex,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.rotation.x = Math.PI / 2;
    orbitGroup.add(arc);

    const rockGeo = createCrateredAsteroidGeometry(ast.size, idx * 3.7 + 1.1, 2, [
      1.42,
      0.86,
      1.04,
    ]);
    const rockMat = new THREE.MeshStandardMaterial({
      map: regolithTex,
      color: new THREE.Color(ast.colorHex),
      roughness: 0.9,
      metalness: 0.14,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    const phase = idx * 1.65 + 0.4;
    rock.position.set(Math.cos(phase) * ast.orbitRadius, 0, Math.sin(phase) * ast.orbitRadius);

    // Clickable hit proxy
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.18, ast.size * 2.1), 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    proxy.userData = { kind: 'asteroid', id: ast.id };
    rock.add(proxy);
    interactables.push(proxy);

    orbitGroup.add(rock);
    asteroidsRoot.add(orbitGroup);
    heroAsteroids.push({ orbitGroup, rock, speed: ast.speed });
  });

  // 3. Instanced Near-Earth Asteroid & Meteoroid Belt (72 irregular rocks)
  const beltCount = 72;
  const beltGeo = createCrateredAsteroidGeometry(0.048, 9.4, 1, [1.3, 0.82, 1.0]);
  const beltMat = new THREE.MeshStandardMaterial({
    map: regolithTex,
    roughness: 0.92,
    metalness: 0.12,
  });
  const beltMesh = new THREE.InstancedMesh(beltGeo, beltMat, beltCount);
  beltMesh.frustumCulled = false;

  const beltData: BeltAsteroidInstance[] = [];
  const palette = [
    new THREE.Color('#d6d3d1'),
    new THREE.Color('#a8a29e'),
    new THREE.Color('#948d86'),
    new THREE.Color('#c29b6c'),
  ];

  for (let i = 0; i < beltCount; i++) {
    const t = i / beltCount;
    const radius = 4.0 + ((i * 37) % 38) * 0.1;
    const angle = t * Math.PI * 2 + (i % 5) * 0.31;
    const yOffset = (Math.sin(i * 4.3) * 0.65);
    const inclination = Math.cos(i * 2.1) * 0.28;
    const baseScale = 0.55 + ((i * 19) % 10) * 0.09;

    const item: BeltAsteroidInstance = {
      radius,
      angle,
      speed: 0.045 + ((i * 13) % 7) * 0.012,
      yOffset,
      inclination,
      rotX: i * 0.7,
      rotY: i * 1.1,
      spinX: 0.25 + (i % 4) * 0.14,
      spinY: 0.35 + (i % 3) * 0.16,
      scaleX: baseScale * (0.85 + (i % 3) * 0.2),
      scaleY: baseScale * (0.78 + ((i + 1) % 3) * 0.18),
      scaleZ: baseScale * (0.85 + ((i + 2) % 3) * 0.15),
    };
    beltData.push(item);

    _dummy.position.set(
      Math.cos(item.angle) * item.radius,
      item.yOffset + Math.sin(item.angle) * item.inclination,
      Math.sin(item.angle) * item.radius
    );
    _dummy.rotation.set(item.rotX, item.rotY, 0);
    _dummy.scale.set(item.scaleX, item.scaleY, item.scaleZ);
    _dummy.updateMatrix();
    beltMesh.setMatrixAt(i, _dummy.matrix);
    beltMesh.setColorAt(i, palette[i % palette.length]);
  }
  beltMesh.instanceMatrix.needsUpdate = true;
  if (beltMesh.instanceColor) beltMesh.instanceColor.needsUpdate = true;
  beltMesh.computeBoundingSphere();
  asteroidsRoot.add(beltMesh);

  const update = (delta: number, _elapsed: number) => {
    for (const s of satOrbitGroups) {
      s.group.rotation.y += delta * s.speed;
      // Gently align solar panels / craft attitude
      s.craft.lookAt(0, 0, 0);
    }

    for (const h of heroAsteroids) {
      h.orbitGroup.rotation.y += delta * h.speed;
      h.rock.rotation.x += delta * 0.45;
      h.rock.rotation.y += delta * 0.62;
    }

    if (asteroidsRoot.visible) {
      for (let i = 0; i < beltData.length; i++) {
        const b = beltData[i];
        b.angle += delta * b.speed;
        b.rotX += delta * b.spinX;
        b.rotY += delta * b.spinY;
        _dummy.position.set(
          Math.cos(b.angle) * b.radius,
          b.yOffset + Math.sin(b.angle) * b.inclination,
          Math.sin(b.angle) * b.radius
        );
        _dummy.rotation.set(b.rotX, b.rotY, 0);
        _dummy.scale.set(b.scaleX, b.scaleY, b.scaleZ);
        _dummy.updateMatrix();
        beltMesh.setMatrixAt(i, _dummy.matrix);
      }
      beltMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = () => {
    solarTex.dispose();
    kaptonTex.dispose();
    regolithTex.dispose();
    [satellitesRoot, asteroidsRoot].forEach((root) => {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    });
  };

  return {
    satellitesRoot,
    asteroidsRoot,
    interactables,
    update,
    dispose,
  };
}
