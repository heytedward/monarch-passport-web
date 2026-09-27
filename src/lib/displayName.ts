/**
 * Human-readable form of a catalog/reward name stored in machine style
 * ("GOLDEN_MONARCH", "VOID // OPERATOR") for display: underscores become
 * spaces and "//" separators become a middle dot. Stored names are left as
 * they are because some are matched by value (e.g. the SYSTEM_DARK theme).
 */
export function displayName(name: string | null | undefined): string {
  return (name ?? '')
    .replace(/\s*\/\/\s*/g, ' · ')
    .replace(/_+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
