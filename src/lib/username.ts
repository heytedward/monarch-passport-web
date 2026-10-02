/**
 * Member usernames. The server (`set_username` in api/v2/purchase.js) is the
 * real check; these mirror its rules so the form can explain a problem before
 * sending, and turn its error codes into plain words.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/;

/** Lowercases and drops a leading @ and spaces, as the server does. */
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}

/** A plain-language problem with the name, or null when it looks fine. */
export function usernameProblem(input: string): string | null {
  const name = normalizeUsername(input);
  if (name.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters`;
  if (name.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters`;
  if (/[^a-z0-9-]/.test(name)) return 'Letters, numbers and hyphens only';
  if (name.startsWith('-') || name.endsWith('-')) return "Can't start or end with a hyphen";
  if (name.includes('--')) return 'No double hyphens';
  if (!USERNAME_RE.test(name)) return 'Letters, numbers and hyphens only';
  return null;
}

const SERVER_MESSAGES: Record<string, string> = {
  USERNAME_INVALID: 'Letters, numbers and hyphens only, 3 to 20 characters',
  USERNAME_RESERVED: "That name is reserved. Try another",
  USERNAME_TAKEN: 'That name is taken. Try another',
  RATE_LIMITED: 'Too many changes today. Try again tomorrow',
};

export function usernameErrorMessage(code: string | undefined): string {
  return (code && SERVER_MESSAGES[code]) || 'Could not save your name. Try again';
}

/** "@NAME" for a member, falling back to a short id when they haven't picked one. */
export function memberHandle(username: string | null | undefined, userId?: string | null): string {
  if (username) return '@' + username.toUpperCase();
  const short = (userId || '').replace(/^did:privy:/, '').slice(0, 6).toUpperCase();
  return short ? '@' + short : '@MEMBER';
}
