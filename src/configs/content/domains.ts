export const DOMAIN_CONFIG = {
  // Arc order (by ascending seedAngle): blog → research → experience → travel → project → education
  //
  // Positions in a -25°→295° arc with ~6 weight-proportional lanes:
  //   blog      pos 1  ~0°   east  — most prominent, bio-adjacent ✓, grows frequently
  //   research  pos 2  ~33°  lower-right — adjacent to blog (affinity 6.45) and experience (10.5)
  //   experience pos 3 ~90°  south — largest domain (6 nodes); sits between its two strongest partners
  //   travel    pos 4  ~154° lower-left — bridging experience (3.0) and project (0, unavoidable gap)
  //   project   pos 5  ~220° upper-left — adjacent to education (9.45), room to grow
  //   education pos 6  ~270° north — most prominent, bio-adjacent ✓, stable (unlikely to grow)
  blog: {
    display: 'writing',
    cardTag: 'BLOG',
    seedAngle: 70,
  },
  research: {
    display: 'research',
    cardTag: 'RESEARCH',
    seedAngle: 123,
  },
  experience: {
    display: 'experience',
    cardTag: 'EXPERIENCE',
    seedAngle: 180,
  },
  travel: {
    display: 'travel',
    cardTag: 'TRAVEL',
    seedAngle: 244,
  },
  project: {
    display: 'project',
    cardTag: 'PROJECT',
    seedAngle: 310,
  },
  education: {
    display: 'education',
    cardTag: 'EDUCATION',
    seedAngle: 0,
  },
} as const;

export type DomainId = keyof typeof DOMAIN_CONFIG;

export const DOMAIN_ORDER = Object.keys(DOMAIN_CONFIG) as DomainId[];

export function isDomainId(value: unknown): value is DomainId {
  return typeof value === 'string' && value in DOMAIN_CONFIG;
}
