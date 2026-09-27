// Passport feature switches. Flip one to true to bring the feature back; its
// data and code stay in place, only the entry points are hidden.

/**
 * Seasonal stamps. Paused until after launch: the Profile STAMPS tab is
 * hidden. The server side has its own switch (STAMPS_ENABLED in
 * api/v2/_stamps.js) that stops awarding; turn both on together.
 */
export const STAMPS_ENABLED = false;
