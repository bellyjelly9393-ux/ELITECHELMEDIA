import { createCipheriv, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const [arenaRoot, keyFile, output] = process.argv.slice(2);
if (!arenaRoot || !keyFile || !output) {
  throw new Error('Usage: node tools/carbon-broadcast-pack.mjs <carbon-arena directory> <key file> <output>');
}
const key = (await readFile(keyFile, 'utf8')).trim();
if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Expected a 32-byte hex key file');

const paths = {
  'broadcast.html': 'broadcast.html',
  'broadcast.css': 'broadcast.css',
  'src/broadcast.js': 'src/broadcast.js',
  'src/arenaBuilder.js': 'src/arenaBuilder.js',
  'src/hockeyAvatars.js': 'src/hockeyAvatars.js',
  'src/characters/pregameArt.js': 'src/characters/pregameArt.js',
  'src/characters/pregameGear.js': 'src/characters/pregameGear.js',
  'src/characters/skaterPipeline.js': 'src/characters/skaterPipeline.js',
  'src/adapters/carbonWorld.js': '../src/adapters/carbonWorld.js',
  'src/core/rink.js': '../src/core/rink.js',
  'assets/characters/gb-royal-blue.webp': 'assets/characters/gb-royal-blue.webp',
  'assets/characters/gbr-warmup-reference.jpg': 'assets/characters/gbr-warmup-reference.jpg',
  'assets/models/skater_lod0.glb': 'assets/models/skater_lod0.glb',
  'assets/models/skater_lod1.glb': 'assets/models/skater_lod1.glb',
  'vendor/three/build/three.module.js': 'node_modules/three/build/three.module.js',
  'vendor/three/examples/jsm/loaders/GLTFLoader.js': 'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  'vendor/three/examples/jsm/utils/BufferGeometryUtils.js': 'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',
  'vendor/three/examples/jsm/utils/SkeletonUtils.js': 'node_modules/three/examples/jsm/utils/SkeletonUtils.js',
  'vendor/three/LICENSE.txt': 'node_modules/three/LICENSE',
};

const base = '/lg3s-gb/arena/';
const entries = await Promise.all(Object.entries(paths).map(async ([route, relative]) => {
  let bytes = await readFile(resolve(arenaRoot, relative));
  if (route === 'broadcast.html') {
    bytes = Buffer.from(bytes.toString().replace(/"\/(broadcast\.css|src\/broadcast\.js|vendor\/three\/)/g, `"${base}$1`));
  }
  if (route.startsWith('src/characters/')) {
    bytes = Buffer.from(bytes.toString().replaceAll("'/assets/", `'${base}assets/`));
  }
  if (route === 'src/broadcast.js') {
    bytes = Buffer.from(bytes.toString().replace("const site = 'https://wildmanhockey-elitechelmedia.app';", 'const site = location.origin;'));
  }
  if (route === 'src/arenaBuilder.js') {
    bytes = Buffer.from(bytes.toString().replaceAll("'../../src/", "'./"));
  }
  return [route, bytes.toString('base64')];
}));

const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
cipher.setAAD(Buffer.from('icevision-carbon-broadcast-v1'));
const ciphertext = Buffer.concat([cipher.update(gzipSync(JSON.stringify(Object.fromEntries(entries)))), cipher.final()]);
const envelope = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
await writeFile(output, `// Encrypted broadcast-only Carbon Arena package. See docs/lg3s-hosted-carbon.md.\nmodule.exports = ${JSON.stringify(envelope)};\n`);
