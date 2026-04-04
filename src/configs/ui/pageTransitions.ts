export const PAGE_TRANSITION_CONFIG = {
  /** Master switch. Set to false to disable all transitions. */
  enabled: true,

  /** Exit: old page fades out. Short — don't make users wait for content to leave. */
  exitDurationMs: 100,
  exitEasing: 'ease-out',

  /** Enter: new page fades in while scaling up from `enterScaleFrom`. */
  enterDurationMs: 600,
  enterEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',

  /**
   * Starting scale for the incoming page. 0.97 gives a barely-perceptible
   * "opening" feel without looking like a zoom. 1.0 = pure crossfade.
   */
  enterScaleFrom: 0.97,
} as const;

/**
 * Used when navigating *back* to the graph (detail → graph).
 * The exiting detail page shrinks away (1.0 → 0.97) while the graph
 * crossfades in at full scale — the reverse of the forward zoom-in.
 */
export const PAGE_BACK_TRANSITION_CONFIG = {
  exitDurationMs: 220,
  exitEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  exitScaleTo: 1.03,
  enterDurationMs: 600,
  enterEasing: 'ease-out',
  enterScaleFrom: 0.97,
} as const;

export const LANGUAGE_SWITCH_TRANSITION_CONFIG = {
  /** Slightly softer than route changes because the user is staying on the same page. */
  exitDurationMs: 120,
  exitEasing: 'ease-out',
  enterDurationMs: 800,
  enterEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  enterScaleFrom: 1,
} as const;
