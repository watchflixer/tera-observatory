import {
  isPhotographicCommonsFile,
  parseWikipediaExtractToSections,
  selectPreferredLangTitle,
  stripHtmlTags,
  type ParsedWikiArticle,
} from './wikipediaParser';

export interface WikiPhotoItem {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  caption: string;
}

export interface WikiAvailableLanguage {
  lang: string;
  title: string;
}

export interface WikiArticleBundle {
  requestedLang: string;
  resolvedLang: string;
  fallbackToEnglish: boolean;
  pageTitle: string;
  canonicalUrl: string;
  leadThumbUrl: string | null;
  leadImageCaption: string;
  parsed: ParsedWikiArticle;
  photos: WikiPhotoItem[];
  availableLanguages: WikiAvailableLanguage[];
}

export interface WikiSearchHit {
  title: string;
  snippet: string;
  lang: string;
}

const bundleCache = new Map<string, WikiArticleBundle>();
const photoCache = new Map<string, WikiPhotoItem[]>();

interface MediaWikiQueryResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        title?: string;
        fullurl?: string;
        extract?: string;
        thumbnail?: { source?: string };
        langlinks?: Array<{ lang: string; '*': string }>;
        imageinfo?: Array<{
          url?: string;
          thumburl?: string;
          mime?: string;
          extmetadata?: {
            ImageDescription?: { value?: string };
            ObjectName?: { value?: string };
            Artist?: { value?: string };
          };
        }>;
      }
    >;
    search?: Array<{
      title: string;
      snippet: string;
    }>;
  };
}

function cleanFileTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/_/g, ' ')
    .trim();
}

function extractImageItems(pages: MediaWikiQueryResponse['query'] extends undefined ? never : Record<string, { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string; mime?: string; extmetadata?: { ImageDescription?: { value?: string }; ObjectName?: { value?: string } } }> }> | undefined): WikiPhotoItem[] {
  if (!pages) return [];
  const items: WikiPhotoItem[] = [];
  for (const page of Object.values(pages)) {
    const title = page.title ?? '';
    const info = page.imageinfo?.[0];
    if (!info?.thumburl && !info?.url) continue;
    if (!isPhotographicCommonsFile(title, info.mime)) continue;

    const rawDesc =
      info.extmetadata?.ImageDescription?.value ||
      info.extmetadata?.ObjectName?.value ||
      '';
    const stripped = stripHtmlTags(rawDesc);
    const caption =
      stripped.length > 0
        ? stripped.length > 160
          ? `${stripped.slice(0, 157).trim()}…`
          : stripped
        : cleanFileTitle(title);

    const thumbUrl = info.thumburl || info.url || '';
    const fullUrl = info.url || info.thumburl || '';
    items.push({
      id: title || thumbUrl,
      title: cleanFileTitle(title),
      thumbUrl,
      fullUrl,
      caption,
    });
  }
  return items;
}

async function fetchPhotosForTopic(
  enTitle: string,
  commonsQuery: string,
  signal?: AbortSignal
): Promise<WikiPhotoItem[]> {
  const key = `${enTitle}::${commonsQuery}`;
  const cached = photoCache.get(key);
  if (cached) return cached;

  const pageImagesUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    enTitle
  )}&generator=images&gimlimit=30&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&redirects=1&format=json&origin=*`;

  const commonsSearchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    commonsQuery
  )}&gsrlimit=14&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=640&format=json&origin=*`;

  const [pageRes, commonsRes] = await Promise.allSettled([
    fetch(pageImagesUrl, { signal }).then((r) => (r.ok ? (r.json() as Promise<MediaWikiQueryResponse>) : null)),
    fetch(commonsSearchUrl, { signal }).then((r) => (r.ok ? (r.json() as Promise<MediaWikiQueryResponse>) : null)),
  ]);

  const seen = new Set<string>();
  const combined: WikiPhotoItem[] = [];

  const pushUnique = (list: WikiPhotoItem[]) => {
    for (const item of list) {
      const norm = item.title.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      combined.push(item);
      if (combined.length >= 12) break;
    }
  };

  if (pageRes.status === 'fulfilled' && pageRes.value?.query?.pages) {
    pushUnique(extractImageItems(pageRes.value.query.pages));
  }
  if (combined.length < 12 && commonsRes.status === 'fulfilled' && commonsRes.value?.query?.pages) {
    pushUnique(extractImageItems(commonsRes.value.query.pages));
  }

  photoCache.set(key, combined);
  return combined;
}

