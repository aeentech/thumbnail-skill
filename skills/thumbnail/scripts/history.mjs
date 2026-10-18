#!/usr/bin/env node
// Remember which composition each thumbnail used, so consecutive runs stay varied.
// Usage:
//   node history.mjs                      -> prints the last 5 entries (JSON)
//   node history.mjs add <site> <composition> [note]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const file = process.env.THUMBNAIL_HISTORY || join(homedir(), '.thumbnail-skill', 'history.json');
let list = [];
try { list = JSON.parse(readFileSync(file, 'utf8')); } catch {}

const [cmd, site, composition, ...note] = process.argv.slice(2);
if (cmd === 'add') {
  if (!site || !composition) { console.error('Usage: node history.mjs add <site> <composition> [note]'); process.exit(1); }
  list.push({ date: new Date().toISOString().slice(0, 10), site, composition, note: note.join(' ') || undefined });
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(list.slice(-50), null, 2));
  console.log(`saved (${list.length})`);
} else {
  console.log(JSON.stringify(list.slice(-5), null, 2));
}
