import { DOMAIN_CONFIG, DOMAIN_ORDER, type DomainId } from '../../configs/content/domains';
import { getChronologySortKey } from '../chronology';

export type StatisticsDomainEntry = {
  domain: DomainId;
  display: string;
  cardTag: string;
  count: number;
  removable: boolean;
};

export type StatisticsSummary = {
  timelineByYear: Array<{ year: string; count: number }>;
  connectionDistribution: Array<{ bucket: string; count: number }>;
  topConnectedNodes: Array<{ id: string; label: string; domainTag: string; count: number }>;
  strengthDistribution: Array<{ strength: 1 | 2 | 3 | 4 | 5; count: number }>;
};

export type StatisticsNodeLike = {
  id: string;
  title?: string;
  chronology: string;
  domain: DomainId;
};

export type StatisticsRelationLike = {
  from: string;
  to: string;
  strength: 1 | 2 | 3 | 4 | 5;
};

export function buildStatisticsDomainEntries(
  nodes: ReadonlyArray<Pick<StatisticsNodeLike, 'domain'>>,
  getDomainDisplay: (domain: DomainId) => string,
  isDomainRemovable: (domain: DomainId) => boolean = () => false,
): StatisticsDomainEntry[] {
  return DOMAIN_ORDER.map((domain) => ({
    domain,
    display: getDomainDisplay(domain),
    cardTag: DOMAIN_CONFIG[domain].cardTag,
    count: nodes.filter((node) => node.domain === domain).length,
    removable: isDomainRemovable(domain),
  }));
}

export function buildStatisticsSummary(
  nodes: ReadonlyArray<StatisticsNodeLike>,
  relations: ReadonlyArray<StatisticsRelationLike>,
): StatisticsSummary {
  const sortedByChronology = [...nodes].sort(
    (left, right) => getChronologySortKey(left.chronology) - getChronologySortKey(right.chronology)
  );
  const nodesByYear = new Map<string, number>();
  for (const node of sortedByChronology) {
    const year = node.chronology.slice(0, 4);
    nodesByYear.set(year, (nodesByYear.get(year) ?? 0) + 1);
  }

  const degreeByNode = new Map<string, number>();
  for (const node of nodes) {
    degreeByNode.set(node.id, 0);
  }

  const strengthCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const relation of relations) {
    degreeByNode.set(relation.from, (degreeByNode.get(relation.from) ?? 0) + 1);
    degreeByNode.set(relation.to, (degreeByNode.get(relation.to) ?? 0) + 1);
    strengthCounts[relation.strength] += 1;
  }

  const degreeBuckets = new Map<string, number>([
    ['0', 0],
    ['1', 0],
    ['2', 0],
    ['3', 0],
    ['4', 0],
    ['5+', 0],
  ]);
  for (const degree of degreeByNode.values()) {
    const key = degree >= 5 ? '5+' : String(degree);
    degreeBuckets.set(key, (degreeBuckets.get(key) ?? 0) + 1);
  }

  const topConnectedNodes = [...nodes]
    .map((node) => ({
      id: node.id,
      label: node.title?.trim() ? node.title : node.id,
      domainTag: DOMAIN_CONFIG[node.domain].cardTag,
      count: degreeByNode.get(node.id) ?? 0,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 12);

  return {
    timelineByYear: [...nodesByYear.entries()].map(([year, count]) => ({ year, count })),
    connectionDistribution: [...degreeBuckets.entries()].map(([bucket, count]) => ({ bucket, count })),
    topConnectedNodes,
    strengthDistribution: (Object.keys(strengthCounts) as Array<'1' | '2' | '3' | '4' | '5'>).map((strength) => ({
      strength: Number(strength) as 1 | 2 | 3 | 4 | 5,
      count: strengthCounts[Number(strength) as 1 | 2 | 3 | 4 | 5],
    })),
  };
}
