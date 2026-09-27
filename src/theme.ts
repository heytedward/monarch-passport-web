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

// One brand typeface everywhere (Unbounded, self-hosted via
// public/fonts/unbounded.css). Headings, body and the former monospace
// labels all resolve to it, so changing the brand font is a one-line edit.
const BRAND_FONT = "'Unbounded Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";

const theme = extendTheme({
  config,
  fonts: { heading: BRAND_FONT, body: BRAND_FONT, mono: BRAND_FONT },
});

export default theme;
