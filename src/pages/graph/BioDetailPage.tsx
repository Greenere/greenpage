import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { DOMAIN_ORDER } from '../../configs/content/domains';
import { THEME_CONFIG } from '../../configs/ui/themes';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { applyThemeVars } from '../../shared/styles/colors';
import { Footnote } from '../../shared/ui/StyledTextBlocks';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import { BIOTHEME, readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import { loadBioPageContent, readCachedBioPageContent, type BioPageContent } from './content/BioPage';
import DetailPageLanguageToggle from './DetailPageLanguageToggle';
import ThemePicker from './ThemePicker';
import {
  getDisplayDomain,
  getLatestNodesByDomain,
  getNodeDetailPath,
  loadGraphModel,
  readCachedGraphModel,
  resolveAssetUrl,
  type GraphCardNode,
  type GraphModel,
} from './content/Nodes';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import { renderContentBlock } from '../editor/articlePreviewShared';

const GRAPH_RETURN_FOCUS_NODE_KEY = 'greenpage-graph-return-focus-node';
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

const BioDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const [bioContent, setBioContent] = useState<BioPageContent | null>(() => readCachedBioPageContent(language));
  const [bioError, setBioError] = useState<string | null>(null);
  const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel(language));
  const [graphError, setGraphError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const portrait = BIOTHEME[theme];
  const themeLabel = THEME_CONFIG[theme].label;
  const handleThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const handleNavigateWithTransition = (href: string) => {
    navigateWithViewTransition(() => {
      navigate(href);
    }, { resetScrollTop: href.startsWith('/nodes/') });
  };

  const handleBackToGraph = () => {
    window.sessionStorage.setItem(GRAPH_RETURN_FOCUS_NODE_KEY, 'bio');
    handleNavigateWithTransition('/');
  };

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        setTheme(readStoredTheme());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    setBioContent(readCachedBioPageContent(language));
    setGraphModel(readCachedGraphModel(language));
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    if (bioContent) {
      return () => {
        cancelled = true;
      };
    }

    loadBioPageContent(language)
      .then((content) => {
        if (cancelled) return;
        setBioContent(content);
        setBioError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBioError(error instanceof Error ? error.message : UI_COPY.bioDetailPage.errorLoading);
      });

    return () => {
      cancelled = true;
    };
  }, [bioContent, language]);

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
        setGraphError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setGraphError(error instanceof Error ? error.message : UI_COPY.graphHome.errorLoading);
      });

    return () => {
      cancelled = true;
    };
  }, [graphModel, language]);

  const pathEntries = useMemo(() => (graphModel ? getBioPathEntries(graphModel) : []), [graphModel]);

  if (bioError || graphError) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'crimson' }}>
        {UI_COPY.bioDetailPage.errorLoading}: {bioError ?? graphError}
      </div>
    );
  }

  if (!bioContent || !graphModel) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'var(--color-text)' }}>
        {UI_COPY.bioDetailPage.loading}
      </div>
    );
  }

  const detailPageStyle = {
    minHeight: '100vh',
    color: 'var(--color-text)',
    ['--greenpage-detail-action-border-width-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleWidth,
    ['--greenpage-detail-action-border-opacity-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleOpacity,
    ['--greenpage-detail-action-border-width-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeWidth,
    ['--greenpage-detail-action-border-opacity-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeOpacity,
    ['--greenpage-detail-action-ring-shadow-prefix' as const]: getHighlightBorderShadowPrefix(DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION),
  } as CSSProperties;

  return (
    <div style={detailPageStyle}>
      <div
        style={{
          maxWidth: '72rem',
          margin: '0 auto',
          padding: '2rem 1.4rem 4.5rem',
        }}
      >
        <div
          style={{
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <Link
            to="/"
            className="node-card-detail-link node-page-back-link"
            onClick={(event) => {
              event.preventDefault();
              handleBackToGraph();
            }}
          >
            <span>{UI_COPY.bioDetailPage.backToGraph}</span>
          </Link>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '0.4rem',
            }}
          >
            <DetailPageLanguageToggle />
            <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
          </div>
        </div>

        <section
          style={{
            marginTop: '1.15rem',
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
                {bioContent.eyebrow ?? UI_COPY.bioDetailPage.fallbackEyebrow}
              </Footnote>
              <h1
                style={{
                  margin: '0.45rem 0 0',
                  fontSize: 'clamp(2.35rem, 5vw, 4rem)',
                  lineHeight: 0.96,
                  letterSpacing: '-0.04em',
                }}
              >
                {bioContent.name}
              </h1>
              <div style={{ marginTop: '0.9rem', fontSize: '1.08rem', opacity: 0.8 }}>
                {bioContent.subtitle}
              </div>
              <p
                style={{
                  margin: '1.2rem 0 0',
                  maxWidth: DETAIL_READING_WIDTH,
                  fontSize: '1.02rem',
                  lineHeight: 1.8,
                }}
              >
                {bioContent.summary}
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
                {(bioContent.facts ?? []).map((fact) => (
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
                    {bioContent.themeFactLabel ?? UI_COPY.bioDetailPage.fallbackThemeFactLabel}
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
              <a
                href={portrait.url}
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
                  alt={UI_COPY.bioDetailPage.portraitAlt(bioContent.name)}
                  style={{
                    display: 'block',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '24px',
                    border: '2px solid color-mix(in srgb, var(--color-secondary) 42%, transparent)',
                  }}
                />
              </a>
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

        <section
          style={{
            marginTop: '2.2rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
          }}
        >
          {bioContent.sections?.map((section, sectionIndex) => (
            <section
              key={section.id ?? section.label}
              style={{
                marginTop: sectionIndex === 0 ? 0 : '2.5rem',
              }}
            >
              {renderSectionHeading(section.label)}
              <div>{section.blocks.map((block, blockIndex) => renderContentBlock(block, blockIndex))}</div>
            </section>
          ))}
        </section>

        <section
          style={{
            marginTop: '2.5rem',
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
          }}
        >
          {renderSectionHeading(bioContent.pathsSectionLabel ?? UI_COPY.bioDetailPage.fallbackPathsSectionLabel)}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '0.85rem',
            }}
          >
            {pathEntries.map((entry) => (
              <Link
                key={entry.id}
                to={getNodeDetailPath(entry.id)}
                className="node-detail-related-link"
                onClick={(event) => {
                  event.preventDefault();
                  handleNavigateWithTransition(getNodeDetailPath(entry.id));
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.8rem 0.85rem',
                  borderRadius: '16px',
                  border: '1px solid transparent',
                  color: 'var(--color-text)',
                  background: 'color-mix(in srgb, var(--color-background) 84%, white 16%)',
                  textDecoration: 'none',
                }}
              >
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
                <div style={{ marginTop: '0.3rem', fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.35 }}>
                  {entry.title}
                </div>
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
              </Link>
            ))}
          </div>
        </section>

        {bioContent.links && bioContent.links.length > 0 && (
          <section
            style={{
              marginTop: '2.5rem',
              maxWidth: DETAIL_SECTION_WIDTH,
              marginInline: 'auto',
            }}
          >
            {renderSectionHeading(bioContent.linksSectionLabel ?? UI_COPY.bioDetailPage.fallbackLinksSectionLabel)}
            <div
              style={{
                maxWidth: DETAIL_READING_WIDTH,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.65rem 1rem',
              }}
            >
              {bioContent.links.map((link) => (
                <BioLink key={`${link.label}-${link.href}`} href={link.href}>
                  {link.label}
                </BioLink>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BioDetailPage;
