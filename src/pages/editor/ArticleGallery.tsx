import { type NodeGalleryAlignment, type NodeGalleryImage } from '../graph/content/Nodes';
import SharedArticleGallery from '../../shared/ui/ArticleGallery';
import { renderInlineMarkdown } from './inlineMarkdown';

type ArticleGalleryProps = {
  items: NodeGalleryImage[];
  columns: number;
  align: NodeGalleryAlignment;
  keyPrefix: string;
};

export default function ArticleGallery({ items, columns, align, keyPrefix }: ArticleGalleryProps) {
  return (
    <SharedArticleGallery
      items={items}
      columns={columns}
      align={align}
      keyPrefix={keyPrefix}
      renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix)}
    />
  );
}
