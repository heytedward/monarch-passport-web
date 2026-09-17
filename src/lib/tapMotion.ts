// Motion for the first-tap claim sequence (/tap/:tagId).
//
// The brief is press machinery: stock is read, the plates close, the die
// strikes, the piece comes out stamped. Nothing floats or sparkles. Travel is
// short, entrances are hard, and the only easing that overshoots is the
// strike itself.
//
// Built on the shared language in ./motion so the claim screen speaks in the
// same voice as the rest of the Passport -- this file only adds the set-piece
// variants that would bloat the shared one.
//
// Every export has a reduced-motion counterpart; consumers choose with
// framer's useReducedMotion(). Nothing here translates on X beyond a few px:
// the app renders in a ~430px column and horizontal travel would spawn a
// scrollbar.

import type { Transition, Variants } from 'framer-motion';
import { EXIT_TWEEN, SPRING, SPRING_SNAPPY } from './motion';

/** The die strike -- stiff, under-damped: overshoots, then settles hard. */
export const STRIKE: Transition = {
  type: 'spring',
  stiffness: 700,
  damping: 18,
  mass: 1.1,
};

/** Plate/shutter travel -- mechanical, no bounce, equal in and out. */
export const PLATE: Transition = { duration: 0.32, ease: [0.83, 0, 0.17, 1] };

/** Scanline pass -- constant speed, like a read head. */
export const SWEEP: Transition = { duration: 1.15, ease: 'linear', repeat: Infinity };

/** A single fast confirmation pass once the read lands. */
export const SWEEP_FINAL: Transition = { duration: 0.34, ease: [0.4, 0, 0.2, 1] };

/**
 * The artifact card landing: drops in slightly oversized and slams to rest.
 * The `impact` keyframes are the recoil -- the card settling into the die.
 */
export const cardStrike: Variants = {
  initial: { opacity: 0, scale: 1.14, y: -18 },
  enter: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { ...STRIKE, opacity: { duration: 0.08 } },
  },
  impact: {
    y: [0, 5, -2, 0],
    transition: { duration: 0.22, ease: 'easeOut' },
  },
  exit: { opacity: 0, scale: 0.98, transition: EXIT_TWEEN },
};

/** Detail rows (season, rarity, name) punch in one after another. */
export const specContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.06, delayChildren: 0.16 } },
};

/** One spec row -- rises a hair and locks, no scale wobble. */
export const specRow: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: SPRING_SNAPPY },
};

/** The primary action arrives last, on the softer shared spring. */
export const actionRise: Variants = {
  initial: { opacity: 0, y: 20 },
  enter: { opacity: 1, y: 0, transition: { ...SPRING, delay: 0.42 } },
};

/**
 * The claimed stamp: lands off-axis and oversized, then bites down to true.
 * Rotation is tiny so the mark reads as pressed, not thrown.
 */
export const stampMark: Variants = {
  initial: { opacity: 0, scale: 2.4, rotate: -14 },
  enter: {
    opacity: 1,
    scale: 1,
    rotate: -4,
    transition: { type: 'spring', stiffness: 900, damping: 22, mass: 1.2 },
  },
};

/** Opacity-only equivalents for prefers-reduced-motion. */
export const reduced: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.14 } },
  impact: {},
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** Reduced-motion stagger: still sequenced, just no transforms. */
export const reducedContainer: Variants = {
  initial: {},
  enter: { transition: { staggerChildren: 0.03 } },
};
