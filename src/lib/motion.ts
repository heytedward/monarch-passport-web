// Shared motion language for the Monarch Passport.
//
// The brand is industrial De Stijl but the motion brief is "expressive &
// tactile" — springs that overshoot slightly, page changes you can feel, and
// press feedback with bounce-back. Keep these tokens in one place so every
// surface (and the storefront) animates in the same voice.
//
// Every consumer should respect `prefers-reduced-motion` via framer's
// `useReducedMotion()` and fall back to an instant/opacity-only variant.

import type { Transition, Variants } from 'framer-motion';

/** The signature spring — lively, physical, with a touch of overshoot. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
  mass: 0.9,
};

/** A snappier spring for small controls (taps, toggles, chips). */
export const SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.6,
};

/** Quick tween for exits — leave fast, enter with character. */
export const EXIT_TWEEN: Transition = { duration: 0.14, ease: [0.4, 0, 1, 1] };

/** Page enter/exit: rise + fade + a hair of scale, spring on the way in. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 22, scale: 0.985 },
  enter: { opacity: 1, y: 0, scale: 1, transition: SPRING },
  exit: { opacity: 0, y: -14, scale: 0.99, transition: EXIT_TWEEN },
};

/** Reduced-motion page variant: opacity only, no transform, near-instant. */
export const pageVariantsReduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.08 } },
};

/** Container that staggers its children in — for lists/feeds/grids. */
export const staggerContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

/** A single staggered child (feed card, closet item, reward tile). */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  enter: { opacity: 1, y: 0, scale: 1, transition: SPRING },
};

/** Press feedback for tappable controls — scale down, bounce back. */
export const tap = { scale: 0.92 } as const;

/** Hover lift for pointer devices. */
export const hoverLift = { scale: 1.04 } as const;
