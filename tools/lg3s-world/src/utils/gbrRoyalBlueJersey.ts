// src/utils/gbrRoyalBlueJersey.ts
import * as THREE from 'three';

export interface GBRPlayerSpec {
  num: number;
  name: string;
  gamertag: string;
  pos: 'C' | 'LW' | 'LD' | 'G';
  captaincy?: 'C' | 'A' | '';
  build: string;
  archetype: string;
  xfactor: string;
  g: number;
  a: number;
  pts: number;
  plusMinus: string;
}

export const GBR_ROSTER: GBRPlayerSpec[] = [
  { num: 88, name: 'KIRK', gamertag: 'xKirk_88', pos: 'C', captaincy: 'C', build: '6\'0" 185 lbs', archetype: 'SNIPER', xfactor: 'MAKE IT SNAPPY', g: 2, a: 1, pts: 3, plusMinus: '+3' },
  { num: 20, name: 'LAKE', gamertag: 'LakeShow_20', pos: 'LW', captaincy: 'A', build: '6\'1" 198 lbs', archetype: 'TWO-WAY FWD', xfactor: 'CLOSE QUARTERS', g: 1, a: 2, pts: 3, plusMinus: '+2' },
  { num: 19, name: 'CLEMENTS', gamertag: 'Clem_D19', pos: 'LD', captaincy: 'A', build: '6\'2" 205 lbs', archetype: 'SHUTDOWN D', xfactor: 'QUICK PICK', g: 0, a: 2, pts: 2, plusMinus: '+3' },
  { num: 35, name: 'BOWNS', gamertag: 'BownsWall_35', pos: 'G', captaincy: '', build: '6\'3" 208 lbs', archetype: 'HYBRID G', xfactor: 'POST TO POST', g: 0, a: 0, pts: 0, plusMinus: '.918 SV%' }
];

/**
 * Generates the Royal Blue Team Great Britain Jersey SVG (Front or Back)
 * Matching the Royal Blue kit with horizontal red/white chest stripe,
 * white-bordered Union Jack rampant lion crest, pink/crimson sleeve badge,
 * and bold white red-trimmed back numbers.
 */
