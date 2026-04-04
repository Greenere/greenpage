import { getActiveLanguage, type AppLanguage } from '../../../i18n';
import { getLocaleFallbackOrder, localeToFileSuffix } from '../../../i18n/localeFiles';
import { UI_COPY } from '../../../configs/ui/uiCopy';

export type BioPageLink = {
  label: string;
  href: string;
};

export type BioPageFact = {
  label: string;
  value: string;
  href?: string;
};

export type BioPageSection = {
  label: string;
  paragraphs: string[];
};

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

// Legacy pre-migration URL — used as a last-resort fallback during file migration.
const LEGACY_BIO_PAGE_URL = `${import.meta.env.BASE_URL}data/bio.json`;

function getBioPageUrl(locale: AppLanguage): string {
  return `${import.meta.env.BASE_URL}data/bio.${localeToFileSuffix(locale)}.json`;
}

function getBioPageUrls(locale: AppLanguage): string[] {
  return [
    ...getLocaleFallbackOrder(locale).map(getBioPageUrl),
    LEGACY_BIO_PAGE_URL,
  ].filter((url, index, urls) => urls.indexOf(url) === index);
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

  const sections = value.filter((entry): entry is BioPageSection => {
    if (!isRecord(entry)) return false;
    return (
      typeof entry.label === 'string' &&
      Array.isArray(entry.paragraphs) &&
      entry.paragraphs.every((paragraph) => typeof paragraph === 'string')
    );
  });

  return sections.length > 0 ? sections : undefined;
}

function normalizeBioPageContent(value: unknown): BioPageContent | null {
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

async function loadBioPageContentUncached(locale: AppLanguage): Promise<BioPageContent> {
  const isUsable = (r: Response) => r.ok && isJsonResponse(r);
  let response: Response | null = null;
  let resolvedUrl: string | null = null;

  for (const url of getBioPageUrls(locale)) {
    response = await fetch(url);
    if (isUsable(response)) {
      resolvedUrl = url;
      break;
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
  return content;
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

  const promise = loadBioPageContentUncached(locale).catch((error) => {
    bioPagePromiseByLocale.delete(locale);
    throw error;
  });

  bioPagePromiseByLocale.set(locale, promise);
  return promise;
}
