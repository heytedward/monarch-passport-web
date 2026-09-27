// Shared ASCENSION (battlepass) helpers. Underscore prefix => Vercel does NOT
// treat this as a serverless function, so it doesn't count toward the cap.
// Imported by tap-reward.js, claim.js, purchase.js and _quests.js.
//
// XP amounts are server-only; the app shows whatever the API returns.
import { checkAndAwardStamps } from './_stamps.js';

// XP rates
export const XP_TAP = 60;          // per daily artifact tap (tapping ~4 days a week reaches level 30 in a 90-day season)
export const XP_ACTIVATION = 100;  // first-claim activation bonus

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

  let result;
  if (existing) {
    const { data } = await supabase
      .from('user_season_progress')
      .update({ xp: newXp, level: newLevel })
      .eq('id', existing.id)
      .select()
      .single();
    result = data;
  } else {
    const { data } = await supabase
      .from('user_season_progress')
      .insert({ user_id: userId, season_id: season.id, xp: newXp, level: newLevel })
      .select()
      .single();
    result = data;
  }

  // STAMPS: check if user hit an ASCENSION_LEVEL stamp threshold. Best-effort.
  const prevLevel = existing?.level || 0;
  if (newLevel > prevLevel) {
    try {
      await checkAndAwardStamps(supabase, userId, 'ASCENSION_LEVEL', newLevel);
    } catch (stampErr) {
      console.error('ASCENSION_STAMP_WARN:', stampErr);
    }
  }

  return result;
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
