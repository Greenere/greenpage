import React from 'react';
import './DetailPageSkeleton.css';

type DetailPageSkeletonProps = {
  variant?: 'bio' | 'node';
  fullScreen?: boolean;
};

function SkeletonLine({ width, className }: { width: string; className?: string }) {
  return (
    <div
      className={`detail-page-skeleton__block${className ? ` ${className}` : ''}`}
      style={{ width }}
      aria-hidden="true"
    />
  );
}

const DetailPageSkeleton: React.FC<DetailPageSkeletonProps> = ({ variant = 'node', fullScreen = true }) => {
  const shellClassName = fullScreen
    ? 'detail-page-skeleton detail-page-skeleton--fullscreen'
    : 'detail-page-skeleton';

  return (
    <div className={shellClassName} aria-hidden="true">
      <div className="detail-page-skeleton__inner">
        <div className="detail-page-skeleton__topbar">
          <SkeletonLine width="7.5rem" className="detail-page-skeleton__button" />
          <div className="detail-page-skeleton__topbar-right">
            <SkeletonLine width="5.25rem" className="detail-page-skeleton__button" />
            <SkeletonLine width="8.5rem" className="detail-page-skeleton__button" />
          </div>
        </div>

        <section className="detail-page-skeleton__hero">
          <div className="detail-page-skeleton__hero-copy">
            <SkeletonLine width="5.2rem" className="detail-page-skeleton__eyebrow" />
            <SkeletonLine width={variant === 'bio' ? '15rem' : '22rem'} className="detail-page-skeleton__title" />
            <SkeletonLine width={variant === 'bio' ? '18rem' : '14rem'} className="detail-page-skeleton__subtitle" />
            <SkeletonLine width="100%" className="detail-page-skeleton__paragraph" />
            <SkeletonLine width="92%" className="detail-page-skeleton__paragraph" />
            <SkeletonLine width="84%" className="detail-page-skeleton__paragraph" />

            <div className="detail-page-skeleton__meta-grid">
              <div>
                <SkeletonLine width="4rem" className="detail-page-skeleton__meta-label" />
                <SkeletonLine width="7rem" className="detail-page-skeleton__meta-value" />
              </div>
              <div>
                <SkeletonLine width="4.5rem" className="detail-page-skeleton__meta-label" />
                <SkeletonLine width="8.5rem" className="detail-page-skeleton__meta-value" />
              </div>
              <div>
                <SkeletonLine width="3.25rem" className="detail-page-skeleton__meta-label" />
                <SkeletonLine width="6.75rem" className="detail-page-skeleton__meta-value" />
              </div>
            </div>
          </div>

          <div className={`detail-page-skeleton__media detail-page-skeleton__media--${variant}`}>
            <div className="detail-page-skeleton__block detail-page-skeleton__media-shape" />
            <SkeletonLine width="72%" className="detail-page-skeleton__caption" />
          </div>
        </section>

        <section className="detail-page-skeleton__section">
          <div className="detail-page-skeleton__section-heading">
            <SkeletonLine width="6.5rem" className="detail-page-skeleton__eyebrow" />
            <div className="detail-page-skeleton__rule" />
          </div>
          <SkeletonLine width="100%" className="detail-page-skeleton__paragraph" />
          <SkeletonLine width="96%" className="detail-page-skeleton__paragraph" />
          <SkeletonLine width="88%" className="detail-page-skeleton__paragraph" />
        </section>

        <section className="detail-page-skeleton__section">
          <div className="detail-page-skeleton__section-heading">
            <SkeletonLine width={variant === 'bio' ? '7.5rem' : '8rem'} className="detail-page-skeleton__eyebrow" />
            <div className="detail-page-skeleton__rule" />
          </div>
          <div className="detail-page-skeleton__cards">
            <div className="detail-page-skeleton__card">
              <SkeletonLine width="4rem" className="detail-page-skeleton__meta-label" />
              <SkeletonLine width="82%" className="detail-page-skeleton__card-title" />
              <SkeletonLine width="100%" className="detail-page-skeleton__card-text" />
              <SkeletonLine width="90%" className="detail-page-skeleton__card-text" />
            </div>
            <div className="detail-page-skeleton__card">
              <SkeletonLine width="4rem" className="detail-page-skeleton__meta-label" />
              <SkeletonLine width="76%" className="detail-page-skeleton__card-title" />
              <SkeletonLine width="100%" className="detail-page-skeleton__card-text" />
              <SkeletonLine width="86%" className="detail-page-skeleton__card-text" />
            </div>
            <div className="detail-page-skeleton__card detail-page-skeleton__card--optional">
              <SkeletonLine width="4rem" className="detail-page-skeleton__meta-label" />
              <SkeletonLine width="72%" className="detail-page-skeleton__card-title" />
              <SkeletonLine width="100%" className="detail-page-skeleton__card-text" />
              <SkeletonLine width="78%" className="detail-page-skeleton__card-text" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DetailPageSkeleton;
