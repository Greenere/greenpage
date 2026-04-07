import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { PAGE_BACK_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import {
  buildStatisticsDomainEntries,
  buildStatisticsSummary,
} from '../../shared/statistics/graphStatistics';
import { applyThemeVars } from '../../shared/styles/colors';
import DetailPageSkeleton from '../../shared/ui/DetailPageSkeleton';
import { StatisticsPanel } from '../../shared/ui/StatisticsPanel';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import DetailPageLanguageToggle from './DetailPageLanguageToggle';
import ThemePicker from './ThemePicker';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import { getDisplayDomain, loadGraphModel, readCachedGraphModel, type GraphModel } from './content/Nodes';
import { DETAIL_SECTION_WIDTH } from './DetailContent';
import './GraphStatisticsPage.css';

const GraphStatisticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const [graphModel, setGraphModel] = useState<GraphModel | null>(() => readCachedGraphModel(language));
  const [graphError, setGraphError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());

  const handleThemeChange = (nextTheme: Theme) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const handleBackToGraph = () => {
    navigateWithViewTransition(
      () => {
        navigate('/');
      },
      { transitionConfig: PAGE_BACK_TRANSITION_CONFIG }
    );
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
    setGraphModel(readCachedGraphModel(language));
    setGraphError(null);
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

  const statisticsEntries = useMemo(
    () => buildStatisticsDomainEntries(graphModel?.nodes ?? [], getDisplayDomain),
    [graphModel]
  );
  const statisticsSummary = useMemo(
    () => buildStatisticsSummary(graphModel?.nodes ?? [], graphModel?.relations ?? []),
    [graphModel]
  );

  if (graphError) {
    return (
      <div style={{ minHeight: '100vh', padding: '2rem', color: 'crimson' }}>
        {UI_COPY.graphHome.errorLoading}: {graphError}
      </div>
    );
  }

  if (!graphModel) {
    return <DetailPageSkeleton variant="node" />;
  }

  const pageStyle = {
    minHeight: '100vh',
    color: 'var(--color-text)',
    ['--greenpage-detail-action-border-width-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleWidth,
    ['--greenpage-detail-action-border-opacity-idle' as const]: DETAIL_PAGE_ACTION_BORDER.idleOpacity,
    ['--greenpage-detail-action-border-width-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeWidth,
    ['--greenpage-detail-action-border-opacity-active' as const]: DETAIL_PAGE_ACTION_BORDER.activeOpacity,
    ['--greenpage-detail-action-ring-shadow-prefix' as const]: getHighlightBorderShadowPrefix(
      DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION
    ),
  } as CSSProperties;

  return (
    <div className="graph-statistics-page" style={pageStyle}>
      <div className="graph-statistics-page__inner">
        <div
          className="graph-statistics-page__topbar"
          style={{
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
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
            <span>{UI_COPY.nodeDetailPage.backToGraph}</span>
          </Link>
          <div
            className="graph-statistics-page__actions"
          >
            <DetailPageLanguageToggle />
            <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
          </div>
        </div>

        <section
          className="graph-statistics-page__section"
          style={{
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
          }}
        >
          <div className="graph-statistics-page__intro">
            <div
              style={{
                fontSize: '0.76rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.68,
              }}
            >
              {UI_COPY.graphStatisticsPage.eyebrow}
            </div>
            <h1
              style={{
                margin: '0.55rem 0 0',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1,
              }}
            >
              {UI_COPY.nodeEditor.domainStats.title}
            </h1>
            <p
              style={{
                margin: '0.7rem 0 0',
                fontSize: '0.98rem',
                lineHeight: 1.65,
                opacity: 0.76,
              }}
            >
              {UI_COPY.nodeEditor.domainStats.subtitle(graphModel.nodes.length, statisticsEntries.length)}
            </p>
          </div>

          <div className="graph-statistics-page__panel">
            <StatisticsPanel entries={statisticsEntries} stats={statisticsSummary} panelLayout="detail" />
          </div>
        </section>
      </div>
    </div>
  );
};

export default GraphStatisticsPage;
