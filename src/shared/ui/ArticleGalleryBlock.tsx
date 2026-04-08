import { type ReactNode } from 'react';

import { type NodeGalleryAlignment, type NodeGalleryImage, type NodeGalleryMode } from '../../pages/graph/content/Nodes';
import ArticleGallery from './ArticleGallery';

type ArticleGalleryBlockProps = {
  items: NodeGalleryImage[];
  keyPrefix: string;
  columns?: number;
  align?: NodeGalleryAlignment;
  mode?: NodeGalleryMode;
  maxWidth?: string;
  marginBottom?: string;
  renderCaption?: (caption: string, keyPrefix: string) => ReactNode;
};

export default function ArticleGalleryBlock({
  items,
  keyPrefix,
  columns,
  align = 'height',
  mode = 'default',
  maxWidth = '48rem',
  marginBottom = '1.3rem',
  renderCaption,
}: ArticleGalleryBlockProps) {
  const galleryColumns = columns ?? Math.min(3, Math.max(1, items.length));

  return (
    <div
      style={{
        maxWidth,
        marginBottom,
      }}
    >
      <ArticleGallery
        items={items}
        columns={galleryColumns}
        align={align}
        mode={mode}
        keyPrefix={keyPrefix}
        renderCaption={renderCaption}
      />
    </div>
  );
}