export function renderGBRRoyalBlueJerseySVG(
  player: GBRPlayerSpec,
  variant: 'royal_blue' | 'away_white' = 'royal_blue',
  side: 'front' | 'back' = 'front'
): string {
  const isBlue = variant === 'royal_blue';
  const bodyMain = isBlue ? '#0D63B8' : '#F4F6FA';
  const bodyShade = isBlue ? '#084688' : '#D5DCE8';
  const collarTrim = isBlue ? '#0A4E96' : '#0D63B8';
  const wordmarkFill = isBlue ? '#FFFFFF' : '#082B59';
  const numberFill = '#FFFFFF';
  const numberStroke = '#D81E28';
  const uid = `gbr-${player.num}-${variant}-${side}`;

  return `
  <svg viewBox="0 0 260 245" width="260" height="245" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="body-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${isBlue ? '#1674D0' : '#FFFFFF'}"/>
        <stop offset="55%" stop-color="${bodyMain}"/>
        <stop offset="100%" stop-color="${bodyShade}"/>
      </linearGradient>
      <pattern id="mesh-${uid}" width="3" height="3" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r=".46" fill="#02142e" opacity=".34"/>
      </pattern>
      <clipPath id="torso-clip-${uid}">
        <path d="M74 22 L104 15 Q130 22 156 15 L186 22 L246 66 L224 188 L194 182 L188 78 L188 225 Q130 233 72 225 L72 78 L66 182 L36 188 L14 66 Z"/>
      </clipPath>
      <clipPath id="lion-clip-${uid}">
        <path d="M126 86 C133 84 140 87 142 93 C144 98 139 103 144 107 C150 104 155 108 153 114 C150 118 144 118 141 122 C145 128 148 136 145 144 L137 145 C137 137 134 132 130 130 C126 134 123 140 120 146 L112 144 C115 135 119 128 122 122 C116 120 110 117 110 111 C110 106 116 105 121 107 C121 101 118 96 121 90 Z"/>
      </clipPath>
    </defs>

    <!-- Wooden Locker Hanger -->
    <path d="M102 17 Q130 2 158 17" fill="none" stroke="#B58952" stroke-width="5" stroke-linecap="round"/>
    <path d="M130 7 L130 2" stroke="#9CA3AF" stroke-width="3"/>

    <!-- Main Pro-Stock Jersey Silhouette -->
    <g clip-path="url(#torso-clip-${uid})">
      <rect x="0" y="0" width="260" height="245" fill="url(#body-${uid})"/>

      <!-- Stepped Horizontal Crimson + White Chest Stripe -->
      <rect x="68" y="100" width="124" height="32" fill="#FFFFFF"/>
      <rect x="68" y="104" width="124" height="24" fill="#D81E28"/>

      <rect width="260" height="245" fill="url(#mesh-${uid})"/>

      <!-- Left & Right Angled Forearm Red/White Stripes -->
      <g transform="rotate(-14 42 128)">
        <rect x="6" y="114" width="72" height="26" fill="#FFFFFF"/>
        <rect x="6" y="118" width="72" height="18" fill="#D81E28"/>
        <!-- Pink/Magenta Sleeve Badge Above Stripe -->
        <rect x="18" y="96" width="18" height="13" rx="2" fill="#E11D48" stroke="#FFFFFF" stroke-width="1"/>
      </g>
      <g transform="rotate(14 218 128)">
        <rect x="182" y="114" width="72" height="26" fill="#FFFFFF"/>
        <rect x="182" y="118" width="72" height="18" fill="#D81E28"/>
        <rect x="224" y="96" width="18" height="13" rx="2" fill="#E11D48" stroke="#FFFFFF" stroke-width="1"/>
      </g>

      <!-- Sleeve Shoulder Numbers -->
      <text x="45" y="84" transform="rotate(-14 45 84)" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="23" fill="${numberFill}" stroke="${numberStroke}" stroke-width="1.5" text-anchor="middle">${player.num}</text>
      <text x="215" y="84" transform="rotate(14 215 84)" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="23" fill="${numberFill}" stroke="${numberStroke}" stroke-width="1.5" text-anchor="middle">${player.num}</text>

      ${side === 'front' ? `
        <!-- Front Neck Gusset & Skate Laces -->
        <polygon points="106,16 154,16 138,44 122,44" fill="#E5E7EB"/>
        <path d="M104 16 L122 46 L138 46 L156 16" fill="none" stroke="${collarTrim}" stroke-width="5"/>
        <line x1="120" y1="46" x2="119" y2="74" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="140" y1="46" x2="141" y2="74" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="123" y1="50" x2="137" y2="50" stroke="#FFFFFF" stroke-width="2"/>
        <line x1="123" y1="57" x2="137" y2="57" stroke="#FFFFFF" stroke-width="2"/>

        ${player.captaincy ? `
          <text x="92" y="76" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="22" fill="#FFFFFF" stroke="#D81E28" stroke-width="1">${player.captaincy}</text>
        ` : ''}

        <!-- White-Bordered Union Jack Rampant Lion Crest -->
        <path d="M126 86 C133 84 140 87 142 93 C144 98 139 103 144 107 C150 104 155 108 153 114 C150 118 144 118 141 122 C145 128 148 136 145 144 L137 145 C137 137 134 132 130 130 C126 134 123 140 120 146 L112 144 C115 135 119 128 122 122 C116 120 110 117 110 111 C110 106 116 105 121 107 C121 101 118 96 121 90 Z"
              fill="#00247D" stroke="#FFFFFF" stroke-width="4.5" stroke-linejoin="round"/>
        <g clip-path="url(#lion-clip-${uid})">
          <rect x="105" y="80" width="55" height="70" fill="#00247D"/>
          <line x1="105" y1="80" x2="160" y2="150" stroke="#FFFFFF" stroke-width="7"/>
          <line x1="160" y1="80" x2="105" y2="150" stroke="#FFFFFF" stroke-width="7"/>
          <line x1="105" y1="80" x2="160" y2="150" stroke="#D81E28" stroke-width="3.5"/>
          <line x1="160" y1="80" x2="105" y2="150" stroke="#D81E28" stroke-width="3.5"/>
          <rect x="126" y="80" width="9" height="70" fill="#FFFFFF"/>
          <rect x="105" y="111" width="55" height="9" fill="#FFFFFF"/>
          <rect x="128" y="80" width="5" height="70" fill="#D81E28"/>
          <rect x="105" y="113" width="55" height="5" fill="#D81E28"/>
        </g>

        <!-- "GREAT BRITAIN" Chest Wordmark -->
        <text x="130" y="164" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="16" fill="${wordmarkFill}" letter-spacing="1.4" text-anchor="middle">GREAT BRITAIN</text>
      ` : `
        <!-- Back Stitched Nameplate & Red-Trimmed White Block Number -->
        <rect x="86" y="50" width="88" height="22" rx="2" fill="${bodyMain}" stroke="rgba(255,255,255,0.45)" stroke-width="1" stroke-dasharray="2 1"/>
        <text x="130" y="67" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="20" fill="#FFFFFF" letter-spacing=".8" textLength="${Math.min(86, player.name.length * 12)}" lengthAdjust="spacingAndGlyphs" text-anchor="middle">${player.name.replace(/[^A-Z]/g, "")}</text>
        <text x="130" y="158" font-family="'Barlow Condensed', sans-serif" font-weight="900" font-size="86" fill="${numberFill}" stroke="${numberStroke}" stroke-width="4" text-anchor="middle">${player.num}</text>
      `}
    </g>

    <!-- Outer Jersey Structural Seam Outline -->
    <path d="M74 22 L104 15 Q130 22 156 15 L186 22 L246 66 L224 188 L194 182 L188 78 L188 225 Q130 233 72 225 L72 78 L66 182 L36 188 L14 66 Z"
          fill="none" stroke="rgba(255,255,255,0.24)" stroke-width="1.5"/>
  </svg>`;
}

export function jerseyImage(player: GBRPlayerSpec, variant: 'royal_blue' | 'away_white', side: 'front' | 'back') {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(renderGBRRoyalBlueJerseySVG(player, variant, side));
}

/** The front and back materials share the same artwork as the hanging jersey cards. */
export async function createGBR3DSkaterTexture(
  player: GBRPlayerSpec,
  variant: 'royal_blue' | 'away_white' = 'royal_blue',
  side: 'front' | 'back' = 'front',
): Promise<THREE.CanvasTexture> {
  const image = new Image();
  image.src = jerseyImage(player, variant, side);
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');
  ctx.drawImage(image, 0, 0, 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
