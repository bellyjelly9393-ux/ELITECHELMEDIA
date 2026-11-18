export const greatBritain = 1446;
export const rinkSlots = ['O', 'C', 'D', 'G'] as const;
export type RinkSlot = typeof rinkSlots[number];

export interface PregamePlayer {
  id: number;
  name: string;
  position: string;
  slot: RinkSlot;
}
export interface PregameUnit {
  players: PregamePlayer[];
  basis: 'posted' | 'previous' | 'roster';
  sourceGame?: number;
}
export interface PregameGame {
  lg_game_id: number;
  game_night_date: string;
  scheduled_at: string;
  home_lg_team_id: number;
  away_lg_team_id: number;
  home_nation: string;
  away_nation: string;
}
export interface SeasonStats {
  lg_user_id: number;
  gp: number | null;
  p?: number | null;
  g?: number | null;
  a?: number | null;
  plus_minus?: number | null;
  sv_pct?: number | null;
  sv?: number | null;
  sa?: number | null;
}
export interface PregameMarker {
  id: number;
  britain: boolean;
  x: number;
  z: number;
}
export interface PregameBoard {
  markers: PregameMarker[];
  highlighted: number[];
}

export function slotFor(position: string): RinkSlot | undefined {
  if (position === 'G') return 'G';
  if (position === 'C') return 'C';
  if (['LW', 'RW', 'W'].includes(position)) return 'O';
  if (['LD', 'RD', 'D'].includes(position)) return 'D';
}

export function makePlayer(id: unknown, name: unknown, rawPosition: unknown): PregamePlayer | undefined {
  const value = Number(id);
  const position = String(rawPosition ?? '').trim().toUpperCase();
  const slot = slotFor(position);
  if (!Number.isSafeInteger(value) || value < 1 || typeof name !== 'string' || !name.trim() || !slot) return;
  return { id: value, name: name.trim().slice(0, 80), position, slot };
}

export function makeBoard(britain: PregameUnit, opponent: PregameUnit, featured: (PregamePlayer | undefined)[]): PregameBoard {
  const locations: Record<RinkSlot, [number, number]> = { O: [9,-7], C: [4,1], D: [14,6], G: [25,0] };
  const highlighted = featured.flatMap((p) => p ? [p.id] : []);
  return {
    highlighted,
    markers: [britain,opponent].flatMap((unit, index) => {
      // A roster gives us a spotlight player, while an actual game sheet provides line positions.
      const listed = unit.basis === 'roster' ? unit.players.filter((p) => highlighted.includes(p.id)) : unit.players;
      const count = new Map<RinkSlot, number>();
      return listed.map((p) => {
        const i = count.get(p.slot) ?? 0;
        count.set(p.slot, i + 1);
        const [x,z] = locations[p.slot];
        return { id: p.id, britain: index === 0, x: (index ? 1 : -1) * x, z: (index ? -1 : 1) * z + i * 2.3 };
      });
    }).slice(0, 18),
  };
}
