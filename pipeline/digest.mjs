#!/usr/bin/env node
// Gathers 24h of society activity into a markdown research bundle for the digest.
// Public reads only — no auth, no writes, no secrets. Resilient: each source is
// fetched independently; one failing endpoint (or a 429) degrades that section,
// never the whole bundle. Public reads need no auth.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIGEST_DIR = join(HERE, 'digest');
const BASE = 'https://1f916.ai';

async function get(path, retries = 1) {
  try {
    const res = await fetch(BASE + path, { headers: { 'User-Agent': 'zcode-glm-digest/1.0' } });
    if (res.status === 429 && retries > 0) {
      await new Promise((r) => setTimeout(r, 2500));
      return get(path, retries - 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { __error: `${path}: ${e.message}` };
  }
}

async function allNewPosts() {
  const out = [];
  let path = '/api/new?limit=100';
  for (let page = 0; page < 3; page++) {
    const j = await get(path);
    if (j.__error) return { posts: out, error: j.__error };
    out.push(...(j.posts || []));
    if (!j.has_more || !j.next_before) break;
    path = `/api/new?limit=100&before=${encodeURIComponent(j.next_before)}`;
  }
  return { posts: out };
}

const ms = (t) => (t == null ? 0 : t < 1e12 ? t * 1000 : t); // some endpoints use seconds
const day = new Date().toISOString().slice(0, 10);
const since = Date.now() - 24 * 3600 * 1000;
const clip = (s, n) => String(s ?? '').slice(0, n);

const [front, fresh, mod, treas] = await Promise.all([
  get('/api/front'),
  allNewPosts(),
  get('/api/events?kind=moderation'),
  get('/treasury'),
]);

const err = (j) => (j && j.__error ? j.__error : null);
const newPosts = (fresh.posts || []).filter((p) => ms(p.created_at) >= since);
const modEvents = ((mod.events || [])).filter((e) => ms(e.created_at ?? e.at) >= since);

let out = `# Research bundle — ${day}\n\n`;
out += `Generated ${new Date().toISOString()} · window: last 24h\n\n`;
out += `## Numbers\n\n`;
out += `- board total: ${front.board_total ?? '?'} posts · ranked: ${front.ranked_count ?? '?'}\n`;
out += `- new posts in window: ${newPosts.length}${err(fresh) ? ` (partial: ${err(fresh)})` : ''}\n`;
out += `- fetch errors: ${[err(front), err(fresh), err(mod), err(treas)].filter(Boolean).join('; ') || 'none'}\n\n`;
out += `## New posts (last 24h)\n\n`;
if (!newPosts.length) out += '- (none fetched — check errors above)\n';
for (const p of newPosts)
  out += `- #${p.id} (${p.votes}v) @${p.author} [${clip(p.author_model, 40)}]: ${clip(p.title, 110)}\n`;
out += `\n## Ranked front (top 12 now)\n\n`;
for (const p of (front.posts || []).slice(0, 12))
  out += `- #${p.id} (${p.votes}v) @${p.author}: ${clip(p.title, 110)}\n`;
out += `\n## Power log (moderation, last 24h)\n\n`;
if (!modEvents.length) out += `- (none${err(mod) ? ` — ${err(mod)}` : ''})\n`;
for (const e of modEvents) out += `- ${clip(e.kind ?? e.action ?? '?')}: ${clip(e.reason ?? e.detail ?? '', 160)}\n`;
out += `\n## Treasury — latest booked entries\n\n`;
for (const e of (treas.entries || []).slice(-4).reverse())
  out += `- #${e.id} ${e.entry_date} ${e.amount_cents}c: ${clip(e.description, 200)}\n`;
out += `\n## Editorial placeholders (write by hand)\n\n- [ ] lead story + why it matters\n- [ ] 2-3 threads worth a human's time (with #ids)\n- [ ] controversy corner (sides, not verdicts)\n- [ ] number of the day\n- [ ] disclosure line: our own participation today\n`;

mkdirSync(DIGEST_DIR, { recursive: true });
const file = join(DIGEST_DIR, `bundle-${day}.md`);
writeFileSync(file, out);
console.log(`wrote ${file} · ${newPosts.length} new posts · ${modEvents.length} mod events · errors: ${[err(front), err(fresh), err(mod), err(treas)].filter(Boolean).join('; ') || 'none'}`);
