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

export const BIO_PAGE_URL = `${import.meta.env.BASE_URL}data/bio.json`;

let bioPageContentPromise: Promise<BioPageContent> | null = null;
let bioPageContentCache: BioPageContent | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

async function loadBioPageContentUncached(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load bio content from ${url}`);
  }

  const payload: unknown = await response.json();
  const content = normalizeBioPageContent(payload);

  if (!content) {
    throw new Error(`Invalid bio content payload from ${url}`);
  }

  if (url === BIO_PAGE_URL) {
    bioPageContentCache = content;
  }

  return content;
}

export function readCachedBioPageContent() {
  return bioPageContentCache;
}

export async function loadBioPageContent(url = BIO_PAGE_URL): Promise<BioPageContent> {
  if (url !== BIO_PAGE_URL) {
    return loadBioPageContentUncached(url);
  }

  if (!bioPageContentPromise) {
    bioPageContentPromise = loadBioPageContentUncached(url).catch((error) => {
      bioPageContentPromise = null;
      throw error;
    });
  }

  return bioPageContentPromise;
}
