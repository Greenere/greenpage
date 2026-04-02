import { useState } from 'react';

import { resolveAssetUrl, type NodeGalleryAlignment, type NodeGalleryImage } from '../graph-home/content/Nodes';
import { renderInlineMarkdown } from './inlineMarkdown';

const DEFAULT_GALLERY_RATIO = 4 / 3;
const GALLERY_TRACKS_PER_COLUMN = 6;

function chunkGalleryItems<T>(items: T[], size: number) {
  const rows: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }

  return rows;
}

function getNormalizedGallerySpans(aspectRatios: number[], totalTracks: number) {
  if (aspectRatios.length === 0) {
    return [];
  }

  const totalRatio = aspectRatios.reduce((sum, ratio) => sum + ratio, 0) || aspectRatios.length;
  const rawSpans = aspectRatios.map((ratio) => (ratio / totalRatio) * totalTracks);
  const spans = rawSpans.map((span) => Math.max(1, Math.floor(span)));
  let remainingTracks = totalTracks - spans.reduce((sum, span) => sum + span, 0);

  if (remainingTracks > 0) {
    const remainders = rawSpans.map((span, index) => ({ index, remainder: span - Math.floor(span) }));
    remainders.sort((left, right) => right.remainder - left.remainder);

    let cursor = 0;
    while (remainingTracks > 0) {
      const target = remainders[cursor % remainders.length];
      spans[target.index] += 1;
      remainingTracks -= 1;
      cursor += 1;
    }
  }

  return spans;
}

type ArticleGalleryProps = {
  items: NodeGalleryImage[];
  columns: number;
  align: NodeGalleryAlignment;
  keyPrefix: string;
};

const ArticleGallery = ({ items, columns, align, keyPrefix }: ArticleGalleryProps) => {
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const galleryRows = chunkGalleryItems(items, columns);
  const totalTracks = columns * GALLERY_TRACKS_PER_COLUMN;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${totalTracks}, minmax(0, 1fr))`,
        gap: '1.05rem',
      }}
    >
      {galleryRows.flatMap((row, rowIndex) => {
        const rowAspectRatios = row.map((image, imageIndex) => {
          const absoluteIndex = rowIndex * columns + imageIndex;
          const itemKey = `${keyPrefix}-${image.src}-${absoluteIndex}`;
          const measuredRatio = aspectRatios[itemKey] ?? DEFAULT_GALLERY_RATIO;
          return align === 'height' ? Math.sqrt(measuredRatio) : measuredRatio;
        });
        const rowSpans = getNormalizedGallerySpans(rowAspectRatios, totalTracks);

        return row.map((image, imageIndex) => {
          const absoluteIndex = rowIndex * columns + imageIndex;
          const itemKey = `${keyPrefix}-${image.src}-${absoluteIndex}`;

          return (
            <figure
              key={itemKey}
              style={{
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                gridColumn: `span ${rowSpans[imageIndex] ?? GALLERY_TRACKS_PER_COLUMN}`,
              }}
            >
              <img
                src={resolveAssetUrl(image.src)}
                alt={image.alt}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (!naturalWidth || !naturalHeight) return;

                  const nextAspectRatio = naturalWidth / naturalHeight;
                  setAspectRatios((current) =>
                    current[itemKey] === nextAspectRatio ? current : { ...current, [itemKey]: nextAspectRatio }
                  );
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  height: align === 'height' ? '15rem' : 'auto',
                  borderRadius: '15px',
                  objectFit: align === 'height' ? 'contain' : undefined,
                }}
              />
              {image.caption && (
                <figcaption
                  style={{
                    padding: '0.8rem 0.15rem 0 0.15rem',
                    color: 'var(--color-text)',
                    fontSize: '0.76rem',
                    lineHeight: 1.55,
                    opacity: 0.84,
                    textAlign: 'center',
                  }}
                >
                  {renderInlineMarkdown(image.caption, `${itemKey}-caption`)}
                </figcaption>
              )}
            </figure>
          );
        });
      })}
    </div>
  );
};

export default ArticleGallery;
