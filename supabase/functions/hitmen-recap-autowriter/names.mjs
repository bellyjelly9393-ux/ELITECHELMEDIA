// Accent- and case-insensitive team-name matching. LG lists "Chicoutimi Sagueneens" while the Hitmen
// schedule uses "Chicoutimi Saguenéens"; both must resolve to the same key. Mirrors SQL private.hitmen_name_key.
export const nameKey = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Prefer the schedule's spelling (with accents) for display when it is the same team as LG's name. */
export function withScheduleName(teams, oppId, scheduleName) {
  const t = teams[oppId];
  if (!t || !scheduleName || nameKey(scheduleName) !== nameKey(t.name) || scheduleName === t.name) return teams;
  return { ...teams, [oppId]: { ...t, name: scheduleName } };
}
