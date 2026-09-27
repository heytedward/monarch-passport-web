import React from 'react';
import { Box, VStack, HStack, Heading, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { WngsCoin } from './WngsCoin';
import { RARITY_COLORS } from '../lib/destijlPalette';

const MotionBox = motion.create(Box);

interface RewardCardProps {
  variant: 'wngs' | 'artifact';
  /** WNGS credited by this reward. */
  amount: number;
  /** wngs variant: what the claim link represented (label only). */
  itemName?: string | null;
  itemType?: string | null;
  /** artifact variant. */
  name?: string;
  tier?: string;
  collection?: string | null;
  season?: string | null;
  premiumUnlocked?: boolean;
  /** CTA buttons rendered inside the card footer. */
  children?: React.ReactNode;
}

// Shared reward screen card for claim links (wngs) and first-time artifact
// activation (artifact). The artifact variant takes its accent from the tier's
// rarity color so higher tiers physically look like bigger pulls.
const RewardCard: React.FC<RewardCardProps> = ({
  variant,
  amount,
  itemName,
  itemType,
  name,
  tier,
  collection,
  season,
  premiumUnlocked,
  children,
}) => {
  const gold = '#FFB000';
  const tierColor = (tier && RARITY_COLORS[tier.toUpperCase()]) || gold;
  const accent = variant === 'artifact' ? tierColor : gold;

  return (
    <MotionBox
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      w="full"
      maxW="420px"
      bg="black"
      border="4px solid"
      borderColor={accent}
      p={8}
    >
      <VStack spacing={6} align="stretch">
        <Text color="whiteAlpha.600" fontFamily="mono" fontSize="10px" fontWeight="900" letterSpacing="0.15em">
          {variant === 'artifact' ? 'ARTIFACT ACTIVATED' : 'TRANSMISSION COMPLETE'}
        </Text>

        {variant === 'wngs' && (
          <VStack spacing={4}>
            <Box w="130px" h="130px">
              <WngsCoin />
            </Box>
            <Heading
              color={gold}
              fontFamily="heading"
              fontStyle="italic"
              fontWeight="900"
              fontSize="4xl"
              lineHeight="1"
            >
              +{amount} $WNGS
            </Heading>
            <Text color="whiteAlpha.600" fontFamily="mono" fontSize="xs" fontWeight="900">
              CREDITED TO YOUR BALANCE
            </Text>
            {itemName && (
              <Text color={gold} fontFamily="mono" fontSize="xs" fontWeight="900" textAlign="center">
                {(itemType || 'ITEM').toUpperCase()} {itemName.toUpperCase()}
              </Text>
            )}
          </VStack>
        )}

        {variant === 'artifact' && (
          <VStack spacing={4} align="stretch">
            <VStack align="start" spacing={2}>
              <Heading
                color="white"
                fontFamily="heading"
                fontStyle="italic"
                fontWeight="900"
                fontSize="3xl"
                lineHeight="1"
              >
                {(name || 'UNKNOWN_ARTIFACT').toUpperCase()}
              </Heading>
              <HStack spacing={2}>
                <Text
                  color={tierColor}
                  border="1px solid"
                  borderColor={tierColor}
                  px={2}
                  fontFamily="mono"
                  fontSize="10px"
                  fontWeight="900"
                >
                  {(tier || 'COMMON').toUpperCase()}
                </Text>
                <Text color="whiteAlpha.600" fontFamily="mono" fontSize="10px" fontWeight="900">
                  {(collection || 'GENERAL_RELEASE').toUpperCase()} {(season || 'UNSPECIFIED').toUpperCase()}
                </Text>
              </HStack>
            </VStack>

            <Box h="1px" bg={accent} opacity={0.3} />

            <HStack spacing={3}>
              <Box w="56px" h="56px" flexShrink={0}>
                <WngsCoin />
              </Box>
              <VStack align="start" spacing={0}>
                <Heading
                  color={gold}
                  fontFamily="heading"
                  fontStyle="italic"
                  fontWeight="900"
                  fontSize="2xl"
                  lineHeight="1"
                >
                  +{amount} $WNGS
                </Heading>
                <Text color="whiteAlpha.600" fontFamily="mono" fontSize="9px" fontWeight="900">
                  ACTIVATION BONUS AWARDED
                </Text>
              </VStack>
            </HStack>

            {premiumUnlocked && (
              <Box bg={gold} p={2}>
                <Text color="black" fontFamily="mono" fontSize="xs" fontWeight="900" textAlign="center">
                  PREMIUM TRACK UNLOCKED · ASCENSION ELEVATED
                </Text>
              </Box>
            )}

            <Text color="whiteAlpha.600" fontFamily="mono" fontSize="xs" fontWeight="900">
              THIS PIECE HAS BEEN LOGGED TO YOUR CLOSET.
            </Text>
          </VStack>
        )}

        {children && (
          <VStack spacing={3} align="stretch" pt={2}>
            {children}
          </VStack>
        )}
      </VStack>
    </MotionBox>
  );
};

export default RewardCard;
