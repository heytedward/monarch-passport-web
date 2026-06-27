// Shared quest auto-grant engine. Underscore prefix => Vercel does NOT treat
// this as a serverless function, so it doesn't count toward the cap.
// Imported by purchase.js (SYSTEM_LOGIN), tap-reward.js + claim.js
// (ACHIEVE_1_NFC_SCAN), and log-social-scan.js (ACHIEVE_5_SOCIAL_SCANS).
//
// Quests are achievement-style and auto-grant: when a tracked action fires we
// recompute the user's real progress, persist it to user_quests, and on the
// first crossing of the target pay reward_wngs + reward_xp exactly once.
import { addSeasonXp } from './_ascension.js';
import { checkAndAwardStamps } from './_stamps.js';

// The numeric target is encoded in the action_type (ACHIEVE_<n>_...); anything
// without a number is a one-shot (target 1), e.g. SYSTEM_LOGIN.
function targetFor(actionType) {
  const m = /ACHIEVE_(\d+)_/.exec(actionType || '');
  return m ? parseInt(m[1], 10) : 1;
}

// The user's current real count toward an action, read from the same audit
// trail the earn paths already write. Returns null for actions we don't track.
async function currentCount(admin, userId, actionType) {
  if (actionType === 'SYSTEM_LOGIN') return 1; // being logged in satisfies it
  if (actionType === 'ACHIEVE_1_NFC_SCAN') {
    const { count } = await admin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('transaction_type', ['ARTIFACT_TAP', 'ARTIFACT_ACTIVATION']);
    return count || 0;
  }
  if (actionType === 'ACHIEVE_5_SOCIAL_SCANS') {
    const { count } = await admin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('transaction_type', 'SOCIAL_MINE');
    return count || 0;
  }
  return null;
}

// Grant a completed quest's reward exactly once: WNGS to the balance (+ audit
// row) and XP into the active season (a no-op when there's no season).
async function grantReward(admin, userId, quest) {
  if (quest.reward_wngs) {
    const { data: prof } = await admin
      .from('profiles')
      .select('wngs_balance')
      .eq('id', userId)
      .maybeSingle();
    await admin
      .from('profiles')
      .update({ wngs_balance: (prof?.wngs_balance || 0) + quest.reward_wngs })
      .eq('id', userId);
    await admin.from('transactions').insert({
      user_id: userId,
      amount: quest.reward_wngs,
      transaction_type: 'QUEST_REWARD',
      metadata: { quest_id: quest.id },
    });
  }
  if (quest.reward_xp) {
    try {
      await addSeasonXp(admin, userId, quest.reward_xp);
    } catch {
      /* no active season -> XP is a no-op; never fail the grant over it */
    }
  }
}

// Record an action and grant any quest it completes. Best-effort: callers wrap
// this in try/catch so quest bookkeeping never fails the primary earn action.
// Returns the quests newly completed by this call.
export async function recordQuestAction(admin, userId, actionType) {
  const { data: quests } = await admin
    .from('quests')
    .select('*')
    .eq('is_active', true)
    .eq('action_type', actionType);
  if (!quests || quests.length === 0) return [];

  const granted = [];
  for (const quest of quests) {
    const target = targetFor(actionType);
    const count = await currentCount(admin, userId, actionType);
    if (count === null) continue;
    const progress = Math.min(count, target);
    const complete = progress >= target;

    const { data: existing } = await admin
      .from('user_quests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('quest_id', quest.id)
      .maybeSingle();

    // Already paid out -> nothing to do (idempotent across repeated actions).
    if (existing?.status === 'COMPLETED') continue;

    const row = {
      progress,
      target,
      status: complete ? 'COMPLETED' : 'PENDING',
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await admin.from('user_quests').update(row).eq('id', existing.id);
    } else {
      await admin
        .from('user_quests')
        .insert({ user_id: userId, quest_id: quest.id, ...row });
    }

    if (complete) {
      await grantReward(admin, userId, quest);
      granted.push({ questId: quest.id, wngs: quest.reward_wngs, xp: quest.reward_xp });
    }
  }
  // STAMPS: if any quest was just completed, check whether ALL active quests
  // are now done and award the ALL_QUESTS stamp. Best-effort.
  if (granted.length > 0) {
    try {
      const [{ count: totalQuests }, { count: completedQuests }] = await Promise.all([
        admin.from('quests').select('*', { count: 'exact', head: true }).eq('is_active', true),
        admin.from('user_quests').select('*', { count: 'exact', head: true })
          .eq('user_id', userId).eq('status', 'COMPLETED'),
      ]);
      if (totalQuests > 0 && completedQuests >= totalQuests) {
        await checkAndAwardStamps(admin, userId, 'ALL_QUESTS');
      }
    } catch (stampErr) {
      console.error('QUEST_STAMP_WARN:', stampErr);
    }
  }

  return granted;
}
