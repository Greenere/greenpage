import { flushSync } from 'react-dom';

import { PAGE_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
};

let latestViewTransitionFinished: Promise<void> = Promise.resolve();
let latestTransitionConfigToken = 0;

export type ViewTransitionConfig = {
  exitDurationMs: number;
  exitEasing: string;
  enterDurationMs: number;
  enterEasing: string;
  enterScaleFrom: number;
};

// Sync config values into CSS custom properties so keyframes stay in step with JS config.
(function applyCssVars() {
  applyTransitionCssVars(PAGE_TRANSITION_CONFIG);
})();

function applyTransitionCssVars(config: ViewTransitionConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--page-exit-duration', `${config.exitDurationMs}ms`);
  root.style.setProperty('--page-exit-easing', config.exitEasing);
  root.style.setProperty('--page-enter-duration', `${config.enterDurationMs}ms`);
  root.style.setProperty('--page-enter-easing', config.enterEasing);
  root.style.setProperty('--page-enter-scale-from', String(config.enterScaleFrom));
}

type RunWithViewTransitionOptions = {
  resetScrollTop?: boolean;
  transitionConfig?: ViewTransitionConfig;
};

function applyUpdate(update: () => void, options?: RunWithViewTransitionOptions) {
  flushSync(() => {
    update();
  });
  if (options?.resetScrollTop) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

export function runWithViewTransition(update: () => void, options?: RunWithViewTransitionOptions) {
  const doc = document as DocumentWithViewTransition;

  if (!PAGE_TRANSITION_CONFIG.enabled || !doc.startViewTransition) {
    applyUpdate(update, options);
    latestViewTransitionFinished = Promise.resolve();
    return;
  }

  if (options?.transitionConfig) {
    latestTransitionConfigToken += 1;
    applyTransitionCssVars(options.transitionConfig);
  }

  const transition = doc.startViewTransition(() => {
    applyUpdate(update, options);
  });
  latestViewTransitionFinished = transition.finished;

  if (options?.transitionConfig) {
    const transitionConfigToken = latestTransitionConfigToken;
    void transition.finished.finally(() => {
      if (transitionConfigToken === latestTransitionConfigToken) {
        applyTransitionCssVars(PAGE_TRANSITION_CONFIG);
      }
    });
  }
}

export function navigateWithViewTransition(navigate: () => void, options?: RunWithViewTransitionOptions) {
  runWithViewTransition(navigate, options);
}

export function getStableImageViewTransitionName(seed: string) {
  const sanitized = seed
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return `greenpage-image-${sanitized || 'default'}`;
}

export function waitForCurrentViewTransition() {
  return latestViewTransitionFinished;
}
