import { Box, SimpleGrid, VStack } from '@chakra-ui/react';
import './skeleton.css';

// Placeholders shaped like the real content, with a gold shimmer, shown while
// a screen's first data loads. The real content replaces them and rises in.

export function SkeletonBlock({ h, w = '100%', mb = 0 }: { h: string | number; w?: string; mb?: number | string }) {
  return <Box className="mp-shimmer" h={h} w={w} mb={mb} />;
}

/** Monarch Times feed cards (Home). */
export function FeedSkeleton({ count = 2 }: { count?: number }) {
  return (
    <Box aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} borderBottom="4px solid white">
          <SkeletonBlock h="180px" />
          <Box p={6}>
            <SkeletonBlock h="8px" w="38%" mb={3} />
            <SkeletonBlock h="18px" w="82%" mb={4} />
            <SkeletonBlock h="8px" w="94%" mb={2} />
            <SkeletonBlock h="8px" w="70%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Closet item grid. */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <SimpleGrid columns={3} spacing={3} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} border="2px solid" borderColor="whiteAlpha.300" p={2}>
          <Box className="mp-shimmer" style={{ aspectRatio: '1' }} mb={2} />
          <SkeletonBlock h="6px" w="60%" />
        </Box>
      ))}
    </SimpleGrid>
  );
}

/** Rows of a list (rewards track, transaction history). */
export function ListSkeleton({ rows = 5, rowH = '56px' }: { rows?: number; rowH?: string }) {
  return (
    <VStack align="stretch" spacing={3} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} h={rowH} />
      ))}
    </VStack>
  );
}

/** Full Ascension screen while the season loads. */
export function AscensionSkeleton() {
  return (
    <Box bg="black" minH="100vh" px={6} pt={12} pb="90px" aria-hidden="true">
      <SkeletonBlock h="10px" w="30%" mb={3} />
      <SkeletonBlock h="30px" w="70%" mb={6} />
      <SkeletonBlock h="14px" w="100%" mb={8} />
      <ListSkeleton rows={6} rowH="64px" />
    </Box>
  );
}
