import { type NodeGalleryAlignment, type NodeGalleryImage, type NodeGalleryMode } from '../graph/content/Nodes';
import SharedArticleGallery from '../../shared/ui/ArticleGallery';
import { renderInlineMarkdown } from './inlineMarkdown';

type ArticleGalleryProps = {
  items: NodeGalleryImage[];
  columns: number;
  align: NodeGalleryAlignment;
  mode?: NodeGalleryMode;
  keyPrefix: string;
};

export default function ArticleGallery({ items, columns, align, mode = 'default', keyPrefix }: ArticleGalleryProps) {
  return (
    <SharedArticleGallery
      items={items}
      columns={columns}
      align={align}
      mode={mode}
      keyPrefix={keyPrefix}
      renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix)}
    />
  );
}
