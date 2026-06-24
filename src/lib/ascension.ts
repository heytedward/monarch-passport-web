// Client mirror of the user-facing ASCENSION constants in api/v2/_ascension.js.
// Keep in sync. Used for the stamina bar + recharge UI.

export const DEFAULT_MAX_STAMINA = 5;
export const STAMINA_REGEN_MS = 4 * 60 * 60 * 1000; // +1 every 4h
export const RECHARGE_COST = 250;                   // WNGS to refill to full

export const XP_TAP = 40;
export const XP_SOCIAL_MINE = 10;
export const WNGS_SOCIAL_MINE = 2;

// Effective stamina after time-based regen, capped at the user's per-account max.
export function effectiveStamina(stored: number | null | undefined, updatedAtIso: string | null | undefined, max: number = DEFAULT_MAX_STAMINA, now = Date.now()): number {
  const cap = max || DEFAULT_MAX_STAMINA;
  const updated = new Date(updatedAtIso || 0).getTime();
  const regen = Math.floor((now - updated) / STAMINA_REGEN_MS);
  return Math.min(cap, (stored || 0) + Math.max(0, regen));
}
