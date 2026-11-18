import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = new URL('./', import.meta.url);
const backend = await readFile(new URL('../../backend.js', root), 'utf8');
for (const [env, constant] of [
  ['VITE_SUPABASE_URL', 'VVHL_SUPABASE_URL'],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VVHL_SUPABASE_KEY'],
]) {
  const existing = new RegExp(`const ${constant} = "(.*?)";`).exec(backend)?.[1];
  if (!process.env[env] && !existing) throw new Error(`Missing ${env} in the site configuration`);
  process.env[env] ||= existing;
}

await build({ root: fileURLToPath(root) });
const output = new URL('../../assets/lg3s-world/', root);
await rm(new URL('./assets/', output), { recursive: true, force: true });
await cp(new URL('./dist/', root), output, { recursive: true, force: true });
