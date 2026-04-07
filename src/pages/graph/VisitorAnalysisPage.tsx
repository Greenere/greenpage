import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  DETAIL_PAGE_ACTION_BORDER,
  DETAIL_PAGE_ACTION_BORDER_GROWTH_DIRECTION,
  getHighlightBorderShadowPrefix,
} from '../../configs/graph/highlight';
import { PAGE_BACK_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';
import { UI_COPY } from '../../configs/ui/uiCopy';
import { useAppLanguage } from '../../i18n/useAppLanguage';
import { applyThemeVars } from '../../shared/styles/colors';
import DetailPageSkeleton from '../../shared/ui/DetailPageSkeleton';
import { navigateWithViewTransition } from '../../shared/ui/viewTransitions';
import DetailPageLanguageToggle from './DetailPageLanguageToggle';
import { DETAIL_SECTION_WIDTH } from './DetailContent';
import ThemePicker from './ThemePicker';
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from './content/BioTheme';
import './VisitorAnalysisPage.css';

const VISITOR_SUMMARY_ENDPOINT = 'https://visitor-analysis.haoyanghowyoung.workers.dev/public/summary';
const DAY_OPTIONS = [7, 30, 90] as const;
const DEFAULT_DAYS = 30;

type DayOption = (typeof DAY_OPTIONS)[number];

type VisitorSummaryResponse = {
  period_days: number;
  filters: {
    site: string | null;
  };
  total_unique_visitors: number;
  countries: Array<{
    country: string | null;
    views: number;
  }>;
  pages: Array<{
    page_path: string | null;
    views: number;
  }>;
};

function normalizeDays(raw: string | null): DayOption {
  const parsed = Number.parseInt(raw ?? '', 10);
  return DAY_OPTIONS.find((option) => option === parsed) ?? DEFAULT_DAYS;
}

function formatPagePrimaryLabel(pagePath: string | null, homeLabel: string, unknownLabel: string) {
  if (!pagePath) {
    return unknownLabel;
  }

  const normalizedPath = pagePath.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/' || normalizedPath === '/greenpage') {
    return homeLabel;
  }

  const lastSegment = normalizedPath.split('/').filter(Boolean).at(-1);
  if (!lastSegment) {
    return homeLabel;
  }

  return lastSegment
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatCountryLabel(
  countryCode: string | null,
  displayNames: Intl.DisplayNames | null,
  unknownLabel: string
) {
  if (!countryCode) {
    return unknownLabel;
  }

  return displayNames?.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
}

const VisitorAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useAppLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDays = normalizeDays(searchParams.get('days'));
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [summary, setSummary] = useState<VisitorSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale]
  );
  const countryDisplayNames = useMemo(() => {
    if (typeof Intl.DisplayNames !== 'function') {
      return null;
    }

    return new Intl.DisplayNames(locale, { type: 'region' });
  }, [locale]);

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
    const controller = new AbortController();
    const requestUrl = new URL(VISITOR_SUMMARY_ENDPOINT);
    requestUrl.searchParams.set('days', String(selectedDays));

    setLoading(true);
    setError(null);

    fetch(requestUrl.toString(), {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`${UI_COPY.visitorAnalysisPage.requestFailed(response.status)}`);
        }

        return (await response.json()) as VisitorSummaryResponse;
      })
      .then((payload) => {
        setSummary(payload);
        setFetchedAt(new Date());
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          fetchError instanceof Error ? fetchError.message : UI_COPY.visitorAnalysisPage.errorLoading
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedDays]);

  const sortedCountries = useMemo(
    () => [...(summary?.countries ?? [])].sort((left, right) => right.views - left.views),
    [summary]
  );
  const sortedPages = useMemo(
    () => [...(summary?.pages ?? [])].sort((left, right) => right.views - left.views),
    [summary]
  );

  const totalViews = useMemo(
    () => sortedPages.reduce((sum, entry) => sum + entry.views, 0),
    [sortedPages]
  );
  const trackedPageCount = sortedPages.length;
  const trackedCountryCount = sortedCountries.length;
  const maxPageViews = Math.max(...sortedPages.map((entry) => entry.views), 1);
  const maxCountryViews = Math.max(...sortedCountries.map((entry) => entry.views), 1);
  const effectiveDays = summary?.period_days ?? selectedDays;

  if (loading && !summary && !error) {
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
    <div className="visitor-analysis-page" style={pageStyle}>
      <div className="visitor-analysis-page__inner">
        <div
          className="visitor-analysis-page__topbar"
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
          <div className="visitor-analysis-page__actions">
            <DetailPageLanguageToggle />
            <ThemePicker theme={theme} setTheme={handleThemeChange} variant="inline" />
          </div>
        </div>

        <section
          className="visitor-analysis-page__section"
          style={{
            maxWidth: DETAIL_SECTION_WIDTH,
            marginInline: 'auto',
            background: 'color-mix(in srgb, var(--color-background) 90%, white 10%)',
          }}
        >
          <div className="visitor-analysis-page__header">
            <div className="visitor-analysis-page__intro">
              <div className="visitor-analysis-page__eyebrow">{UI_COPY.visitorAnalysisPage.eyebrow}</div>
              <h1 className="visitor-analysis-page__title">{UI_COPY.visitorAnalysisPage.title}</h1>
              <p className="visitor-analysis-page__subtitle">
                {UI_COPY.visitorAnalysisPage.subtitle(effectiveDays)}
              </p>
            </div>

            <div className="visitor-analysis-page__controls">
              <div className="visitor-analysis-page__window-label">
                {UI_COPY.visitorAnalysisPage.windowLabel}
              </div>
              <div className="visitor-analysis-page__window-toggle" role="tablist" aria-label={UI_COPY.visitorAnalysisPage.windowLabel}>
                {DAY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={selectedDays === option}
                    className={`visitor-analysis-page__window-button${
                      selectedDays === option ? ' visitor-analysis-page__window-button--active' : ''
                    }`}
                    onClick={() => {
                      setSearchParams({ days: String(option) });
                    }}
                  >
                    {UI_COPY.visitorAnalysisPage.dayRange(option)}
                  </button>
                ))}
              </div>
              {fetchedAt ? (
                <div className="visitor-analysis-page__updated-at">
                  {UI_COPY.visitorAnalysisPage.updatedAt(dateFormatter.format(fetchedAt))}
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="visitor-analysis-page__message visitor-analysis-page__message--error">
              <strong>{UI_COPY.visitorAnalysisPage.errorLoading}</strong>
              <span>{error}</span>
              <span>{UI_COPY.visitorAnalysisPage.localCorsHint}</span>
            </div>
          ) : null}

          {summary && totalViews === 0 ? (
            <div className="visitor-analysis-page__message">
              <strong>{UI_COPY.visitorAnalysisPage.emptyStateTitle}</strong>
              <span>{UI_COPY.visitorAnalysisPage.emptyStateDescription(effectiveDays)}</span>
            </div>
          ) : null}

          {summary ? (
            <>
              <div className="visitor-analysis-page__summary-grid">
                <article className="visitor-analysis-page__card">
                  <div className="visitor-analysis-page__card-label">
                    {UI_COPY.visitorAnalysisPage.uniqueVisitorsTitle}
                  </div>
                  <div className="visitor-analysis-page__card-value">
                    {numberFormatter.format(summary.total_unique_visitors)}
                  </div>
                  <p className="visitor-analysis-page__card-detail">
                    {UI_COPY.visitorAnalysisPage.uniqueVisitorsDetail(effectiveDays)}
                  </p>
                </article>

                <article className="visitor-analysis-page__card">
                  <div className="visitor-analysis-page__card-label">
                    {UI_COPY.visitorAnalysisPage.pageViewsTitle}
                  </div>
                  <div className="visitor-analysis-page__card-value">{numberFormatter.format(totalViews)}</div>
                  <p className="visitor-analysis-page__card-detail">
                    {UI_COPY.visitorAnalysisPage.pageViewsDetail}
                  </p>
                </article>

                <article className="visitor-analysis-page__card">
                  <div className="visitor-analysis-page__card-label">
                    {UI_COPY.visitorAnalysisPage.pagesTrackedTitle}
                  </div>
                  <div className="visitor-analysis-page__card-value">
                    {numberFormatter.format(trackedPageCount)}
                  </div>
                  <p className="visitor-analysis-page__card-detail">
                    {UI_COPY.visitorAnalysisPage.pagesTrackedDetail}
                  </p>
                </article>

                <article className="visitor-analysis-page__card">
                  <div className="visitor-analysis-page__card-label">
                    {UI_COPY.visitorAnalysisPage.countriesTrackedTitle}
                  </div>
                  <div className="visitor-analysis-page__card-value">
                    {numberFormatter.format(trackedCountryCount)}
                  </div>
                  <p className="visitor-analysis-page__card-detail">
                    {UI_COPY.visitorAnalysisPage.countriesTrackedDetail}
                  </p>
                </article>
              </div>

              <div className="visitor-analysis-page__grid">
                <section className="visitor-analysis-page__panel">
                  <div className="visitor-analysis-page__panel-heading">
                    <h2>{UI_COPY.visitorAnalysisPage.topPagesTitle}</h2>
                    <p>{UI_COPY.visitorAnalysisPage.topPagesDetail}</p>
                  </div>

                  {sortedPages.length > 0 ? (
                    <div className="visitor-analysis-page__rank-list">
                      {sortedPages.map((entry, index) => {
                        const pageLabel = formatPagePrimaryLabel(
                          entry.page_path,
                          UI_COPY.visitorAnalysisPage.homePageLabel,
                          UI_COPY.visitorAnalysisPage.unknownPageLabel
                        );

                        return (
                          <div key={`${entry.page_path ?? 'unknown'}-${index}`} className="visitor-analysis-page__rank-item">
                            <div className="visitor-analysis-page__rank-index">{index + 1}</div>
                            <div className="visitor-analysis-page__rank-body">
                              <div className="visitor-analysis-page__rank-row">
                                <div className="visitor-analysis-page__rank-label-group">
                                  <span className="visitor-analysis-page__rank-label">{pageLabel}</span>
                                  <span className="visitor-analysis-page__rank-subtitle">
                                    {entry.page_path ?? UI_COPY.visitorAnalysisPage.unknownPageLabel}
                                  </span>
                                </div>
                                <span className="visitor-analysis-page__rank-value">
                                  {UI_COPY.visitorAnalysisPage.viewsLabel(numberFormatter.format(entry.views))}
                                </span>
                              </div>
                              <div className="visitor-analysis-page__meter">
                                <span
                                  className="visitor-analysis-page__meter-fill"
                                  style={{ width: `${(entry.views / maxPageViews) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="visitor-analysis-page__empty-list">
                      {UI_COPY.visitorAnalysisPage.noPages}
                    </div>
                  )}
                </section>

                <section className="visitor-analysis-page__panel">
                  <div className="visitor-analysis-page__panel-heading">
                    <h2>{UI_COPY.visitorAnalysisPage.countriesTitle}</h2>
                    <p>{UI_COPY.visitorAnalysisPage.countriesDetail}</p>
                  </div>

                  {sortedCountries.length > 0 ? (
                    <div className="visitor-analysis-page__rank-list">
                      {sortedCountries.map((entry, index) => {
                        const countryLabel = formatCountryLabel(
                          entry.country,
                          countryDisplayNames,
                          UI_COPY.visitorAnalysisPage.unknownCountryLabel
                        );

                        return (
                          <div key={`${entry.country ?? 'unknown'}-${index}`} className="visitor-analysis-page__rank-item">
                            <div className="visitor-analysis-page__rank-index">{index + 1}</div>
                            <div className="visitor-analysis-page__rank-body">
                              <div className="visitor-analysis-page__rank-row">
                                <div className="visitor-analysis-page__rank-label-group">
                                  <span className="visitor-analysis-page__rank-label">{countryLabel}</span>
                                  <span className="visitor-analysis-page__rank-subtitle">
                                    {entry.country ?? UI_COPY.visitorAnalysisPage.unknownCountryLabel}
                                  </span>
                                </div>
                                <span className="visitor-analysis-page__rank-value">
                                  {UI_COPY.visitorAnalysisPage.viewsLabel(numberFormatter.format(entry.views))}
                                </span>
                              </div>
                              <div className="visitor-analysis-page__meter">
                                <span
                                  className="visitor-analysis-page__meter-fill"
                                  style={{ width: `${(entry.views / maxCountryViews) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="visitor-analysis-page__empty-list">
                      {UI_COPY.visitorAnalysisPage.noCountries}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default VisitorAnalysisPage;
