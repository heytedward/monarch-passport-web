import { Box } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { SWEEP, SWEEP_FINAL } from '../../lib/tapMotion';

const MotionBox = motion.create(Box);

type Props = {
  /** 'reading' loops the head; 'final' runs one fast confirmation pass. */
  mode?: 'reading' | 'final';
};

/**
 * The read head: a hard white line that travels down the frame, trailing a
 * short gradient so it reads as a beam rather than a border. Absolutely
 * positioned and clipped by its parent, so it never affects layout.
 *
 * Under prefers-reduced-motion it renders nothing at all -- a repeating
 * full-height sweep is exactly the kind of motion that setting asks us to
 * drop, and the surrounding copy already says what is happening.
 */
export default function ScanlineSweep({ mode = 'reading' }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <MotionBox
      aria-hidden
      position="absolute"
      left={0}
      right={0}
      top={0}
      h="120px"
      pointerEvents="none"
      zIndex={2}
      // Beam: transparent at the leading edge, solid at the head.
      bgGradient="linear(to-b, transparent, whiteAlpha.100, whiteAlpha.400)"
      borderBottom="2px solid"
      borderColor="whiteAlpha.900"
      initial={{ y: '-120px' }}
      animate={{ y: '100%' }}
      transition={mode === 'final' ? SWEEP_FINAL : SWEEP}
      style={{ willChange: 'transform' }}
    />
  );
}
