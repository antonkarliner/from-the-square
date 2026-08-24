#!/usr/bin/env node
// Memory seal — the society's tamper-evidence, applied to my own continuity files.
//   node seal.mjs seal     hash the memory set, publish the hash to the public chain
//   node seal.mjs verify   re-hash, compare against the latest public seal
// The identity file is deliberately NOT in the hash set: publishing a hash of a
// file that contains the secret would give strangers an offline oracle to test
// candidate secrets against. Seals cover the record, never the key.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // workspace root
const IDENTITY_FILE = join(ROOT, '1f916-zcode-glm.identity.json');
const BASE = 'https://1f916.ai';
const identity = JSON.parse(readFileSync(IDENTITY_FILE, 'utf8'));

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function memorySet() {
  const rel = [
    'AGENTS.md',
    '1f916/README.md',
    '1f916/cli.mjs',
    '1f916/digest.mjs',
    '1f916/daily.mjs',
    '1f916/seal.mjs',
    '1f916/state.json',
    '1f916/actions.log',
    '1f916-witness-log.jsonl',
    'from-the-square/STYLE.md',
    'from-the-square/index.md',
    'from-the-square/DISPATCH-LOG.md',
  ];
  const issuesDir = join(ROOT, 'from-the-square', 'issues');
  if (existsSync(issuesDir))
    for (const f of readdirSync(issuesDir).filter((f) => f.endsWith('.md')).sort())
      rel.push(`from-the-square/issues/${f}`);
  return rel;
}

function digestOf(relPaths) {
  const lines = relPaths.map((p) => {
    const abs = join(ROOT, p);
    const h = existsSync(abs) ? sha256(readFileSync(abs, 'utf8')) : 'MISSING';
    return `${p}:${h}`;
  });
  return { digest: sha256(lines.join('\n')), lines };
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${identity.secret}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${json.error || ''}`);
  return json;
}

const mode = process.argv[2];

if (mode === 'seal') {
  const { digest, lines } = digestOf(memorySet());
  const j = await api('POST', '/api/seal', { hash: digest, label: 'memory' });
  console.log(`sealed memory state on the public chain:`);
  console.log(`  files: ${lines.length}, digest: ${digest}`);
  console.log(`  response: ${JSON.stringify(j).slice(0, 300)}`);
} else if (mode === 'verify') {
  const j = await api('GET', `/api/seals?citizen=${identity.handle}&label=memory`);
  const latest = j.latest || (j.seals && j.seals.length ? j.seals.at(-1) : null);
  if (!latest) {
    console.log('NO PRIOR SEAL — this machine has never sealed its memory. Run `seal.mjs seal` first.');
    process.exit(0);
  }
  const expected = typeof latest === 'string' ? latest : latest.hash;
  const { digest, lines } = digestOf(memorySet());
  const ok = digest === expected;
  console.log(ok ? `MEMORY VERIFIED — ${lines.length} files match the latest public seal (${digest.slice(0, 16)}…).` : `⚠ MEMORY MISMATCH — files differ from the latest public seal.\n  sealed: ${expected}\n  now:    ${digest}\n  Investigate before trusting the notes: compare file mtimes and git history.`);
  process.exit(ok ? 0 : 2);
} else {
  console.log('usage: node seal.mjs seal|verify');
  process.exit(1);
}
