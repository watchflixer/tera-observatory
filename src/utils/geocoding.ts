import { classifyOceanOrRegion } from './earthMath';

export interface InspectedLocation {
  lat: number;
  lon: number;
  title: string;
  subtitle: string;
  country?: string;
  region?: string;
  city?: string;
  isOcean: boolean;
  loading?: boolean;
}

const reverseCache = new Map<string, InspectedLocation>();

function cacheKey(lat: number, lon: number, zoom: number): string {
  const step = zoom >= 10 ? 0.03 : 0.2;
  const rLat = Math.round(lat / step) * step;
  const rLon = Math.round(lon / step) * step;
  return `${rLat.toFixed(2)},${rLon.toFixed(2)},z${zoom}`;
}

export function getInstantLocationFallback(lat: number, lon: number): InspectedLocation {
  const ocean = classifyOceanOrRegion(lat, lon);
  return {
    lat,
    lon,
    title: ocean.title,
    subtitle: ocean.subtitle,
    isOcean: true,
    loading: true,
  };
}

/**
 * Reverse-geocodes a geographic coordinate using OpenStreetMap Nominatim (CORS-enabled)
 * with caching and clean maritime/polar fallback when over open oceans.
 */
export async function reverseGeocodeLocation(
  lat: number,
  lon: number,
  options?: { zoom?: number; signal?: AbortSignal }
): Promise<InspectedLocation> {
  const zoom = options?.zoom ?? 10;
  const key = cacheKey(lat, lon, zoom);
  const cached = reverseCache.get(key);
  if (cached) {
    return { ...cached, lat, lon, loading: false };
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      4
    )}&lon=${lon.toFixed(4)}&zoom=${zoom}&addressdetails=1&accept-language=en`;

    const res = await fetch(url, {
      signal: options?.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      error?: string;
      name?: string;
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state?: string;
        region?: string;
        country?: string;
      };
    };

    if (data.error || (!data.address?.country && !data.name)) {
      const ocean = classifyOceanOrRegion(lat, lon);
      const oceanLoc: InspectedLocation = {
        lat,
        lon,
        title: ocean.title,
        subtitle: ocean.subtitle,
        isOcean: true,
        loading: false,
      };
      reverseCache.set(key, oceanLoc);
      return oceanLoc;
    }

    const addr = data.address ?? {};
    const locality =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      data.name;
    const region = addr.state || addr.region;
    const country = addr.country;

    const title = locality || region || country || 'Terrestrial Region';
    const parts = [locality && region && locality !== region ? region : null, country].filter(
      Boolean
    );
    const subtitle =
      parts.length > 0 && parts.join(', ') !== title
        ? parts.join(', ')
        : country || region || 'Planet Earth Surface';

    const loc: InspectedLocation = {
      lat,
      lon,
      title,
      subtitle,
      country,
      region,
      city: locality,
      isOcean: false,
      loading: false,
    };
    reverseCache.set(key, loc);
    return loc;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    const ocean = classifyOceanOrRegion(lat, lon);
    return {
      lat,
      lon,
      title: ocean.title,
      subtitle: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
      isOcean: true,
      loading: false,
    };
  }
}

/**
 * Forward-geocodes a place name (city, landmark, country) to coordinates via Nominatim.
 */
export async function searchLocationByName(
  query: string,
  signal?: AbortSignal
): Promise<InspectedLocation | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    trimmed
  )}&limit=1&addressdetails=1&accept-language=en`;

  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;

  const list = (await res.json()) as Array<{
    lat: string;
    lon: string;
    name?: string;
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      state?: string;
      country?: string;
    };
  }>;

  if (!Array.isArray(list) || list.length === 0) return null;
  const hit = list[0];
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const addr = hit.address ?? {};
  const title = hit.name || addr.city || addr.town || addr.country || trimmed;
  const subtitleParts = [addr.state, addr.country].filter((v) => v && v !== title);

  return {
    lat,
    lon,
    title,
    subtitle: subtitleParts.join(', ') || hit.display_name || 'Global Coordinate',
    country: addr.country,
    region: addr.state,
    city: addr.city || addr.town,
    isOcean: false,
    loading: false,
  };
}
