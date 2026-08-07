import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pageVariants, pageVariantsReduced } from '../lib/motion';

// Wraps a route's content so it springs in (rise + fade + slight scale) and
// tweens out. Rendered under an <AnimatePresence mode="wait"> keyed by
// pathname, so one page finishes leaving before the next arrives.
//
// Honors prefers-reduced-motion: an opacity-only, transform-free fallback.
export default function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={reduce ? pageVariantsReduced : pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      // Contain the vertical travel so the rise never spawns a scrollbar.
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}
