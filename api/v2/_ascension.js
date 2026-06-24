// Shared ASCENSION (battlepass) helpers. Underscore prefix => Vercel does NOT
// treat this as a serverless function, so it doesn't count toward the cap.
// Imported by tap-reward.js, claim.js, log-social-scan.js, purchase.js.
//
// Client mirrors the user-facing constants in src/lib/ascension.ts -- keep in sync.

// XP rates
export const XP_TAP = 40;          // per artifact tap
export const XP_ACTIVATION = 100;  // first-claim activation bonus
export const XP_SOCIAL_MINE = 10;  // per successful social-link mine (link owner)
export const WNGS_SOCIAL_MINE = 2; // small WNGS trickle per mine

// Stamina ("Active Hustle"). Uses the per-user profiles.max_stamina column;
// DEFAULT_MAX_STAMINA is only the seed for brand-new accounts.
export const DEFAULT_MAX_STAMINA = 5;
export const STAMINA_REGEN_MS = 4 * 60 * 60 * 1000; // +1 every 4h
export const RECHARGE_COST = 250;                   // WNGS to refill to full

// Effective stamina after time-based regen, capped at the user's max.
export function effectiveStamina(stored, updatedAtIso, max = DEFAULT_MAX_STAMINA, now = Date.now()) {
  const cap = max || DEFAULT_MAX_STAMINA;
  const updated = new Date(updatedAtIso || 0).getTime();
  const regen = Math.floor((now - updated) / STAMINA_REGEN_MS);
  return Math.min(cap, (stored || 0) + Math.max(0, regen));
}

// Consume one stamina, accounting for regen. Returns the new stored value and
// the regen-timer anchor to persist.
export function consumeOneStamina(stored, updatedAtIso, max = DEFAULT_MAX_STAMINA, now = Date.now()) {
  const cap = max || DEFAULT_MAX_STAMINA;
  const updated = new Date(updatedAtIso || 0).getTime();
  const intervals = Math.max(0, Math.floor((now - updated) / STAMINA_REGEN_MS));
  const base = Math.min(cap, (stored || 0) + intervals);
  if (base <= 0) {
    return { ok: false, newStored: base, newUpdatedAt: updatedAtIso };
  }
  const wasFull = base >= cap;
  const newStored = base - 1;
  // If the pool was full, the regen timer starts now; otherwise preserve the
  // partial progress toward the next point.
  const newUpdatedAt = wasFull
    ? new Date(now).toISOString()
    : new Date(updated + intervals * STAMINA_REGEN_MS).toISOString();
  return { ok: true, newStored, newUpdatedAt };
}

// The currently-active season row (or null).
export async function getActiveSeason(supabase) {
  const { data } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

// Add XP to a user's progress in the active season (creating the row if needed),
// recomputing level. No-op (returns null) when there's no active season.
export async function addSeasonXp(supabase, userId, amount) {
  const season = await getActiveSeason(supabase);
  if (!season) return null;

  const maxXp = season.level_count * season.xp_per_level;

  const { data: existing } = await supabase
    .from('user_season_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('season_id', season.id)
    .maybeSingle();

  const newXp = Math.min(maxXp, (existing?.xp || 0) + amount);
  const newLevel = Math.min(season.level_count, Math.floor(newXp / season.xp_per_level));

  if (existing) {
    const { data } = await supabase
      .from('user_season_progress')
      .update({ xp: newXp, level: newLevel })
      .eq('id', existing.id)
      .select()
      .single();
    return data;
  }
  const { data } = await supabase
    .from('user_season_progress')
    .insert({ user_id: userId, season_id: season.id, xp: newXp, level: newLevel })
    .select()
    .single();
  return data;
}

// Flag a user as premium for a season (creating the progress row if needed).
export async function setSeasonPremium(supabase, userId, seasonId) {
  const { data: existing } = await supabase
    .from('user_season_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_season_progress').update({ is_premium: true }).eq('id', existing.id);
  } else {
    await supabase
      .from('user_season_progress')
      .insert({ user_id: userId, season_id: seasonId, is_premium: true });
  }
}
