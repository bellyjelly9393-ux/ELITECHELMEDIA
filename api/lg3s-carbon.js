const { createDecipheriv, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { extname } = require('node:path');
const encryptedPack = require('./_lg3s-carbon-pack.cjs');

const BASE = '/lg3s-gb/arena/';
const CZECHIA_FIXTURES = new Set(['germany', 'usa', 'sweden']);
const COOKIE = '__Secure-ecmCarbon';
const PREVIEW_TTL = 60 * 60;
const PROGRAM_TTL = 90 * 24 * 60 * 60;
const SUPABASE = 'https://lrgllzvwgvqagcpiyvfd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9GD6JhLzUGgoPNtahx7eQQ_JDARGIaP';
const MEDIA_TEAM_ID = '5f36117c-7a51-4514-bf70-d4c672b41e48';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8',
};
let pack;

function sign(key, payload, fixture) {
  const context = fixture ? `ecm-carbon-access-v1:czechia:${fixture}:` : 'ecm-carbon-access-v1:';
  return createHmac('sha256', key).update(context).update(payload).digest();
}

function issue(key, purpose, ttl, fixture) {
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${purpose}.${expires}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(key, payload, fixture).toString('base64url')}`;
}

function verify(key, token, fixture) {
  if (typeof token !== 'string' || !/^(preview|program)\.\d{10,11}\.[\w-]{22}\.[\w-]{43}$/.test(token)) return false;
  const [purpose, expires, nonce, signature] = token.split('.');
  const remaining = Number(expires) - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return false;
  const expected = sign(key, `${purpose}.${expires}.${nonce}`, fixture);
  return timingSafeEqual(expected, Buffer.from(signature, 'base64url')) ? { purpose, remaining } : false;
}

function setCookie(res, purpose, token, seconds, fixture) {
  const path = fixture ? `/czechia/arena/${fixture}/` : BASE;
  res.setHeader('Set-Cookie', `${COOKIE}-${purpose}=${token}; Path=${path}; Max-Age=${seconds}; Secure; HttpOnly; SameSite=Strict`);
}

function fromCookie(req, purpose) {
  const prefix = `${COOKIE}-${purpose}=`;
  return (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function checkStaff(authorization) {
  if (!/^Bearer [\w.-]+$/.test(authorization || '')) return 401;
  const headers = { apikey: SUPABASE_KEY, authorization };
  const get = path => fetch(SUPABASE + path, { headers, signal: AbortSignal.timeout(6000) });
  const auth = await get('/auth/v1/user');
  if ([401, 403].includes(auth.status)) return 401;
  if (!auth.ok) return 503;
  const user = await auth.json();
  if (!user.id || user.is_anonymous) return 403;
  const id = encodeURIComponent(user.id);
  const [profiles, memberships] = await Promise.all([
    get(`/rest/v1/profiles?select=role&id=eq.${id}`),
    get(`/rest/v1/team_memberships?select=role&user_id=eq.${id}&team_id=eq.${MEDIA_TEAM_ID}&active=is.true`),
  ]);
  if (!profiles.ok || !memberships.ok) return 503;
  const [profile, membership] = await Promise.all([profiles.json(), memberships.json()]);
  return profile.some(({ role }) => ['admin', 'commissioner'].includes(role)) ||
    membership.some(({ role }) => ['owner', 'gm', 'agm'].includes(role)) ? 200 : 403;
}

function files(key) {
  if (!pack) {
    const bytes = Buffer.from(encryptedPack, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    decipher.setAAD(Buffer.from('icevision-carbon-broadcast-v1'));
    pack = JSON.parse(gunzipSync(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()])));
  }
  return pack;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const { asset, fixture } = req.query;
  if (fixture !== undefined && !CZECHIA_FIXTURES.has(fixture)) return res.status(404).end();
  if (asset === 'broadcast.html' && (fixture
    ? req.query.team !== 'czechia' || req.query.game !== fixture
    : req.query.team === 'czechia')) return res.status(404).end();
  const exchange = asset === 'preview-session' || asset === 'program-link' || asset === 'open-program';
  if (exchange ? req.method !== 'POST' : !['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', exchange ? 'POST' : 'GET, HEAD');
    return res.status(405).end();
  }
  const secret = process.env.ICEVISION_CARBON_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(secret)) return res.status(503).end('Carbon Arena is unavailable.');
  const key = Buffer.from(secret, 'hex');

  try {
    if (exchange) {
      if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return res.status(403).end();
      if (asset === 'open-program') {
        const token = req.headers.authorization?.split(' ')[1];
        const access = verify(key, token, fixture);
        if (access?.purpose !== 'program') return res.status(401).end();
        files(key);
        setCookie(res, 'program', token, access.remaining, fixture);
        return res.status(204).end();
      }
      const status = await checkStaff(req.headers.authorization);
      if (status !== 200) return res.status(status).end();
      files(key);
      if (asset === 'program-link') return res.status(200).json({ token: issue(key, 'program', PROGRAM_TTL, fixture) });
      setCookie(res, 'preview', issue(key, 'preview', PREVIEW_TTL, fixture), PREVIEW_TTL, fixture);
      return res.status(204).end();
    }

    const canOpenProgram = verify(key, fromCookie(req, 'program'), fixture)?.purpose === 'program';
    const canPreview = req.query.follow !== 'desk' && verify(key, fromCookie(req, 'preview'), fixture)?.purpose === 'preview';
    if (!canOpenProgram && !canPreview) {
      return res.status(403).end('Open the private Carbon Arena from the OBS Desk.');
    }
    const assets = files(key);
    if (typeof asset !== 'string' || !Object.hasOwn(assets, asset)) return res.status(404).end();
    const bytes = Buffer.from(assets[asset], 'base64');
    res.setHeader('Content-Type', TYPES[extname(asset)]);
    res.setHeader('Content-Length', bytes.length);
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'");
    return res.status(200).end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    console.error('Carbon Arena access failed:', error.name);
    return res.status(503).end('Carbon Arena is unavailable.');
  }
};
