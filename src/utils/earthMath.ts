export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CutawayAngles {
  /** Angle in radians where the solid shell starts */
  phiStart: number;
  /** Arc length in radians of the visible solid shell */
  phiLength: number;
  /** Angle in radians of the first cross-section face */
  faceOneAngle: number;
  /** Angle in radians of the second cross-section face */
  faceTwoAngle: number;
  /** Cutout opening in radians */
  openingRadians: number;
}

export const EARTH_MEAN_RADIUS_KM = 6371;

/**
 * Converts geographic latitude/longitude (in degrees) to 3D Cartesian coordinates
 * aligned with Three.js SphereGeometry UV mapping (prime meridian facing +X / +Z).
 */
export function latLonToVector3(latDeg: number, lonDeg: number, radius: number): Vec3 {
  const latRad = (latDeg * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const cosLat = Math.cos(latRad);

  // Matches Three.js SphereGeometry: phi = lon + PI, theta = PI/2 - lat
  // x = -R * cos(phi) * sin(theta), y = R * cos(theta), z = R * sin(phi) * sin(theta)
  const phi = lonRad + Math.PI;
  const theta = Math.PI / 2 - latRad;
  const sinTheta = Math.sin(theta);

  return {
    x: -radius * Math.cos(phi) * sinTheta,
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * sinTheta,
  };
}

/**
 * Converts a normalized 3D point on the unit sphere back to latitude and longitude degrees.
 */
export function vector3ToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len === 0) return { lat: 0, lon: 0 };

  const ny = Math.max(-1, Math.min(1, y / len));
  const lat = (Math.asin(ny) * 180) / Math.PI;

  const phi = Math.atan2(z, -x);
  let lon = ((phi - Math.PI) * 180) / Math.PI;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;

  return { lat, lon };
}

/**
 * Computes Three.js SphereGeometry phiStart & phiLength for a planetary cutaway wedge.
 * Keeps the wedge centered cleanly toward the front-right viewer quadrant when angle > 0.
 */
export function computeCutawayAngles(wedgeDegrees: number): CutawayAngles {
  const clampedDeg = Math.max(0, Math.min(200, wedgeDegrees));
  const openingRadians = (clampedDeg * Math.PI) / 180;

  if (clampedDeg <= 0.1) {
    return {
      phiStart: 0,
      phiLength: Math.PI * 2,
      faceOneAngle: 0,
      faceTwoAngle: 0,
      openingRadians: 0,
    };
  }

  // Center the cutout around phi = 2.35 rad (facing front-right +X/+Z camera quadrant)
  const centerCutPhi = 2.35;
  const faceOneAngle = centerCutPhi + openingRadians / 2;
  const faceTwoAngle = centerCutPhi - openingRadians / 2;
  const phiStart = faceOneAngle;
  const phiLength = Math.PI * 2 - openingRadians;

  return {
    phiStart,
    phiLength,
    faceOneAngle,
    faceTwoAngle,
    openingRadians,
  };
}

/**
 * Computes radial offset for exploded-view shell inspection.
 * Layer 0 = Inner Core (stationary anchor), higher indices expand outward.
 */
export function getExplodedOffset(layerIndex: number, explodeFactor: number): number {
  const clamped = Math.max(0, Math.min(1, explodeFactor));
  if (layerIndex <= 0 || clamped === 0) return 0;
  return layerIndex * 0.24 * clamped;
}

/**
 * US Standard Atmosphere (1976) piecewise-linear temperature model (°C) from 0 to 600 km.
 */
export function interpolateAtmosphereTemp(altitudeKm: number): number {
  const alt = Math.max(0, Math.min(600, altitudeKm));

  if (alt <= 11) {
    // Troposphere: 15°C at sea level -> -56.5°C at 11 km
    return 15 - (alt / 11) * 71.5;
  }
  if (alt <= 20) {
    // Tropopause isothermal: -56.5°C
    return -56.5;
  }
  if (alt <= 47) {
    // Stratosphere ozone heating: -56.5°C -> -2.5°C
    return -56.5 + ((alt - 20) / 27) * 54.0;
  }
  if (alt <= 51) {
    // Stratopause: -2.5°C
    return -2.5;
  }
  if (alt <= 85) {
    // Mesosphere radiative cooling: -2.5°C -> -86.5°C
    return -2.5 - ((alt - 51) / 34) * 84.0;
  }
  if (alt <= 120) {
    // Lower Thermosphere: -86.5°C -> +100°C
    return -86.5 + ((alt - 85) / 35) * 186.5;
  }
  // Upper Thermosphere asymptotic solar EUV heating: +100°C -> +1200°C
  return 100 + ((alt - 120) / 480) * 1100;
}

