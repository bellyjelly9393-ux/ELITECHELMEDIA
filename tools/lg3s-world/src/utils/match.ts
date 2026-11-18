import { GBR_ROSTER } from './gbrRoyalBlueJersey';

export const cameras = ['ice', 'overhead', 'jumbotron', 'goalie', 'orbit'] as const;
export type CameraAngle = typeof cameras[number];
export const formations = ['trap', 'overload', 'rush'] as const;
export type Formation = typeof formations[number];
export interface Match {
  id: string;
  home_team: string; away_team: string;
  home_score: number; away_score: number; home_sog: number; away_sog: number;
  period: string; clock: string;
  red_zone_active: boolean;
  kit_variant: 'royal_blue' | 'away_white'; jersey_side: 'front' | 'back';
  active_formation: Formation; camera_angle: CameraAngle; highlighted_player: number;
  lower_third_visible: boolean; lower_third_until: string | null;
  goal_horn_trigger: string | null;
  updated_at: string;
  ocr_crop?: { x: number; y: number; width: number; height: number };
  ocr_result?: Record<string, unknown>;
  whiparound?: Array<{ id: string; provider?: string; stream?: string; home: string; away: string; score: string; status: string; overtime: boolean }>;
  boxscore?: Array<{ num: number; g: number; a: number; pts: number; plusMinus: string }>;
}
export interface Vote { player_number: number; player_name: string; gamertag: string; position: string; votes: number }
export interface TacticalFormation { slug: Formation; positions: Record<string, [number, number]> }

export const matchId = 'gbr_live';
export const defaultCrop = { x: 48 / 1920, y: 36 / 1080, width: 320 / 1920, height: 96 / 1080 };
export const demoMatch: Match = {
  id: matchId, home_team: 'GBR', away_team: 'SWE', home_score: 3, away_score: 2,
  home_sog: 24, away_sog: 19, period: '3RD', clock: '04:18', red_zone_active: false,
  kit_variant: 'royal_blue', jersey_side: 'front', active_formation: 'trap',
  camera_angle: 'ice', highlighted_player: 88, lower_third_visible: false,
  lower_third_until: null, goal_horn_trigger: null, updated_at: '',
  whiparound: [
    { id: 'gb', home: 'GBR', away: 'SWE', score: '3 – 2', status: '3RD · 04:18', overtime: false },
    { id: 'fin', home: 'FIN', away: 'CAN', score: '4 – 4', status: 'OT · 02:31', overtime: true },
    { id: 'usa', home: 'USA', away: 'CZE', score: '2 – 1', status: '3RD · 08:57', overtime: false },
    { id: 'sui', home: 'SUI', away: 'GER', score: '1 – 0', status: '2ND · 11:06', overtime: false },
  ],
  boxscore: GBR_ROSTER,
};
export const demoVotes: Vote[] = GBR_ROSTER.map((p, i) => ({
  player_number: p.num, player_name: ['L. KIRK', 'B. LAKE', 'D. CLEMENTS', 'B. BOWNS'][i],
  gamertag: p.gamertag, position: p.pos, votes: [148, 96, 68, 54][i],
}));
export const demoFormations: TacticalFormation[] = [
  { slug: 'trap', positions: { 88: [2, 0], 20: [-5, -5], 19: [-9, 5], 35: [-23, 0] } },
  { slug: 'overload', positions: { 88: [11, -4], 20: [16, -8], 19: [3, -7], 35: [-23, 0] } },
  { slug: 'rush', positions: { 88: [15, 1], 20: [10, -6], 19: [-1, 5], 35: [-23, 0] } },
];
