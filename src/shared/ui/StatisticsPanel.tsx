import { UI_COPY } from '../../configs/ui/uiCopy';
import type { StatisticsDomainEntry, StatisticsSummary } from '../statistics/graphStatistics';

function buildTreemapLayout(
  entries: StatisticsDomainEntry[],
  x: number,
  y: number,
  width: number,
  height: number,
): Array<StatisticsDomainEntry & { x: number; y: number; width: number; height: number }> {
  if (entries.length === 0 || width <= 0 || height <= 0) return [];
  if (entries.length === 1) {
    return [{ ...entries[0], x, y, width, height }];
  }

  const getWeight = (entry: StatisticsDomainEntry) => Math.max(entry.count, 1);
  const total = entries.reduce((sum, entry) => sum + getWeight(entry), 0);
  let bestIndex = 1;
  let bestDelta = Number.POSITIVE_INFINITY;
  let runningTotal = 0;

  for (let index = 1; index < entries.length; index += 1) {
    runningTotal += getWeight(entries[index - 1]);
    const delta = Math.abs(total / 2 - runningTotal);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  }

  const firstGroup = entries.slice(0, bestIndex);
  const secondGroup = entries.slice(bestIndex);
  const firstTotal = firstGroup.reduce((sum, entry) => sum + getWeight(entry), 0);
  const splitByWidth = width >= height;
  const firstFraction = firstTotal / total;

  if (splitByWidth) {
    const firstWidth = width * firstFraction;
    return [
      ...buildTreemapLayout(firstGroup, x, y, firstWidth, height),
      ...buildTreemapLayout(secondGroup, x + firstWidth, y, width - firstWidth, height),
    ];
  }

  const firstHeight = height * firstFraction;
  return [
    ...buildTreemapLayout(firstGroup, x, y, width, firstHeight),
    ...buildTreemapLayout(secondGroup, x, y + firstHeight, width, height - firstHeight),
  ];
}

