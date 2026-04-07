import { UI_COPY } from '../../configs/ui/uiCopy';
import type { StatisticsDomainEntry, StatisticsSummary } from '../statistics/graphStatistics';
import './StatisticsPanel.css';

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
  const panelClassName = `statistics-panel${detailLayout ? ' statistics-panel--detail' : ''}`;
  const sortedEntries = [...entries].sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain));
  const treemapLayout = buildTreemapLayout(sortedEntries, 0, 0, 100, 100);
  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  const totalNodes = entries.reduce((sum, entry) => sum + entry.count, 0);
  const maxTimelineCount = Math.max(...stats.timelineByYear.map((entry) => entry.count), 1);
  const maxConnectionBucketCount = Math.max(...stats.connectionDistribution.map((entry) => entry.count), 1);
  const maxTopConnectedCount = Math.max(...stats.topConnectedNodes.map((entry) => entry.count), 1);
  const maxStrengthCount = Math.max(...stats.strengthDistribution.map((entry) => entry.count), 1);

  return (
    <div className={panelClassName}>
      <div className="statistics-panel__summary">
        {UI_COPY.nodeEditor.domainStats.summary(totalNodes, entries.length)}
      </div>
      <div className="statistics-panel__top-grid">
        <div className="statistics-panel__column">
          <div
            className="statistics-panel__card"
            style={{
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.timelineTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.timelineDetail}
            </div>
            <div className="statistics-panel__timeline-chart">
              {stats.timelineByYear.map((entry) => (
                <div key={entry.year} className="statistics-panel__timeline-item">
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
            className="statistics-panel__card"
            style={{
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.connectionDistributionTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.connectionDistributionDetail}
            </div>
            <div className="statistics-panel__distribution-list">
              {stats.connectionDistribution.map((entry) => (
                <div
                  key={entry.bucket}
                  className="statistics-panel__distribution-row"
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
            className="statistics-panel__card"
            style={{
              background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
            }}
          >
            <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
              {UI_COPY.nodeEditor.domainStats.strengthDistributionTitle}
            </div>
            <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
              {UI_COPY.nodeEditor.domainStats.strengthDistributionDetail}
            </div>
            <div className="statistics-panel__distribution-list">
              {stats.strengthDistribution.map((entry) => (
                <div
                  key={entry.strength}
                  className="statistics-panel__distribution-row"
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
          className="statistics-panel__card"
          style={{
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
          }}
        >
          <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
            {UI_COPY.nodeEditor.domainStats.topConnectedNodesTitle}
          </div>
          <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
            {UI_COPY.nodeEditor.domainStats.topConnectedNodesDetail}
          </div>
          <div className="statistics-panel__top-connected-list">
            {stats.topConnectedNodes.map((entry) => (
              <div
                key={entry.id}
                className="statistics-panel__top-connected-row"
              >
                <div style={{ minWidth: 0 }}>
                  <div className="statistics-panel__top-connected-label" style={{ fontSize: detailLayout ? '0.78rem' : '0.82rem' }}>
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
        className="statistics-panel__treemap-card"
        style={{
          background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
        }}
      >
        <div style={{ fontSize: '0.76rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.68 }}>
          {UI_COPY.nodeEditor.domainStats.treemapTitle}
        </div>
        <div style={{ marginTop: '0.34rem', fontSize: '0.8rem', lineHeight: 1.45, opacity: 0.72 }}>
          {UI_COPY.nodeEditor.domainStats.treemapDetail}
        </div>
        <div className="statistics-panel__treemap-canvas">
          {treemapLayout.map((entry) => {
            const intensity = 0.18 + (entry.count / maxCount) * 0.34;
            const compact = detailLayout ? entry.width < 28 || entry.height < 22 : entry.width < 22 || entry.height < 18;
            return (
              <div
                key={entry.domain}
                className={`statistics-panel__treemap-tile-shell${compact ? ' statistics-panel__treemap-tile-shell--compact' : ''}`}
                style={{
                  position: 'absolute',
                  left: `${entry.x}%`,
                  top: `${entry.y}%`,
                  width: `${entry.width}%`,
                  height: `${entry.height}%`,
                }}
              >
                <div
                  className={`statistics-panel__treemap-tile${compact ? ' statistics-panel__treemap-tile--compact' : ''}`}
                  style={{
                    border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
                    background: `color-mix(in srgb, var(--color-background) ${Math.round(86 - intensity * 10)}%, white ${Math.round(14 + intensity * 10)}%)`,
                    boxShadow:
                      'var(--greenpage-node-ring-shadow-prefix, inset 0 0 0) var(--greenpage-node-ring-width, 1.5px) color-mix(in srgb, var(--color-secondary) 20%, transparent)',
                    color: 'var(--color-text)',
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
                        className="statistics-panel__delete-button"
                      >
                        {UI_COPY.nodeEditor.domainStats.delete}
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <div className="statistics-panel__treemap-value">
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
