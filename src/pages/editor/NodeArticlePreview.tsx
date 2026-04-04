import { UI_COPY } from '../../configs/ui/uiCopy';
import ArticleGalleryBlock from '../../shared/ui/ArticleGalleryBlock';
import { Footnote } from '../../shared/ui/StyledTextBlocks';
import { getDisplayDomain, resolveAssetUrl, type GraphContentNode, type NodeArticleSection } from '../graph/content/Nodes';
import {
  DETAIL_READING_WIDTH,
  DETAIL_SECTION_WIDTH,
  renderContentBlock,
  renderMeta,
  renderSectionHeading,
} from './articlePreviewShared';
import { renderInlineMarkdown } from './inlineMarkdown';

function renderSection(section: NodeArticleSection, index: number) {
  return (
    <section
      key={section.id ?? `${section.label}-${index}`}
      style={{
        marginTop: index === 0 ? '2.2rem' : '2.5rem',
        maxWidth: DETAIL_SECTION_WIDTH,
        marginInline: 'auto',
      }}
    >
      {renderSectionHeading(section.label)}
      <div>{section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex))}</div>
    </section>
  );
}

type NodeArticlePreviewProps = {
  node: GraphContentNode;
};

const NodeArticlePreview = ({ node }: NodeArticlePreviewProps) => {
  const articleSections = node.sections;

  return (
    <div
      style={{
        minHeight: '100%',
        color: 'var(--color-text)',
      }}
    >
      <section
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          marginInline: 'auto',
          padding: '2.3rem 2rem 2.35rem',
          borderRadius: '34px',
          background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
        }}
      >
        <Footnote style={{ textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.74, fontSize: '0.68rem' }}>
          {getDisplayDomain(node.domain)}
        </Footnote>
        <h1 style={{ margin: '0.45rem 0 0', fontSize: 'clamp(2.35rem, 5vw, 4rem)', lineHeight: 0.96, letterSpacing: '-0.04em' }}>{node.title}</h1>
        {node.subtitle && <div style={{ marginTop: '0.9rem', fontSize: '1.08rem', opacity: 0.8 }}>{node.subtitle}</div>}
        <p style={{ margin: '1.2rem 0 0', maxWidth: DETAIL_READING_WIDTH, fontSize: '1.02rem', lineHeight: 1.8 }}>{node.summary}</p>

        {renderMeta(node.meta)}

        {node.tags && node.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.15rem' }}>
            {node.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '0.34rem 0.74rem',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: '1px solid color-mix(in srgb, var(--color-secondary) 44%, transparent)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {node.hero?.image && (
          <figure style={{ margin: '1.5rem 0 0', maxWidth: DETAIL_SECTION_WIDTH }}>
            <img
              src={resolveAssetUrl(node.hero.image.src)}
              alt={node.hero.image.alt}
              style={{
                display: 'block',
                width: '100%',
                borderRadius: '22px',
                objectFit: 'cover',
                aspectRatio: '16 / 9',
                background: 'color-mix(in srgb, var(--color-background) 94%, white 6%)',
              }}
            />
            {node.hero.image.caption && (
              <figcaption style={{ marginTop: '0.65rem', fontSize: '0.78rem', lineHeight: 1.58, opacity: 0.8, textAlign: 'center' }}>
                {renderInlineMarkdown(node.hero.image.caption, 'hero-caption')}
              </figcaption>
            )}
          </figure>
        )}
      </section>

      {node.gallery && node.gallery.length > 0 && (
        <section style={{ marginTop: '2.2rem', maxWidth: DETAIL_SECTION_WIDTH, marginInline: 'auto' }}>
          {renderSectionHeading(UI_COPY.nodeDetailPage.sections.gallery)}
          <ArticleGalleryBlock
            items={node.gallery}
            columns={Math.min(3, Math.max(1, node.gallery.length))}
            align="height"
            keyPrefix="top-gallery"
            maxWidth={DETAIL_SECTION_WIDTH}
            marginBottom="0"
            renderCaption={(caption, captionKeyPrefix) => renderInlineMarkdown(caption, captionKeyPrefix)}
          />
        </section>
      )}

      {articleSections && articleSections.length > 0 && articleSections.map((section, index) => renderSection(section, index))}
    </div>
  );
};

export default NodeArticlePreview;
