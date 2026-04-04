import { getActiveLanguage, type AppLanguage } from '../../../i18n';
import { getLocaleFallbackOrder, localeToFileSuffix } from '../../../i18n/localeFiles';
import { UI_COPY } from '../../../configs/ui/uiCopy';
import { type ArticleBlock, type NodeArticleSection } from './Nodes';

export type BioPageLink = {
  label: string;
  href: string;
};

export type BioPageFact = {
  label: string;
  value: string;
  href?: string;
};

export type BioPageSection = NodeArticleSection;

export type BioPageContent = {
  eyebrow?: string;
  name: string;
  subtitle: string;
  summary: string;
  themeFactLabel?: string;
  facts?: BioPageFact[];
  sections?: BioPageSection[];
  pathsSectionLabel?: string;
  linksSectionLabel?: string;
  links?: BioPageLink[];
};

export type BioPageLoadResult = {
  content: BioPageContent;
  isFallbackContent: boolean;
  resolvedLanguage: AppLanguage;
  resolvedUrl: string;
};

// Legacy pre-migration URL — used as a last-resort fallback during file migration.
const LEGACY_BIO_PAGE_URL = `${import.meta.env.BASE_URL}data/bio.json`;

function getBioPageUrl(locale: AppLanguage): string {
  return `${import.meta.env.BASE_URL}data/bio.${localeToFileSuffix(locale)}.json`;
}

const bioPagePromiseByLocale = new Map<AppLanguage, Promise<BioPageContent>>();
const bioPageCacheByLocale = new Map<AppLanguage, BioPageContent>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// In the Vite dev server, requests for missing static files are served as index.html (200, text/html).
// Guard against this by checking Content-Type before treating a response as JSON.
function isJsonResponse(response: Response): boolean {
  const ct = response.headers.get('content-type');
  return ct !== null && ct.includes('application/json');
}

function normalizeBioPageLinks(value: unknown): BioPageLink[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const links = value.filter((entry): entry is BioPageLink => {
    if (!isRecord(entry)) return false;
    return typeof entry.label === 'string' && typeof entry.href === 'string';
  });

  return links.length > 0 ? links : undefined;
}

function normalizeBioPageFacts(value: unknown): BioPageFact[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const facts = value.filter((entry): entry is BioPageFact => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.label === 'string' &&
      typeof entry.value === 'string' &&
      (entry.href === undefined || typeof entry.href === 'string')
    );
  });

  return facts.length > 0 ? facts : undefined;
}

function normalizeBioPageSections(value: unknown): BioPageSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sections = value.flatMap((entry): BioPageSection[] => {
    if (!isRecord(entry) || typeof entry.label !== 'string') return [];

    if (Array.isArray(entry.blocks)) {
      return [
        {
          id: typeof entry.id === 'string' ? entry.id : undefined,
          label: entry.label,
          blocks: entry.blocks as ArticleBlock[],
        },
      ];
    }

    if (Array.isArray(entry.paragraphs) && entry.paragraphs.every((paragraph) => typeof paragraph === 'string')) {
      return [
        {
          id: typeof entry.id === 'string' ? entry.id : undefined,
          label: entry.label,
          blocks: entry.paragraphs
            .filter(Boolean)
            .map((paragraph) => ({ type: 'text', text: paragraph } satisfies Extract<ArticleBlock, { type: 'text' }>)),
        },
      ];
    }

    return [];
  });

  return sections.length > 0 ? sections : undefined;
}

export function normalizeBioPageContent(value: unknown): BioPageContent | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== 'string' || typeof value.subtitle !== 'string' || typeof value.summary !== 'string') {
    return null;
  }

  return {
    eyebrow: typeof value.eyebrow === 'string' ? value.eyebrow : undefined,
    name: value.name,
    subtitle: value.subtitle,
    summary: value.summary,
    themeFactLabel: typeof value.themeFactLabel === 'string' ? value.themeFactLabel : undefined,
    facts: normalizeBioPageFacts(value.facts),
    sections: normalizeBioPageSections(value.sections),
    pathsSectionLabel: typeof value.pathsSectionLabel === 'string' ? value.pathsSectionLabel : undefined,
    linksSectionLabel: typeof value.linksSectionLabel === 'string' ? value.linksSectionLabel : undefined,
    links: normalizeBioPageLinks(value.links),
  };
}

async function loadBioPageContentUncached(locale: AppLanguage): Promise<BioPageLoadResult> {
  const isUsable = (r: Response) => r.ok && isJsonResponse(r);
  let response: Response | null = null;
  let resolvedUrl: string | null = null;
  let resolvedLanguage: AppLanguage = locale;

  const localizedCandidates = getLocaleFallbackOrder(locale).map((fallbackLocale) => ({
    url: getBioPageUrl(fallbackLocale),
    locale: fallbackLocale,
  }));

  for (const candidate of localizedCandidates) {
    const url = candidate.url;
    response = await fetch(url);
    if (isUsable(response)) {
      resolvedUrl = url;
      resolvedLanguage = candidate.locale;
      break;
    }
  }

  if (!response || !isUsable(response) || !resolvedUrl) {
    const legacyResponse = await fetch(LEGACY_BIO_PAGE_URL);
    if (isUsable(legacyResponse)) {
      response = legacyResponse;
      resolvedUrl = LEGACY_BIO_PAGE_URL;
      resolvedLanguage = 'en';
    }
  }

  if (!response || !isUsable(response) || !resolvedUrl) {
    throw new Error(UI_COPY.contentLoaders.failedToLoadBioContentFrom(getBioPageUrl(locale)));
  }

  const payload: unknown = await response.json();
  const content = normalizeBioPageContent(payload);

  if (!content) {
    throw new Error(UI_COPY.contentLoaders.invalidBioContentPayloadFrom(resolvedUrl));
  }

  bioPageCacheByLocale.set(locale, content);
  return {
    content,
    isFallbackContent: resolvedLanguage !== locale,
    resolvedLanguage,
    resolvedUrl,
  };
}

export function clearBioPageContentCache() {
  bioPagePromiseByLocale.clear();
  bioPageCacheByLocale.clear();
}

export function readCachedBioPageContent(locale: AppLanguage = getActiveLanguage()) {
  return bioPageCacheByLocale.get(locale) ?? null;
}

export async function loadBioPageContent(locale: AppLanguage = getActiveLanguage()): Promise<BioPageContent> {
  const existing = bioPagePromiseByLocale.get(locale);
  if (existing) return existing;

  const promise = loadBioPageContentUncached(locale)
    .then((result) => result.content)
    .catch((error) => {
      bioPagePromiseByLocale.delete(locale);
      throw error;
    });

  bioPagePromiseByLocale.set(locale, promise);
  return promise;
}

export async function loadBioPageContentWithResolution(
  locale: AppLanguage = getActiveLanguage(),
): Promise<BioPageLoadResult> {
  return loadBioPageContentUncached(locale);
}