/**
 * Approximate atmospheric pressure in Pascals using barometric scale height.
 */
export function estimateAtmospherePressurePa(altitudeKm: number): number {
  const alt = Math.max(0, altitudeKm);
  // Scale height varies with altitude, ~7.6 km average in lower atmosphere
  const scaleHeightKm = alt < 85 ? 7.4 : 24.0;
  if (alt < 85) {
    return 101325 * Math.exp(-alt / scaleHeightKm);
  }
  const base85 = 101325 * Math.exp(-85 / 7.4);
  return base85 * Math.exp(-(alt - 85) / scaleHeightKm);
}

/**
 * Formats geological time in Millions of Years Ago (Ma) to human-readable Ga/Ma string.
 */
export function formatGeologicalTime(ma: number): string {
  if (ma <= 0) return 'Present (0 Ma)';
  if (ma >= 1000) {
    return `${(ma / 1000).toFixed(2)} Ga`;
  }
  return `${Math.round(ma)} Ma`;
}

/**
 * Computes [lat, lon] polygon coordinates for Earth's night-side solar terminator
 * at a given UTC Date, suitable for rendering in a Leaflet Mercator map.
 */
export function computeSolarTerminatorPolygon(
  date: Date = new Date(),
  minLon = -180,
  maxLon = 180
): Array<[number, number]> {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = (date.getTime() - startOfYear) / 86400000;

  // Approximate solar declination in radians (-23.44° to +23.44°)
  const declinationRad =
    ((-23.44 * Math.PI) / 180) * Math.cos(((2 * Math.PI) / 365.24) * (dayOfYear + 10));

  // Subsolar longitude from UTC hours (12:00 UTC => sun at 0° prime meridian)
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const subsolarLonDeg = (12 - utcHours) * 15;

  const points: Array<[number, number]> = [];
  const tanDec = Math.tan(declinationRad);
  const safeTanDec = Math.abs(tanDec) < 1e-4 ? (tanDec >= 0 ? 1e-4 : -1e-4) : tanDec;

  for (let lon = minLon; lon <= maxLon; lon += 4) {
    const hourAngleRad = ((lon - subsolarLonDeg) * Math.PI) / 180;
    const latRad = Math.atan(-Math.cos(hourAngleRad) / safeTanDec);
    const latDeg = Math.max(-85, Math.min(85, (latRad * 180) / Math.PI));
    points.push([latDeg, lon]);
  }

  // Close the polygon across the winter pole (the pole in darkness)
  const darkPoleLat = declinationRad >= 0 ? -85 : 85;
  points.push([darkPoleLat, maxLon]);
  points.push([darkPoleLat, minLon]);

  return points;
}

/**
 * Converts latitude in degrees [-85.0511, +85.0511] to normalized Web Mercator (EPSG:3857)
 * Y coordinate in [0, 1] where 0 = top (+85.0511°N) and 1 = bottom (-85.0511°S).
 */
export function latToMercatorNormY(latDeg: number): number {
  const MAX_MERCATOR_LAT = 85.0511287798;
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, latDeg));
  const latRad = (clamped * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  return 0.5 - mercY / (2 * Math.PI);
}

/**
 * Converts geographic lat/lon (degrees) to Slippy Map tile indices at zoom level z.
 */
export function latLonToTileXY(
  latDeg: number,
  lonDeg: number,
  zoom: number
): { x: number; y: number } {
  const n = 1 << zoom;
  const wrappedLon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  const x = Math.min(n - 1, Math.max(0, Math.floor(((wrappedLon + 180) / 360) * n)));
  const normY = latToMercatorNormY(latDeg);
  const y = Math.min(n - 1, Math.max(0, Math.floor(normY * n)));
  return { x, y };
}

