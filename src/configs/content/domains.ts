export const DOMAIN_CONFIG = {
  experience: {
    display: 'experience',
    cardTag: 'EXPERIENCE',
    seedAngle: -20,  // right side, slightly above east
  },
  blog: {
    display: 'writing',
    cardTag: 'BLOG',
    seedAngle: 0,    // right side, due east
  },
  project: {
    display: 'project',
    cardTag: 'PROJECT',
    seedAngle: 20,   // right side, slightly below east
  },
  education: {
    display: 'education',
    cardTag: 'EDUCATION',
    seedAngle: 160,  // left side, slightly above west
  },
  research: {
    display: 'research',
    cardTag: 'RESEARCH',
    seedAngle: 180,  // left side, due west
  },
  travel: {
    display: 'travel',
    cardTag: 'TRAVEL',
    seedAngle: 200,  // left side, slightly below west
  },
} as const;

export type DomainId = keyof typeof DOMAIN_CONFIG;

export const DOMAIN_ORDER = Object.keys(DOMAIN_CONFIG) as DomainId[];

export function isDomainId(value: unknown): value is DomainId {
  return typeof value === 'string' && value in DOMAIN_CONFIG;
}
