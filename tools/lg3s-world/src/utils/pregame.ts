export const greatBritain = 1446;
export const rinkSlots = ['O', 'C', 'D', 'G'] as const;
export type RinkSlot = typeof rinkSlots[number];

export interface PregamePlayer {
  id: number;
  name: string;
  position: string;
  slot: RinkSlot;
  jersey?: string;
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
  name: string;
  jersey?: string;
  goalie: boolean;
  x: number;
  z: number;
  warmup?: { centerX: number; radiusX: number; radiusZ: number; phase: number; rate: number };
}
export interface PregameBoard {
  markers: PregameMarker[];
  highlighted: number[];
  skating?: boolean;
}

export function warmupPose(marker: PregameMarker, seconds: number) {
  const route = marker.warmup;
  const facing = marker.britain ? Math.PI / 2 : -Math.PI / 2;
  if (!route) return { x:marker.x, z:marker.z, yaw:facing };
  const t = seconds * route.rate + route.phase;
  const x = route.centerX + route.radiusX * Math.cos(t);
  const z = route.radiusZ * Math.sin(t);
  const yaw = marker.goalie ? facing : Math.atan2(-route.radiusX * Math.sin(t), route.radiusZ * Math.cos(t));
  return { x, z, yaw };
}

export function slotFor(position: string): RinkSlot | undefined {
  if (position === 'G') return 'G';
  if (position === 'C') return 'C';
  if (['LW', 'RW', 'W'].includes(position)) return 'O';
  if (['LD', 'RD', 'D'].includes(position)) return 'D';
}

export function makePlayer(id: unknown, name: unknown, rawPosition: unknown, jerseyNumber?: unknown): PregamePlayer | undefined {
  const value = Number(id);
  const position = String(rawPosition ?? '').trim().toUpperCase();
  const slot = slotFor(position);
  if (!Number.isSafeInteger(value) || value < 1 || typeof name !== 'string' || !name.trim() || !slot) return;
  const jersey = /^\d{1,2}$/.test(String(jerseyNumber)) ? String(jerseyNumber) : undefined;
  return { id: value, name: name.trim().slice(0, 80), position, slot, jersey };
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
      const skaters = listed.filter((p) => p.slot !== 'G').length;
      let lane = 0;
      return listed.map((p) => {
        const i = count.get(p.slot) ?? 0;
        count.set(p.slot, i + 1);
        const [x,z] = locations[p.slot];
        const end = index ? 1 : -1;
        const goalie = p.slot === 'G';
        const spread = skaters > 1 ? lane / (skaters - 1) : .62;
        const warmup = goalie
          ? i === 0 ? { centerX:end * 26.3, radiusX:.35, radiusZ:.65, phase:index, rate:1.3 } : undefined
          : { centerX:end * 13.5, radiusX:4.7 + spread * 4.8, radiusZ:4 + spread * 6,
            phase:lane * 2.4 + index, rate:.57 - spread * .16 };
        if (!goalie) lane++;
        return { id:p.id, name:p.name, jersey:p.jersey, goalie, britain:index === 0, x:end * x, z:-end * z + i * 2.3, warmup };
      });
    }).slice(0, 18),
  };
}
