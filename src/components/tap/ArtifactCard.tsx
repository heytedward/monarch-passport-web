import { useEffect } from 'react';
import { Box, Text, VStack, HStack } from '@chakra-ui/react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Logo } from '../Logo';
import { RARITY_COLORS } from '../../lib/destijlPalette';
import {
  cardStrike,
  reduced,
  reducedContainer,
  specContainer,
  specRow,
  stampMark,
} from '../../lib/tapMotion';

const MotionBox = motion.create(Box);
const MotionVStack = motion.create(VStack);

type Props = {
  name: string;
  season: string | null;
  tier: string;
  /** Renders the pressed "YOURS" mark over the art. */
  stamped?: boolean;
};

/**
 * The piece itself: a hard-edged plate carrying the butterfly, its season and
 * its rarity. Black and white by design -- the rarity is the only color in
 * the frame, and only as a hairline and a label, so a MYTHIC reads as special
 * without turning the card into a gradient.
 *
 * On mount it strikes: drops in oversized, overshoots, then recoils once into
 * rest. Under prefers-reduced-motion it simply fades in.
 */
export default function ArtifactCard({ name, season, tier, stamped = false }: Props) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const rarityColor = RARITY_COLORS[tier] || '#FFFFFF';

  useEffect(() => {
    if (reduce) {
      controls.start('enter');
      return;
    }
    // Land, then recoil -- the card settling into the die.
    let cancelled = false;
    (async () => {
      await controls.start('enter');
      if (!cancelled) await controls.start('impact');
    })();
    return () => {
      cancelled = true;
    };
  }, [controls, reduce]);

  return (
    <MotionBox
      variants={reduce ? reduced : cardStrike}
      initial="initial"
      animate={controls}
      w="full"
      maxW="340px"
      bg="black"
      border="3px solid white"
      position="relative"
      overflow="hidden"
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Rarity hairline -- the one piece of color on the plate. */}
      <Box h="4px" bg={rarityColor} w="full" />

      {/* Art field. The butterfly is the whole motif; no other ornament. */}
      <Box position="relative" py={10} display="flex" justifyContent="center">
        <Logo w="140px" h="140px" color="white" />

        {stamped && (
          <MotionBox
            variants={reduce ? reduced : stampMark}
            initial="initial"
            animate="enter"
            position="absolute"
            top="50%"
            left="50%"
            // Centered by transform, then the variant adds its own rotation.
            ml="-90px"
            mt="-28px"
            w="180px"
            border="4px solid white"
            bg="black"
            py={2}
            textAlign="center"
            style={{ willChange: 'transform, opacity' }}
          >
            <Text
              className="de-stijl-heading"
              fontSize="xl"
              color="white"
              letterSpacing="0.18em"
            >
              YOURS
            </Text>
          </MotionBox>
        )}
      </Box>

      {/* Spec block. Rows punch in one after another once the plate lands. */}
      <MotionVStack
        variants={reduce ? reducedContainer : specContainer}
        initial="initial"
        animate="enter"
        spacing={0}
        align="stretch"
        borderTop="3px solid white"
      >
        <MotionBox variants={reduce ? reduced : specRow} px={4} py={3}>
          <Text
            className="de-stijl-heading"
            fontSize="lg"
            color="white"
            lineHeight="1.15"
            letterSpacing="0.02em"
          >
            {name}
          </Text>
        </MotionBox>

        <MotionBox variants={reduce ? reduced : specRow} borderTop="1px solid" borderColor="whiteAlpha.300">
          <HStack spacing={0} align="stretch">
            <Box flex="1" px={4} py={3}>
              <Text className="de-stijl-body" fontSize="9px" color="whiteAlpha.600" letterSpacing="0.2em">
                SEASON
              </Text>
              <Text className="de-stijl-body" fontSize="sm" color="white" fontWeight="700">
                {season || '001'}
              </Text>
            </Box>
            <Box w="1px" bg="whiteAlpha.300" />
            <Box flex="1" px={4} py={3}>
              <Text className="de-stijl-body" fontSize="9px" color="whiteAlpha.600" letterSpacing="0.2em">
                RARITY
              </Text>
              <Text className="de-stijl-body" fontSize="sm" color={rarityColor} fontWeight="700">
                {tier}
              </Text>
            </Box>
          </HStack>
        </MotionBox>
      </MotionVStack>
    </MotionBox>
  );
}
