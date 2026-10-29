import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(serverRoot, '..');

export const paths = { serverRoot, repoRoot };

export function loadEnv() {
  const files = [path.join(serverRoot, '.env'), path.join(repoRoot, '.env')];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function resolveDatabasePath() {
  const configured = process.env.DATABASE_PATH;
  if (!configured) return path.join(serverRoot, 'data', 'eventra.sqlite');
  if (configured === ':memory:') return ':memory:';
  return path.isAbsolute(configured) ? configured : path.resolve(serverRoot, configured);
}
