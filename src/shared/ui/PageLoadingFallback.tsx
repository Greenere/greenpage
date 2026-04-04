import React from 'react';
import './PageLoadingFallback.css';

/**
 * Shown while a lazy page chunk is loading.
 * Matches the theme background so there's no white flash,
 * and shows a slim progress bar at the top so the wait feels intentional.
 */
const PageLoadingFallback: React.FC = () => (
  <div className="page-loading-fallback">
    <div className="page-loading-bar" />
  </div>
);

export default PageLoadingFallback;
