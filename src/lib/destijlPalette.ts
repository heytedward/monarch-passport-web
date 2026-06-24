// Shared De Stijl palette + rarity pricing for the Digital Store Forge.
// The avatar generator rolls a 9-color palette from the canonical set; the
// server (api/v2/admin/create-product.js) keeps its own copy of RARITY_PRICES
// as the source of truth, so keep the two in sync if you change the table.

// Canonical De Stijl colors (mirror of DeStijlAvatar's PALETTE).
export const DESTIJL_COLORS = [
  '#FFFFFF', // White
  '#1A202C', // Black (Monarch)
  '#E53E3E', // Red
  '#3182CE', // Blue
  '#FFB000', // Monarch Gold
];

export const RARITIES = ['COMMON', 'RARE', 'EPIC', 'MONARCH', 'MYTHIC'] as const;
export type Rarity = (typeof RARITIES)[number];

// Auto-pricing by rarity (WNGS). Editable per-item in the generator UI.
export const RARITY_PRICES: Record<Rarity, number> = {
  COMMON: 500,
  RARE: 1500,
  EPIC: 3500,
  MONARCH: 7500,
  MYTHIC: 15000,
};

export const priceForRarity = (rarity: string): number =>
  RARITY_PRICES[rarity as Rarity] ?? RARITY_PRICES.COMMON;

// Weighted pick so rolls read as De Stijl: white-dominant fields with sparse,
// punchy primary/gold accents rather than an even rainbow.
const WEIGHTED_POOL = [
  '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', // white heavy
  '#1A202C', '#1A202C',                       // black
  '#E53E3E',                                  // red
  '#3182CE',                                  // blue
  '#FFB000',                                  // gold
];

const pick = () => WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];

// Roll a fresh 9-color palette for the 3x3 grid.
export const rollPalette = (): string[] => Array.from({ length: 9 }, pick);
