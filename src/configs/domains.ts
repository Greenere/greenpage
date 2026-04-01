export const DOMAIN_CONFIG = {
  research: {
    display: 'research',
    cardTag: 'RESEARCH',
    seedAngle: -140,
  },
  education: {
    display: 'education',
    cardTag: 'EDUCATION',
    seedAngle: -95,
  },
  travel: {
    display: 'travel',
    cardTag: 'TRAVEL',
    seedAngle: -20,
  },
  blog: {
    display: 'writing',
    cardTag: 'BLOG',
    seedAngle: 25,
  },
  experience: {
    display: 'experience',
    cardTag: 'EXPERIENCE',
    seedAngle: 95,
  },
  project: {
    display: 'project',
    cardTag: 'PROJECT',
    seedAngle: 150,
  },
} as const;

export type DomainId = keyof typeof DOMAIN_CONFIG;

export const DOMAIN_ORDER = Object.keys(DOMAIN_CONFIG) as DomainId[];

export function isDomainId(value: unknown): value is DomainId {
  return typeof value === 'string' && value in DOMAIN_CONFIG;
}
