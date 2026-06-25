import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// The De Stijl UI is dark-only: backgrounds come from
// useColorModeValue("gray.50", "black") across the app, so the light value is
// a near-white surface that renders the (light-on-dark) content invisible.
// Force dark mode and ignore the OS preference / a stale persisted value so a
// fresh phone browser doesn't fall back to Chakra's default light mode.
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
};

const theme = extendTheme({ config });

export default theme;
