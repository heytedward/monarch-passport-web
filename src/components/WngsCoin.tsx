import { Box, Flex } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const spinSlow = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const spinReverse = keyframes`
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
`;

export const WngsCoin = ({ isStatic = false }: { isStatic?: boolean }) => {
  const spinAnimation = isStatic ? 'none' : `${spinSlow} 20s linear infinite`;
  const reverseAnimation = isStatic ? 'none' : `${spinReverse} 15s linear infinite`;

  return (
    <Flex align="center" h="full" justify="center" p={4} position="relative" w="full">
      {/* Outer Ring */}
      <Box 
        animation={spinAnimation} 
        h="90%" 
        position="absolute" 
        w="90%"
      >
        <svg viewBox="0 0 512 512" width="100%" height="100%">
          <circle cx="256" cy="256" r="240" fill="none" stroke="var(--monarch-accent, #FFB000)" strokeWidth="4" opacity="0.8" strokeDasharray="10 20" />
          <circle cx="256" cy="256" r="220" fill="none" stroke="var(--monarch-accent, #FFB000)" strokeWidth="2" opacity="0.4" />
        </svg>
      </Box>

      {/* Inner Ring */}
      <Box 
        animation={reverseAnimation} 
        h="75%" 
        position="absolute" 
        w="75%"
      >
        <svg viewBox="0 0 512 512" width="100%" height="100%">
          <circle cx="256" cy="256" r="200" fill="none" stroke="var(--monarch-accent, #FFB000)" strokeWidth="8" strokeDasharray="40 180" opacity="0.6" />
          <circle cx="256" cy="256" r="180" fill="none" stroke="var(--monarch-accent, #FFB000)" strokeWidth="1" opacity="0.3" />
        </svg>
      </Box>

      {/* Logo with Mask */}
      <Box 
        h="45%" 
        w="45%"
        bg="var(--monarch-accent, #FFB000)"
        style={{
          maskImage: "url('/papillon-logo.svg')",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
          WebkitMaskImage: "url('/papillon-logo.svg')",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
        }}
      />
    </Flex>
  );
};
