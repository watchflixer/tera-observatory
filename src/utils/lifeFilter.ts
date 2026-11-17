import type { HistoryEraId } from '../data/earthData';
import type { LifeCategory, LifeHistoryEntry, LifeStatus } from '../data/lifeHistoryData';

export interface LifeFilterCriteria {
  query?: string;
  category?: LifeCategory | 'all';
  status?: LifeStatus | 'all';
  eraId?: HistoryEraId | 'all';
}

export function filterLifeCatalog(
  entries: LifeHistoryEntry[],
  criteria: LifeFilterCriteria
): LifeHistoryEntry[] {
  const normalizedQuery = (criteria.query ?? '').trim().toLowerCase();
  const category = criteria.category ?? 'all';
  const status = criteria.status ?? 'all';
  const eraId = criteria.eraId ?? 'all';

  return entries.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false;
    if (status !== 'all' && entry.status !== status) return false;
    if (eraId !== 'all' && entry.eraId !== eraId) return false;

    if (normalizedQuery.length > 0) {
      const haystack = [
        entry.name,
        entry.scientificName,
        entry.subgroup,
        entry.originRegion,
        entry.summary,
        entry.livedSpan,
        entry.extinctionOrAge,
        entry.populationEstimate,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }

    return true;
  });
}

export function summarizeLifeCounts(entries: LifeHistoryEntry[]): {
  total: number;
  extant: number;
  extinct: number;
  byCategory: Record<LifeCategory, number>;
} {
  const byCategory: Record<LifeCategory, number> = {
    humans: 0,
    animals: 0,
    plants: 0,
    fruits: 0,
    vegetables: 0,
    flowers: 0,
    microbes: 0,
  };
  let extant = 0;
  let extinct = 0;

  for (const e of entries) {
    byCategory[e.category] += 1;
    if (e.status === 'extant') {
      extant += 1;
    } else {
      extinct += 1;
    }
  }

  return {
    total: entries.length,
    extant,
    extinct,
    byCategory,
  };
}
