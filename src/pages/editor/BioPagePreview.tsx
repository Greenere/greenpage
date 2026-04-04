import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { DOMAIN_ORDER } from '../../configs/content/domains';
import { THEME_CONFIG } from '../../configs/ui/themes';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import { Footnote } from '../../shared/ui/StyledTextBlocks';
import { getStableImageViewTransitionName } from '../../shared/ui/viewTransitions';
import { BIOTHEME, type Theme } from '../graph/content/BioTheme';
import { getBioPortraitHref, type BioPageContent } from '../graph/content/BioPage';
import {
  getDisplayDomain,
  getLatestNodesByDomain,
  loadGraphModel,
  readCachedGraphModel,
  resolveAssetUrl,
  type GraphCardNode,
  type GraphModel,
} from '../graph/content/Nodes';
import { renderContentBlock } from './articlePreviewShared';

const DETAIL_READING_WIDTH = '46rem';
const DETAIL_SECTION_WIDTH = '48rem';

type BioLinkProps = {
  href: string;
  children: ReactNode;
};

function BioLink({ href, children }: BioLinkProps) {
  const sharedStyle: CSSProperties = {
    color: 'var(--color-text)',
    textDecoration: 'underline',
    textUnderlineOffset: '0.2em',
    textDecorationThickness: '1px',
    textDecorationColor: 'color-mix(in srgb, var(--color-secondary) 62%, transparent)',
  };

  const isExternal = href.startsWith('http://') || href.startsWith('https://');

  if (!href.startsWith('/') || isExternal) {
    return (
      <a href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined} style={sharedStyle}>
        {children}
      </a>
    );
  }

  return (
    <Link to={href} style={sharedStyle}>
      {children}
    </Link>
  );
}

function renderSectionHeading(label: string) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        marginBottom: '1.1rem',
        maxWidth: DETAIL_SECTION_WIDTH,
      }}
    >
      <Footnote
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: '0.68rem',
          opacity: 0.74,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Footnote>
      <div
        style={{
          flex: 1,
          height: '1px',
          background: 'color-mix(in srgb, var(--color-secondary) 28%, transparent)',
        }}
      />
    </div>
  );
}

function getBioPathEntries(model: GraphModel) {
  const latestByDomain = new Map(getLatestNodesByDomain(model).map((node) => [node.domain, node]));

  return DOMAIN_ORDER.map((domain) => latestByDomain.get(domain))
    .filter((node): node is GraphCardNode => node !== undefined)
    .sort((left, right) => DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain));
}

type BioPagePreviewProps = {
  content: BioPageContent;
  theme: Theme;
  hideSections?: boolean;
  customSections?: ReactNode;
  onOpenPathEntry?: (nodeId: string) => void;
};

function BioPathEntryCard({
  entry,
  onOpen,
}: {
  entry: GraphCardNode;
  onOpen?: (nodeId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const interactive = Boolean(onOpen);
  const content = (
    <>
      <Footnote
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          opacity: 0.7,
          fontSize: '0.58rem',
        }}
      >
        {getDisplayDomain(entry.domain)}
      </Footnote>
      <div style={{ marginTop: '0.3rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>{entry.title}</div>
      <div
        style={{
          marginTop: '0.38rem',
          fontSize: '0.76rem',
          lineHeight: 1.52,
          opacity: 0.8,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 4,
          overflow: 'hidden',
        }}
      >
        {entry.summary}
      </div>
    </>
  );

  const cardStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.8rem 0.85rem',
    borderRadius: '16px',
    border: interactive && hovered
      ? '1px solid color-mix(in srgb, var(--color-secondary) 46%, transparent)'
      : '1px solid transparent',
    background: interactive && hovered
      ? 'color-mix(in srgb, var(--color-background) 80%, white 20%)'
      : 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
    color: 'var(--color-text)',
    textAlign: 'left',
    fontFamily: 'inherit',
    textDecoration: 'none',
    cursor: interactive ? 'pointer' : 'default',
    boxShadow: interactive && hovered
      ? 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-active, 3) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-active, 0.9) * 100%), transparent)'
      : 'var(--greenpage-detail-action-ring-shadow-prefix, 0 0 0) calc(var(--greenpage-detail-action-border-width-idle, 0) * 1px) color-mix(in srgb, var(--color-secondary) calc(var(--greenpage-detail-action-border-opacity-idle, 0.8) * 100%), transparent)',
    transform: interactive && hovered ? 'translateY(-1px)' : 'translateY(0)',
    transition: 'box-shadow 180ms ease, background-color 180ms ease, transform 180ms ease, border-color 180ms ease',
  };

  if (!interactive) {
    return <div style={cardStyle}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(entry.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={cardStyle}
      aria-label={`Open ${entry.title} in the editor`}
      title={`Open ${entry.title} in the editor`}
    >
      {content}
    </button>
  );
}

