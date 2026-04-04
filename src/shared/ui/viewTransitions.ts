import { flushSync } from 'react-dom';

import { PAGE_TRANSITION_CONFIG } from '../../configs/ui/pageTransitions';

type StartViewTransition = (update: () => void | Promise<void>) => {
  finished: Promise<void>;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: StartViewTransition;
};

type NavigateWithViewTransitionOptions = {
  resetScrollTop?: boolean;
};

type SharedElementRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
};

type SharedElementTransition = {
  name: string;
  rect: SharedElementRect;
  createdAt: number;
  overlay: HTMLElement;
};

let pendingSharedElementTransition: SharedElementTransition | null = null;

function clearPendingSharedElementTransition() {
  if (pendingSharedElementTransition?.overlay.isConnected) {
    pendingSharedElementTransition.overlay.remove();
  }

  pendingSharedElementTransition = null;
}

function getNumericBorderRadius(element: HTMLElement) {
  const computedRadius = window.getComputedStyle(element).borderRadius;
  const parsedRadius = Number.parseFloat(computedRadius);
  return Number.isFinite(parsedRadius) ? parsedRadius : 0;
}

export function captureSharedElementTransition(element: HTMLElement | null, name: string) {
  if (!PAGE_TRANSITION_CONFIG.enabled) return;
  if (!element || !name) return;

  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  clearPendingSharedElementTransition();

  const computed = window.getComputedStyle(element);
  const overlay = element.cloneNode(true) as HTMLElement;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.position = 'fixed';
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.margin = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.transformOrigin = 'top left';
  overlay.style.zIndex = '2147483647';
  overlay.style.boxSizing = 'border-box';
  overlay.style.willChange = 'transform, opacity, border-radius';
  overlay.style.display = computed.display;
  overlay.style.alignItems = computed.alignItems;
  overlay.style.justifyContent = computed.justifyContent;
  overlay.style.padding = computed.padding;
  overlay.style.background = computed.background;
  overlay.style.color = computed.color;
  overlay.style.boxShadow = computed.boxShadow;
  overlay.style.borderRadius = computed.borderRadius;

  document.body.appendChild(overlay);

  pendingSharedElementTransition = {
    name,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      borderRadius: getNumericBorderRadius(element),
    },
    createdAt: performance.now(),
    overlay,
  };
}

export function playSharedElementEnterTransition(element: HTMLElement | null, name: string) {
  if (!PAGE_TRANSITION_CONFIG.enabled) return;
  if (!element || !name || !pendingSharedElementTransition) return;

  const pendingTransition = pendingSharedElementTransition;

  if (
    pendingTransition.name !== name ||
    performance.now() - pendingTransition.createdAt > PAGE_TRANSITION_CONFIG.sharedElement.maxAgeMs
  ) {
    clearPendingSharedElementTransition();
    return;
  }

  const targetRect = element.getBoundingClientRect();
  if (!targetRect.width || !targetRect.height) return;

  const translateX = targetRect.left - pendingTransition.rect.left;
  const translateY = targetRect.top - pendingTransition.rect.top;
  const scaleX = targetRect.width / pendingTransition.rect.width;
  const scaleY = targetRect.height / pendingTransition.rect.height;
  const targetBorderRadius = getNumericBorderRadius(element);
  const overlay = pendingTransition.overlay;
  const initialBoxShadow = window.getComputedStyle(overlay).boxShadow;
  const transparentBoxShadow = '0 0 0 0 rgba(0, 0, 0, 0)';
  const overlayContentNodes = Array.from(overlay.querySelectorAll<HTMLElement>('*'));
  const targetContentNodes = Array.from(element.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  const transitionDurationMs = PAGE_TRANSITION_CONFIG.sharedElement.durationMs;
  const transitionEasing = PAGE_TRANSITION_CONFIG.sharedElement.easing;

  const overlayTextAnimations = overlayContentNodes.map((node) =>
    node.animate(
      [
        {
          opacity: 1,
          filter: 'blur(0px)',
        },
        {
          opacity: 1,
          filter: 'blur(0px)',
          offset: 0.04,
        },
        {
          opacity: 0.16,
          filter: 'blur(1.25px)',
          offset: 0.15,
        },
        {
          opacity: 0,
          filter: 'blur(2px)',
          offset: 0.22,
        },
        {
          opacity: 0,
          filter: 'blur(2px)',
        },
      ],
      {
        duration: transitionDurationMs,
        easing: transitionEasing,
        fill: 'both',
      }
    )
  );

  const targetContentAnimations = targetContentNodes.map((node) =>
    node.animate(
      [
        {
          opacity: 0,
          filter: 'blur(4px)',
          transform: 'translateY(6px)',
        },
        {
          opacity: 0.12,
          filter: 'blur(3px)',
          transform: 'translateY(5px)',
          offset: 0.18,
        },
        {
          opacity: 0.58,
          filter: 'blur(1.5px)',
          transform: 'translateY(2px)',
          offset: 0.54,
        },
        {
          opacity: 1,
          filter: 'blur(0px)',
          transform: 'translateY(0px)',
        },
      ],
      {
        duration: transitionDurationMs,
        easing: transitionEasing,
        fill: 'both',
      }
    )
  );

  const overlayAnimation = overlay.animate(
    [
      {
        transformOrigin: 'top left',
        transform: 'translate(0px, 0px) scale(1, 1)',
        opacity: 1,
        borderRadius: `${pendingTransition.rect.borderRadius}px`,
        boxShadow: initialBoxShadow,
      },
      {
        transformOrigin: 'top left',
        transform: 'translate(0px, 0px) scale(1, 1)',
        opacity: 1,
        borderRadius: `${pendingTransition.rect.borderRadius}px`,
        boxShadow: transparentBoxShadow,
        offset: 0.08,
      },
      {
        transformOrigin: 'top left',
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
        opacity: 1,
        borderRadius: `${targetBorderRadius}px`,
        boxShadow: transparentBoxShadow,
        offset: 0.78,
      },
      {
        transformOrigin: 'top left',
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
        opacity: 0,
        borderRadius: `${targetBorderRadius}px`,
        boxShadow: transparentBoxShadow,
      },
    ],
    {
      duration: transitionDurationMs,
      easing: transitionEasing,
      fill: 'both',
    }
  );

  Promise.allSettled([
    overlayAnimation.finished,
    ...overlayTextAnimations.map((animation) => animation.finished),
    ...targetContentAnimations.map((animation) => animation.finished),
  ]).finally(() => {
    clearPendingSharedElementTransition();
  });
}

function applyNavigation(navigate: () => void, options?: NavigateWithViewTransitionOptions) {
  flushSync(() => {
    navigate();
  });

  if (options?.resetScrollTop) {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }
}

export function navigateWithViewTransition(navigate: () => void, options?: NavigateWithViewTransitionOptions) {
  const documentWithTransition = document as DocumentWithViewTransition;

  const startNavigation = () => {
    if (!PAGE_TRANSITION_CONFIG.enabled) {
      clearPendingSharedElementTransition();
      applyNavigation(navigate, options);
      return;
    }

    if (pendingSharedElementTransition) {
      applyNavigation(navigate, options);
      return;
    }

    if (!documentWithTransition.startViewTransition) {
      applyNavigation(navigate, options);
      return;
    }

    documentWithTransition.startViewTransition(() => {
      applyNavigation(navigate, options);
    });
  };

  startNavigation();
}
