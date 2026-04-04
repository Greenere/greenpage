import { flushSync } from 'react-dom';

import { PAGE_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => { finished: Promise<void> };
};

// Sync config values into CSS custom properties so keyframes stay in step with JS config.
(function applyCssVars() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--page-exit-duration', `${PAGE_TRANSITION_CONFIG.exitDurationMs}ms`);
  root.style.setProperty('--page-exit-easing', PAGE_TRANSITION_CONFIG.exitEasing);
  root.style.setProperty('--page-enter-duration', `${PAGE_TRANSITION_CONFIG.enterDurationMs}ms`);
  root.style.setProperty('--page-enter-easing', PAGE_TRANSITION_CONFIG.enterEasing);
  root.style.setProperty('--page-enter-scale-from', String(PAGE_TRANSITION_CONFIG.enterScaleFrom));
})();

type NavigateWithViewTransitionOptions = {
  resetScrollTop?: boolean;
};

function applyNavigation(navigate: () => void, options?: NavigateWithViewTransitionOptions) {
  flushSync(() => {
    navigate();
  });
  if (options?.resetScrollTop) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

export function navigateWithViewTransition(navigate: () => void, options?: NavigateWithViewTransitionOptions) {
  const doc = document as DocumentWithViewTransition;

  if (!PAGE_TRANSITION_CONFIG.enabled || !doc.startViewTransition) {
    applyNavigation(navigate, options);
    return;
  }

  doc.startViewTransition(() => {
    applyNavigation(navigate, options);
  });
}