export default function BioPagePreview({ content, theme, hideSections = false, customSections, onOpenPathEntry }: BioPagePreviewProps) {
  const { language } = useAppLanguage();
  const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel(language));
  const portrait = BIOTHEME[theme];
  const portraitTransitionName = getStableImageViewTransitionName(`bio-preview-portrait-${theme}`);
  const themeLabel = THEME_CONFIG[theme].label;
  const portraitHref = getBioPortraitHref(content);

  useEffect(() => {
    setGraphModel(readCachedGraphModel(language));
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    if (graphModel) {
      return () => {
        cancelled = true;
      };
    }

    loadGraphModel(undefined, language)
      .then((model) => {
        if (cancelled) return;
        setGraphModel(model);
      })
      .catch(() => {
        if (cancelled) return;
      });

    return () => {
      cancelled = true;
    };
  }, [graphModel, language]);

  const pathEntries = useMemo(() => (graphModel ? getBioPathEntries(graphModel) : []), [graphModel]);

  return (
    <div style={{ minHeight: '100%', color: 'var(--color-text)' }}>
      <section
        style={{
          maxWidth: DETAIL_SECTION_WIDTH,
          marginInline: 'auto',
          padding: '2.1rem 2rem 2.2rem',
          borderRadius: '34px',
          background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
            gap: '1.8rem',
            alignItems: 'start',
          }}
        >
          <div>
            <Footnote
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                opacity: 0.74,
                fontSize: '0.68rem',
              }}
            >
              {content.eyebrow ?? UI_COPY.bioDetailPage.fallbackEyebrow}
            </Footnote>
            <h1
              style={{
                margin: '0.45rem 0 0',
                fontSize: 'clamp(2.35rem, 5vw, 4rem)',
                lineHeight: 0.96,
                letterSpacing: '-0.04em',
              }}
            >
              {content.name}
            </h1>
            <div style={{ marginTop: '0.9rem', fontSize: '1.08rem', opacity: 0.8 }}>{content.subtitle}</div>
            <p
              style={{
                margin: '1.2rem 0 0',
                maxWidth: DETAIL_READING_WIDTH,
                fontSize: '1.02rem',
                lineHeight: 1.8,
              }}
            >
              {content.summary}
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
                gap: '0.95rem 1.2rem',
                marginTop: '1.35rem',
                maxWidth: DETAIL_READING_WIDTH,
              }}
            >
              {(content.facts ?? []).map((fact) => (
                <div key={`${fact.label}-${fact.value}`}>
                  <Footnote
                    style={{
                      textTransform: 'uppercase',
                      letterSpacing: '0.11em',
                      fontSize: '0.64rem',
                      opacity: 0.64,
                    }}
                  >
                    {fact.label}
                  </Footnote>
                  <div style={{ marginTop: '0.22rem', fontSize: '0.93rem', lineHeight: 1.45 }}>
                    {fact.href ? <BioLink href={fact.href}>{fact.value}</BioLink> : fact.value}
                  </div>
                </div>
              ))}
              <div>
                <Footnote
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.11em',
                    fontSize: '0.64rem',
                    opacity: 0.64,
                  }}
                >
                  {content.themeFactLabel ?? UI_COPY.bioDetailPage.fallbackThemeFactLabel}
                </Footnote>
                <div style={{ marginTop: '0.22rem', fontSize: '0.93rem', lineHeight: 1.45 }}>{themeLabel}</div>
              </div>
            </div>
          </div>

          <figure
            style={{
              margin: 0,
              justifySelf: 'center',
              width: 'min(100%, 16rem)',
            }}
          >
            {portraitHref ? (
              <a
                href={portraitHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'block',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <img
                  src={resolveAssetUrl(portrait.imgSrc)}
                  alt={UI_COPY.bioDetailPage.portraitAlt(content.name)}
                  style={{
                    display: 'block',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '24px',
                    border: '2px solid color-mix(in srgb, var(--color-secondary) 42%, transparent)',
                    viewTransitionName: portraitTransitionName,
                  }}
                />
              </a>
            ) : (
              <img
                src={resolveAssetUrl(portrait.imgSrc)}
                alt={UI_COPY.bioDetailPage.portraitAlt(content.name)}
                style={{
                  display: 'block',
                  width: '100%',
                  aspectRatio: '1 / 1',
                  objectFit: 'cover',
                  borderRadius: '24px',
                  border: '2px solid color-mix(in srgb, var(--color-secondary) 42%, transparent)',
                  viewTransitionName: portraitTransitionName,
                }}
              />
            )}
            <figcaption
              style={{
                marginTop: '0.7rem',
                textAlign: 'center',
                fontSize: '0.78rem',
                lineHeight: 1.58,
                opacity: 0.8,
              }}
            >
              {portrait.description}
            </figcaption>
          </figure>
        </div>
      </section>

      {customSections ? (
        <section
          style={{
            marginTop: '2.2rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
          }}
        >
          {customSections}
        </section>
      ) : !hideSections ? (
        <section
          style={{
            marginTop: '2.2rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
          }}
        >
          {content.sections?.map((section, sectionIndex) => (
            <section
              key={section.id ?? `${section.label}-${sectionIndex}`}
              style={{
                marginTop: sectionIndex === 0 ? 0 : '2.5rem',
              }}
            >
              {renderSectionHeading(section.label)}
              <div>{section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex))}</div>
            </section>
          ))}
        </section>
      ) : null}

      <section
        style={{
          marginTop: '2.5rem',
          maxWidth: DETAIL_SECTION_WIDTH,
          marginInline: 'auto',
        }}
      >
        {renderSectionHeading(content.pathsSectionLabel ?? UI_COPY.bioDetailPage.fallbackPathsSectionLabel)}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '0.85rem',
          }}
        >
          {pathEntries.map((entry) => (
            <BioPathEntryCard key={entry.id} entry={entry} onOpen={onOpenPathEntry} />
          ))}
        </div>
      </section>

      {content.links && content.links.length > 0 && (
        <section
          style={{
            marginTop: '2.5rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
          }}
        >
          {renderSectionHeading(content.linksSectionLabel ?? UI_COPY.bioDetailPage.fallbackLinksSectionLabel)}
          <div
            style={{
              maxWidth: DETAIL_READING_WIDTH,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.65rem 1rem',
            }}
          >
            {content.links.map((link) => (
              <BioLink key={`${link.label}-${link.href}`} href={link.href}>
                {link.label}
              </BioLink>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