export function StatisticsPanel({
  entries,
  stats,
  onDeleteDomain,
  panelLayout = 'default',
}: {
  entries: StatisticsDomainEntry[];
  stats: StatisticsSummary;
  onDeleteDomain?: (entry: StatisticsDomainEntry) => void;
  panelLayout?: 'default' | 'detail';
}) {
  const detailLayout = panelLayout === 'detail';
  const sortedEntries = [...entries].sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain));
  const treemapLayout = buildTreemapLayout(sortedEntries, 0, 0, 100, 100);
  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  const totalNodes = entries.reduce((sum, entry) => sum + entry.count, 0);
  const maxTimelineCount = Math.max(...stats.timelineByYear.map((entry) => entry.count), 1);
  const maxConnectionBucketCount = Math.max(...stats.connectionDistribution.map((entry) => entry.count), 1);
  const maxTopConnectedCount = Math.max(...stats.topConnectedNodes.map((entry) => entry.count), 1);
  const maxStrengthCount = Math.max(...stats.strengthDistribution.map((entry) => entry.count), 1);
  const cardPadding = detailLayout ? '0.88rem 0.92rem' : '1rem 1.05rem';
  const upperChartMinHeight = detailLayout ? '7.2rem' : '8.5rem';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '0.9rem 1rem',
          borderRadius: '14px',
          background: 'color-mix(in srgb, var(--color-background) 86%, white 14%)',
          fontSize: '0.84rem',
          lineHeight: 1.6,
          opacity: 0.82,
        }}
      >
        {UI_COPY.nodeEditor.domainStats.summary(totalNodes, entries.length)}
      </div>
      <div
        style={{
          marginTop: '0.9rem',
          display: 'grid',
          gridTemplateColumns: detailLayout ? 'minmax(0, 1fr) minmax(13.5rem, 1.55fr)' : 'minmax(0, 1fr) minmax(18rem, 2fr)',
          rowGap: detailLayout ? '0.75rem' : '0.9rem',
          columnGap: detailLayout ? '2rem' : '0.9rem',
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'grid', gap: detailLayout ? '0.75rem' : '0.9rem' }}>
          <div
            style={{
              padding: cardPadding,
              borderRadius: '18px',
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
              boxShadow:
                'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.timelineTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.timelineDetail}
            </div>
            <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'flex-end', gap: detailLayout ? '0.34rem' : '0.42rem', minHeight: upperChartMinHeight, flex: 1 }}>
              {stats.timelineByYear.map((entry) => (
                <div key={entry.year} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.42rem' }}>
                  <div style={{ fontSize: '0.74rem', opacity: 0.66 }}>{entry.count}</div>
                  <div
                    style={{
                      width: '100%',
                      minHeight: '0.45rem',
                      height: `${Math.max(8, (entry.count / maxTimelineCount) * 110)}px`,
                      borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
                    }}
                  />
                  <div style={{ fontSize: '0.72rem', opacity: 0.74 }}>{entry.year}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: cardPadding,
              borderRadius: '18px',
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
              boxShadow:
                'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.connectionDistributionTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.connectionDistributionDetail}
            </div>
            <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, justifyContent: 'center' }}>
              {stats.connectionDistribution.map((entry) => (
                <div
                  key={entry.bucket}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: detailLayout ? '2.35rem 1fr auto' : '3rem 1fr auto',
                    alignItems: 'center',
                    gap: detailLayout ? '0.45rem' : '0.6rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>{entry.bucket}</div>
                  <div
                    style={{
                      height: '0.64rem',
                      borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--color-background) 80%, white 20%)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(entry.count / maxConnectionBucketCount) * 100}%`,
                        minWidth: entry.count > 0 ? '0.24rem' : 0,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.77rem', opacity: 0.72 }}>{entry.count}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: cardPadding,
              borderRadius: '18px',
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
              boxShadow:
                'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.strengthDistributionTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.strengthDistributionDetail}
            </div>
            <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, justifyContent: 'center' }}>
              {stats.strengthDistribution.map((entry) => (
                <div
                  key={entry.strength}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: detailLayout ? '2.35rem 1fr auto' : '3rem 1fr auto',
                    alignItems: 'center',
                    gap: detailLayout ? '0.45rem' : '0.6rem',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', opacity: 0.82 }}>{entry.strength}</div>
                  <div
                    style={{
                      height: '0.64rem',
                      borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--color-background) 80%, white 20%)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(entry.count / maxStrengthCount) * 100}%`,
                        minWidth: entry.count > 0 ? '0.24rem' : 0,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.77rem', opacity: 0.72 }}>{entry.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: cardPadding,
            borderRadius: '18px',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
            boxShadow:
              'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
            {UI_COPY.nodeEditor.domainStats.topConnectedNodesTitle}
          </div>
          <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
            {UI_COPY.nodeEditor.domainStats.topConnectedNodesDetail}
          </div>
          <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.62rem', flex: 1, justifyContent: 'center' }}>
            {stats.topConnectedNodes.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: detailLayout ? '0.42rem' : '0.55rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: detailLayout ? '0.78rem' : '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.label}
                  </div>
                  <div style={{ marginTop: '0.18rem', fontSize: detailLayout ? '0.69rem' : '0.72rem', opacity: 0.68 }}>
                    {entry.domainTag}
                  </div>
                  <div
                    style={{
                      marginTop: '0.35rem',
                      height: '0.45rem',
                      borderRadius: '999px',
                      background: 'color-mix(in srgb, var(--color-background) 80%, white 20%)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(entry.count / maxTopConnectedCount) * 100}%`,
                        minWidth: entry.count > 0 ? '0.24rem' : 0,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'color-mix(in srgb, var(--color-secondary) 70%, var(--color-text))',
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: detailLayout ? '0.74rem' : '0.78rem', opacity: 0.74 }}>{entry.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: '0.9rem',
          width: '100%',
          flex: 1.15,
          minHeight: detailLayout ? '28rem' : '25rem',
          padding: cardPadding,
          borderRadius: '22px',
          background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
          border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
          boxShadow:
            'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
          {UI_COPY.nodeEditor.domainStats.treemapTitle}
        </div>
        <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
          {UI_COPY.nodeEditor.domainStats.treemapDetail}
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: '0.9rem',
            flex: 1,
            minHeight: detailLayout ? '24rem' : '21rem',
            borderRadius: '18px',
            overflow: 'hidden',
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-background) 92%, white 8%), color-mix(in srgb, var(--color-background) 84%, white 16%))',
            border: '1px solid color-mix(in srgb, var(--color-secondary) 22%, transparent)',
          }}
        >
          {treemapLayout.map((entry) => {
            const intensity = 0.18 + (entry.count / maxCount) * 0.34;
            const compact = detailLayout ? entry.width < 28 || entry.height < 22 : entry.width < 22 || entry.height < 18;
            return (
              <div
                key={entry.domain}
                style={{
                  position: 'absolute',
                  left: `${entry.x}%`,
                  top: `${entry.y}%`,
                  width: `${entry.width}%`,
                  height: `${entry.height}%`,
                  padding: compact ? '0.3rem' : '0.42rem',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    padding: compact ? '0.7rem 0.72rem' : '0.9rem',
                    borderRadius: compact ? '16px' : '18px',
                    border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
                    background: `color-mix(in srgb, var(--color-background) ${Math.round(82 - intensity * 12)}%, white ${Math.round(18 + intensity * 12)}%)`,
                    boxShadow:
                      'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 22%, transparent), 0 10px 24px color-mix(in srgb, black 7%, transparent)',
                    color: 'var(--color-text)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72 }}>
                      {entry.cardTag}
                    </div>
                    {entry.removable && onDeleteDomain ? (
                      <button
                        type="button"
                        onClick={() => onDeleteDomain(entry)}
                        style={{
                          padding: '0.22rem 0.55rem',
                          borderRadius: '999px',
                          border: '1px solid color-mix(in srgb, crimson 22%, transparent)',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          fontFamily: 'inherit',
                          opacity: 0.88,
                        }}
                      >
                        {UI_COPY.nodeEditor.domainStats.delete}
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <div style={{ fontSize: compact ? '0.95rem' : '1.18rem', fontWeight: 700, lineHeight: 1.05 }}>
                      {entry.display}
                    </div>
                    <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', opacity: 0.78 }}>
                      {UI_COPY.nodeEditor.domainStats.nodeCount(entry.count)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
