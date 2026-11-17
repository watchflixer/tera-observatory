export interface WikiSection {
  id: string;
  level: number;
  title: string;
  paragraphs: string[];
}

export interface ParsedWikiArticle {
  leadParagraphs: string[];
  sections: WikiSection[];
}

const IGNORED_SECTION_TITLES = new Set([
  'references',
  'external links',
  'further reading',
  'see also',
  'notes',
  'bibliography',
  'sources',
  'citations',
  'works cited',
  'explanatory notes',
  'gallery',
  'mga sanggunian',
  'tingnan din',
  'panlabas na kawing',
  'mga panlabas na link',
  'talababa',
  'sanggunian',
  'véase también',
  'véanse también',
  'referencias',
  'bibliografía',
  'enlaces externos',
  'notas',
  'voir aussi',
  'références',
  'liens externes',
  'bibliographie',
  'siehe auch',
  'einzelnachweise',
  'literatur',
  'weblinks',
  '脚注',
  '参考文献',
  '関連項目',
  '外部リンク',
  '각주',
  '참고 문헌',
  '같이 보기',
  '외부 링크',
  '参考资料',
  '參考資料',
  '参见',
  '參見',
  '外部链接',
  '外部連結',
  'lihat pula',
  'referensi',
  'pranala luar',
  'ver também',
  'referências',
  'ligações externas',
]);

function cleanWikiParagraph(raw: string): string {
  return raw
    .replace(/\(\s*(?:[;,]\s*)*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function slugifyHeading(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `sec-${base}-${index}` : `sec-${index}`;
}

export function parseWikipediaExtractToSections(extract: string): ParsedWikiArticle {
  const normalized = (extract ?? '').replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return { leadParagraphs: [], sections: [] };
  }

  const lines = normalized.split('\n');
  const leadParagraphs: string[] = [];
  const sections: WikiSection[] = [];

  let currentSection: WikiSection | null = null;
  let ignoreSubsections = false;
  let sectionCounter = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(/^(={2,4})\s*(.+?)\s*\1$/);
    if (headingMatch) {
      const level = headingMatch[1].length; // 2 = h2, 3 = h3, 4 = h4
      const title = headingMatch[2].trim();
      const lowerTitle = title.toLowerCase();

      if (level === 2) {
        ignoreSubsections = IGNORED_SECTION_TITLES.has(lowerTitle);
      }

      if (ignoreSubsections || IGNORED_SECTION_TITLES.has(lowerTitle)) {
        currentSection = null;
        continue;
      }

      sectionCounter += 1;
      currentSection = {
        id: slugifyHeading(title, sectionCounter),
        level,
        title,
        paragraphs: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (ignoreSubsections) continue;

    const cleaned = cleanWikiParagraph(line);
    if (!cleaned) continue;

    if (currentSection) {
      currentSection.paragraphs.push(cleaned);
    } else {
      leadParagraphs.push(cleaned);
    }
  }

  // Drop empty sections that have no prose and no child subsections with prose
  const filteredSections = sections.filter((sec, idx) => {
    if (sec.paragraphs.length > 0) return true;
    // Keep level 2 section if immediately followed by a non-empty level 3+ child
    if (sec.level === 2) {
      for (let i = idx + 1; i < sections.length; i += 1) {
        if (sections[i].level === 2) break;
        if (sections[i].paragraphs.length > 0) return true;
      }
    }
    return false;
  });

  return { leadParagraphs, sections: filteredSections };
}

const EXCLUDED_FILE_PATTERNS = [
  'commons-logo',
  'wikisource-logo',
  'wikibooks-logo',
  'wiktionary-logo',
  'wikiquote-logo',
  'wikiversity-logo',
  'wikispecies-logo',
  'wikinews-logo',
  'wikidata-logo',
  'flag_of_',
  'flag of ',
  'coat_of_arms',
  'coat of arms',
  'padlock',
  'ambox',
  'question_book',
  'symbol_',
  'disambig',
  'nuvola_',
  'oojs_',
  'speakerlink',
  'loudspeaker',
  'red_pog',
  'blue_pog',
  'green_pog',
  'edit-clear',
  'gnome-',
  'crystal_clear',
  'folder_hexagonal',
  'semi-protection',
  'lock-',
  'icon',
  'stub',
];

export function isPhotographicCommonsFile(titleOrUrl: string, mime?: string): boolean {
  const lower = (titleOrUrl ?? '').toLowerCase();
  if (!lower) return false;

  if (mime) {
    const m = mime.toLowerCase();
    if (m.includes('svg') || m.includes('ogg') || m.includes('webm') || m.includes('pdf') || m.includes('audio') || m.includes('video')) {
      return false;
    }
  }

  if (
    lower.endsWith('.svg') ||
    lower.endsWith('.ogg') ||
    lower.endsWith('.oga') ||
    lower.endsWith('.ogv') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mp3') ||
    lower.endsWith('.wav') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.tif') ||
    lower.endsWith('.tiff')
  ) {
    return false;
  }

  for (const bad of EXCLUDED_FILE_PATTERNS) {
    if (lower.includes(bad)) return false;
  }

  return true;
}

export function stripHtmlTags(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function selectPreferredLangTitle(
  langlinks: Array<{ lang: string; '*': string }> | undefined,
  targetLang: string,
  englishTitle: string
): { resolvedTitle: string; matchedTargetLang: boolean } {
  if (!targetLang || targetLang === 'en') {
    return { resolvedTitle: englishTitle, matchedTargetLang: true };
  }
  const hit = langlinks?.find((l) => l.lang.toLowerCase() === targetLang.toLowerCase());
  if (hit && hit['*']) {
    return { resolvedTitle: hit['*'], matchedTargetLang: true };
  }
  return { resolvedTitle: englishTitle, matchedTargetLang: false };
}