/** Return the stable 4×4 detail-tile window for a camera target. */
export function getDetailTileWindow(lat: number, lon: number, zoom: number) {
  const clampedZoom = Math.max(4, Math.min(6, zoom));
  const clampedLat = Math.max(-76, Math.min(76, lat));
  const tileCount = 1 << clampedZoom;
  const { x: cx, y: cy } = latLonToTileXY(clampedLat, lon, clampedZoom);
  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const fx = ((wrappedLon + 180) / 360) * tileCount;
  const fy = latToMercatorNormY(clampedLat) * tileCount;
  const anchorX = Number.isFinite(fx) ? Math.round(fx) : cx;
  const anchorY = Number.isFinite(fy) ? Math.round(fy) : cy;
  const txStart = anchorX - 2;
  const tyStart = Math.max(0, Math.min(tileCount - 4, anchorY - 2));
  return { clampedZoom, tileCount, txStart, txEnd: txStart + 3, tyStart, tyEnd: Math.min(tileCount - 1, tyStart + 3) };
}

/**
 * Converts a rectangular Slippy Map tile range [xMin..xMax, yMin..yMax] at zoom z
 * back into geographic lat/lon bounds (degrees).
 */
export function tileBoundsToLatLon(
  xMin: number,
  xMaxInclusive: number,
  yMin: number,
  yMaxInclusive: number,
  zoom: number
): { latNorth: number; latSouth: number; lonWest: number; lonEast: number } {
  const n = 1 << zoom;
  const lonWest = (xMin / n) * 360 - 180;
  const lonEast = ((xMaxInclusive + 1) / n) * 360 - 180;

  const yToLat = (ty: number) => {
    const mercN = Math.PI - (2 * Math.PI * ty) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercN) - Math.exp(-mercN)));
  };

  const latNorth = yToLat(yMin);
  const latSouth = yToLat(yMaxInclusive + 1);
  return { latNorth, latSouth, lonWest, lonEast };
}

/**
 * Maps Three.js camera distance from Earth center to Google-Earth-style altitude (km)
 * and target Leaflet detail zoom level (3 = global, 4..6 = close-up patch).
 */
export function cameraDistanceToZoomAndAltitudeKm(
  distance: number,
  earthRadius: number
): { leafletZoom: number; altitudeKm: number } {
  const safeDist = Math.max(earthRadius + 0.02, distance);
  const altitudeKm = Math.round(((safeDist - earthRadius) / earthRadius) * EARTH_MEAN_RADIUS_KM);

  let leafletZoom = 3;
  if (safeDist <= 2.55) {
    leafletZoom = 6;
  } else if (safeDist <= 3.15) {
    leafletZoom = 5;
  } else if (safeDist <= 4.15) {
    leafletZoom = 4;
  }
  return { leafletZoom, altitudeKm };
}

/**
 * Deterministic marine & polar basin fallback when reverse-geocoding open oceans.
 */
export function classifyOceanOrRegion(lat: number, lon: number): { title: string; subtitle: string } {
  if (lat >= 66.5) {
    return { title: 'Arctic Ocean', subtitle: 'Polar Marine Basin' };
  }
  if (lat <= -60) {
    return { title: 'Southern Ocean', subtitle: 'Antarctic Circumpolar Basin' };
  }
  if (lat >= 5 && lat <= 25 && lon >= 122 && lon <= 142) {
    return { title: 'Philippine Sea', subtitle: 'Western Pacific Margin' };
  }
  if (lat >= 3 && lat <= 24 && lon >= 105 && lon < 122) {
    return { title: 'West Philippine / South China Sea', subtitle: 'Marginal Sea · Western Pacific' };
  }
  if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 37) {
    return { title: 'Mediterranean Sea', subtitle: 'Intercontinental Basin' };
  }
  if (lat >= 10 && lat <= 24 && lon >= -88 && lon <= -60) {
    return { title: 'Caribbean Sea', subtitle: 'Tropical Atlantic Basin' };
  }
  if (lat >= 18 && lat <= 30 && lon >= -98 && lon <= -81) {
    return { title: 'Gulf of Mexico', subtitle: 'North American Marginal Sea' };
  }
  if (lon >= 20 && lon <= 120 && lat < 30) {
    return { title: 'Indian Ocean', subtitle: 'Pelagic Ocean Basin' };
  }
  const atlanticWestBound = lat >= 9 ? -81 : -68;
  if (lon >= atlanticWestBound && lon < 20) {
    return lat >= 0
      ? { title: 'North Atlantic Ocean', subtitle: 'Deep Pelagic Basin' }
      : { title: 'South Atlantic Ocean', subtitle: 'Deep Pelagic Basin' };
  }
  return lat >= 0
    ? { title: 'North Pacific Ocean', subtitle: 'Deep Pelagic Basin' }
    : { title: 'South Pacific Ocean', subtitle: 'Deep Pelagic Basin' };
}

