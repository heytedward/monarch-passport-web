// Username content moderation.
//
// A curated blocklist checked against a normalized (lowercased, leetspeak-
// collapsed, non-letters stripped) form of the candidate username. This is a
// best-effort automated gate, not a complete filter: it trades recall for a
// low false-positive rate, so determined evasions can still get through.
// api/v2/admin/mint.js's `clear_username` is the real backstop for anything
// reported after the fact.

const LEET_MAP = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's',
};

const BLOCKED_TERMS = [
  'fuck', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'asshole', 'dick', 'cock',
  'pussy', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'chink', 'spic',
  'kike', 'dyke', 'tranny', 'nazi', 'hitler',
];

function normalize(raw) {
  const leeted = raw.toLowerCase().replace(/[013457@$]/g, (c) => LEET_MAP[c] || c);
  return leeted.replace(/[^a-z]/g, '');
}

// Defeats simple repeat-padding evasions ("fuuuck" -> "fuck") without
// touching short blocked terms enough to cause new collisions.
function collapseRepeats(s) {
  return s.replace(/(.)\1+/g, '$1');
}

export function isUsernameBlocked(username) {
  const normalized = normalize(username);
  const collapsed = collapseRepeats(normalized);
  return BLOCKED_TERMS.some((term) => normalized.includes(term) || collapsed.includes(term));
}