async function fetchWikiTextByLang(
  lang: string,
  title: string,
  includeLangLinks: boolean,
  signal?: AbortSignal
): Promise<{
  title: string;
  fullurl: string;
  extract: string;
  thumbnail: string | null;
  langlinks: Array<{ lang: string; '*': string }>;
} | null> {
  const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'en';
  const props = includeLangLinks ? 'extracts|pageimages|langlinks|info' : 'extracts|pageimages|info';
  const extra = includeLangLinks ? '&lllimit=500' : '';
  const url = `https://${safeLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title
  )}&prop=${props}&exsectionformat=wiki&explaintext=1&pithumbsize=900${extra}&inprop=url&redirects=1&format=json&origin=*`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as MediaWikiQueryResponse;
  const pages = data.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  if (!first || first.pageid === undefined) return null;

  return {
    title: first.title ?? title,
    fullurl: first.fullurl ?? `https://${safeLang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    extract: first.extract ?? '',
    thumbnail: first.thumbnail?.source ?? null,
    langlinks: first.langlinks ?? [],
  };
}

export async function fetchWikipediaBundle(params: {
  enTitle: string;
  commonsQuery: string;
  lang: string;
  overrideLangTitle?: string;
  signal?: AbortSignal;
}): Promise<WikiArticleBundle> {
  const { enTitle, commonsQuery, lang, overrideLangTitle, signal } = params;
  const cacheKey = `${lang}::${overrideLangTitle || enTitle}::${commonsQuery}`;
  const cached = bundleCache.get(cacheKey);
  if (cached) return cached;

  const photosPromise = fetchPhotosForTopic(enTitle, commonsQuery, signal);

  // If caller already searched directly in target lang (custom Wikipedia search), fetch it directly
  if (overrideLangTitle && lang !== 'en') {
    const direct = await fetchWikiTextByLang(lang, overrideLangTitle, true, signal);
    const photos = await photosPromise;
    if (direct && direct.extract.trim().length > 0) {
      const leadThumbUrl = direct.thumbnail ?? photos[0]?.thumbUrl ?? null;
      const leadImageCaption = direct.thumbnail
        ? `${direct.title} (${lang}.wikipedia)`
        : (photos[0]?.caption ?? direct.title);
      const bundle: WikiArticleBundle = {
        requestedLang: lang,
        resolvedLang: lang,
        fallbackToEnglish: false,
        pageTitle: direct.title,
        canonicalUrl: direct.fullurl,
        leadThumbUrl,
        leadImageCaption,
        parsed: parseWikipediaExtractToSections(direct.extract),
        photos,
        availableLanguages: direct.langlinks.map((l) => ({ lang: l.lang, title: l['*'] })),
      };
      bundleCache.set(cacheKey, bundle);
      return bundle;
    }
  }

  // Otherwise fetch English base (gives full langlinks + fallback prose)
  const enData = await fetchWikiTextByLang('en', enTitle, true, signal);
  const availableLanguages: WikiAvailableLanguage[] = (enData?.langlinks ?? []).map((l) => ({
    lang: l.lang,
    title: l['*'],
  }));

  if (lang !== 'en') {
    const { resolvedTitle, matchedTargetLang } = selectPreferredLangTitle(
      enData?.langlinks,
      lang,
      enTitle
    );

    if (matchedTargetLang) {
      const targetData = await fetchWikiTextByLang(lang, resolvedTitle, false, signal);
      if (targetData && targetData.extract.trim().length >= 80) {
        const photos = await photosPromise;
        const thumb = targetData.thumbnail ?? enData?.thumbnail ?? null;
        const leadThumbUrl = thumb ?? photos[0]?.thumbUrl ?? null;
        const leadImageCaption = thumb
          ? `${targetData.title} (${lang}.wikipedia)`
          : (photos[0]?.caption ?? targetData.title);
        const bundle: WikiArticleBundle = {
          requestedLang: lang,
          resolvedLang: lang,
          fallbackToEnglish: false,
          pageTitle: targetData.title,
          canonicalUrl: targetData.fullurl,
          leadThumbUrl,
          leadImageCaption,
          parsed: parseWikipediaExtractToSections(targetData.extract),
          photos,
          availableLanguages,
        };
        bundleCache.set(cacheKey, bundle);
        return bundle;
      }
    }
  }

  const photos = await photosPromise;
  const leadThumbUrl = enData?.thumbnail ?? photos[0]?.thumbUrl ?? null;
  const leadImageCaption = enData?.thumbnail
    ? `${enData.title} (en.wikipedia)`
    : (photos[0]?.caption ?? enData?.title ?? enTitle);
  const bundle: WikiArticleBundle = {
    requestedLang: lang,
    resolvedLang: 'en',
    fallbackToEnglish: lang !== 'en',
    pageTitle: enData?.title ?? enTitle,
    canonicalUrl:
      enData?.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`,
    leadThumbUrl,
    leadImageCaption,
    parsed: parseWikipediaExtractToSections(enData?.extract ?? ''),
    photos,
    availableLanguages,
  };

  bundleCache.set(cacheKey, bundle);
  return bundle;
}

export async function searchLiveWikipedia(
  query: string,
  lang: string,
  signal?: AbortSignal
): Promise<WikiSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const safeLang = /^[a-z-]{2,12}$/i.test(lang) ? lang : 'en';
  const url = `https://${safeLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    trimmed
  )}&srlimit=6&format=json&origin=*`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as MediaWikiQueryResponse;
    return (data.query?.search ?? []).map((item) => ({
      title: item.title,
      snippet: stripHtmlTags(item.snippet),
      lang: safeLang,
    }));
  } catch {
    return [];
  }
}
