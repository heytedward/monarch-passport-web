import { useEffect } from 'react';
import { Box } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { PLATE } from '../../lib/tapMotion';

const MotionBox = motion.create(Box);

const PLATES = 6;

type Props = {
  /** Fires once the plates have fully parted. */
  onComplete?: () => void;
};

/**
 * The press plates. Six bars start closed across the frame and retract --
 * odd bars up, even bars down -- to reveal what is underneath. Each bar is
 * delayed a beat after the last so the parting reads as a mechanism opening
 * rather than a single curtain.
 *
 * Travel is vertical only (the app is a ~430px column; horizontal travel
 * would spawn a scrollbar). Bars are `inset-x` pinned, so they scale with the
 * frame instead of overflowing it.
 *
 * Reduced motion: the plates are skipped entirely and onComplete fires on the
 * next tick, so callers advance through the same state machine either way.
 */
export default function ShutterWipe({ onComplete }: Props) {
  const reduce = useReducedMotion();

  // Reduced motion: no plates, but callers still need the beat to advance,
  // so fire the completion from an effect rather than during render.
  useEffect(() => {
    if (reduce) onComplete?.();
  }, [reduce, onComplete]);

  if (reduce) return null;

  return (
    <Box
      aria-hidden
      position="absolute"
      inset={0}
      zIndex={5}
      pointerEvents="none"
      overflow="hidden"
    >
      {Array.from({ length: PLATES }).map((_, i) => (
        <MotionBox
          key={i}
          position="absolute"
          left={0}
          right={0}
          top={`${(i * 100) / PLATES}%`}
          h={`${100 / PLATES}%`}
          bg="white"
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          style={{
            transformOrigin: i % 2 === 0 ? 'top' : 'bottom',
            willChange: 'transform',
          }}
          transition={{ ...PLATE, delay: i * 0.045 }}
          // Last plate owns the completion callback.
          onAnimationComplete={i === PLATES - 1 ? () => onComplete?.() : undefined}
        />
      ))}
    </Box>
  );
}
