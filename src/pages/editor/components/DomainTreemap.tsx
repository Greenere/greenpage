import { UI_COPY } from '../../../configs/ui/uiCopy';
import type { DomainId } from '../../../configs/content/domains';

export type DomainTreemapEntry = {
  domain: DomainId;
  display: string;
  cardTag: string;
  count: number;
  removable: boolean;
};

function buildTreemapLayout(
  entries: DomainTreemapEntry[],
  x: number,
  y: number,
  width: number,
  height: number,
): Array<DomainTreemapEntry & { x: number; y: number; width: number; height: number }> {
  if (entries.length === 0 || width <= 0 || height <= 0) return [];
  if (entries.length === 1) {
    return [{ ...entries[0], x, y, width, height }];
  }

  const getWeight = (entry: DomainTreemapEntry) => Math.max(entry.count, 1);
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

export function DomainTreemap({
  entries,
  onDeleteDomain,
}: {
  entries: DomainTreemapEntry[];
  onDeleteDomain: (entry: DomainTreemapEntry) => void;
}) {
  const sortedEntries = [...entries].sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain));
  const layout = buildTreemapLayout(sortedEntries, 0, 0, 100, 100);
  const maxCount = Math.max(...entries.map((entry) => entry.count), 1);
  const totalNodes = entries.reduce((sum, entry) => sum + entry.count, 0);

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
          position: 'relative',
          marginTop: '0.9rem',
          width: '100%',
          flex: 1,
          minHeight: '20rem',
          borderRadius: '22px',
          overflow: 'hidden',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--color-background) 92%, white 8%), color-mix(in srgb, var(--color-background) 84%, white 16%))',
          border: '1px solid color-mix(in srgb, var(--color-secondary) 24%, transparent)',
        }}
      >
        {layout.map((entry) => {
          const intensity = 0.18 + (entry.count / maxCount) * 0.34;
          return (
            <div
              key={entry.domain}
              style={{
                position: 'absolute',
                left: `${entry.x}%`,
                top: `${entry.y}%`,
                width: `${entry.width}%`,
                height: `${entry.height}%`,
                padding: '0.9rem',
                border: '1px solid color-mix(in srgb, var(--color-secondary) 18%, transparent)',
                background: `color-mix(in srgb, var(--color-text) ${Math.round(intensity * 100)}%, var(--color-background))`,
                color: intensity > 0.34 ? 'var(--color-background)' : 'var(--color-text)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.72 }}>
                  {entry.cardTag}
                </div>
                {entry.removable ? (
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
                <div style={{ fontSize: entry.width < 22 || entry.height < 18 ? '0.95rem' : '1.18rem', fontWeight: 700, lineHeight: 1.05 }}>
                  {entry.display}
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', opacity: 0.78 }}>
                  {UI_COPY.nodeEditor.domainStats.nodeCount(entry.count)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
