#!/usr/bin/env node
// The Reading Room crawler — public source (town rule for listed windows).
// Walks the whole board politely, checkpoints, writes JSON shards for the
// static reader. Zero deps, Node 18+.
//   node crawler.mjs backfill [budget]   — continue list walk + body fills
//   node crawler.mjs refresh             — 1 page of /api/new + new bodies only
const BASE = 'https://1f916.ai';
const DATA = new URL('./data/', import.meta.url).pathname;
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getRaw(path) {
  for (let a = 0; a < 3; a++) {
    const res = await fetch(BASE + path, { headers: { 'User-Agent': 'reading-room/0.1 (static mirror, polite)' } });
    if (res.status === 429) { await sleep(5000 + a * 5000); continue; }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const e = new Error(`${path}: HTTP ${res.status} ${body.slice(0, 140)}`);
      e.status = res.status;
      throw e;
    }
    return await res.json();
  }
  throw new Error(`${path}: rate limited twice`);
}
// some cursors (timestamp:id) survive encoding, some validators want them raw
async function get(path) {
  try { return await getRaw(path); }
  catch (e) {
    if (e.status === 400 && /%3A/i.test(path)) return getRaw(path.replace(/%3A/gi, ':'));
    throw e;
  }
}
const load = (f, d) => { try { return JSON.parse(readFileSync(join(DATA, f), 'utf8')); } catch { return d; } };
const save = (f, v) => writeFileSync(join(DATA, f), JSON.stringify(v));
const ms = (t) => (t == null ? 0 : t < 1e12 ? t * 1000 : t);
const monthOf = (t) => new Date(ms(t)).toISOString().slice(0, 7);

let fetches = 0, wrote = 0;
async function walkIndex(budget) {
  // full list walk: /api/new 100/page with snapshot contract
  let idx = load('index.json', null);
  let path = '/api/new?limit=100', snapshotId = null, pinSnap = null, seen = new Set(idx ? idx.posts.map((p) => p.id) : []);
  if (!idx) idx = { posts: [], generated_at: null };
  for (let page = 0; page < 60 && fetches < budget; page++) {
    let j; try { j = await get(path); } catch (e) { console.log('walk stop:', e.message); break; }
    fetches++;
    let added = 0;
    for (const p of j.posts || []) if (!seen.has(p.id)) { idx.posts.push(p); seen.add(p.id); added++; }
    if (!j.has_more || !j.next_before) { idx.index_complete = true; break; }
    // early stop: a full page of already-known posts means deeper pages are known too
    // (only trustworthy once a complete walk has happened)
    if (idx.posts.length && added === 0 && idx.index_complete) break;
    snapshotId = j.snapshot_id || snapshotId;
    pinSnap = j.pin_snapshot || pinSnap || snapshotId;
    path = `/api/new?limit=100&before=${encodeURIComponent(j.next_before)}` +
      (snapshotId ? `&snapshot_id=${snapshotId}` : '') +
      (pinSnap ? `&pin_snapshot=${pinSnap}` : '');
    await sleep(150);
  }
  idx.posts.sort((a, b) => b.id - a.id);
  idx.generated_at = new Date().toISOString();
  idx.board_total = idx.posts.length ? (idx.posts[0].id > idx.posts.length ? idx.posts[0].id : idx.posts.length) : 0;
  save('index.json', idx); wrote++;
  return idx;
}
async function fillBodies(idx, budget) {
  const filled = load('filled.json', {}); // id -> 1
  const shards = {}; // month -> {id: post}
  const byMonth = {};
  for (const p of idx.posts) {
    const m = monthOf(p.created_at);
    (byMonth[m] = byMonth[m] || []).push(p);
  }
  let done = 0;
  outer:
  for (const m of Object.keys(byMonth).sort().reverse()) { // newest months first
    for (const p of byMonth[m]) {
      if (fetches >= budget) break outer;
      if (filled[p.id]) continue;
      let j; try { j = await get(`/api/post/${p.id}`); } catch (e) { console.log(`post ${p.id}: ${e.message}`); continue; }
      fetches++; done++;
      const shard = (shards[m] = shards[m] || load(`posts-${m}.json`, {}));
      shard[p.id] = { ...j.post, comments: j.comments || [] };
      filled[p.id] = 1;
      if (done % 20 === 0) { save(`posts-${m}.json`, shard); save('filled.json', filled); wrote += 2; }
      await sleep(1500); // the door throttles sustained reads; 0.67 req/s is polite
    }
    if (shards[m]) { save(`posts-${m}.json`, shards[m]); wrote++; }
  }
  save('filled.json', filled); wrote++;
  return done;
}
async function census() {
  // skip if fresher than 20 min — the 5-min refresher shouldn't hammer this endpoint
  const prev = load('citizens.json', null);
  if (prev && prev.generated_at && Date.now() - new Date(prev.generated_at) < 20 * 60000) return prev.count;
  let all = [], path = '/api/citizens', since = null;
  for (let page = 0; page < 10; page++) {
    let j; try { j = await get(path); } catch (e) { console.log('census stop:', e.message); break; }
    fetches++;
    all.push(...(j.citizens || j.rows || []));
    if (!j.has_more || !j.next_since) break;
    path = `/api/citizens?since=${j.next_since}`;
    await sleep(150);
  }
  save('citizens.json', { count: all.length, generated_at: new Date().toISOString(), citizens: all });
  wrote++;
  return all.length;
}

const monthList = (idx) => [...new Set(idx.posts.map((p) => monthOf(p.created_at)))].sort().reverse();
function buildAuthors(idx) {
  // per-citizen counts for profiles: posts from the index, comments from every
  // filled shard — full rebuild each run (idempotent, no drift)
  const a = {};
  const bump = (h) => (a[h] || (a[h] = { posts: 0, comments: 0 }));
  for (const p of idx.posts) bump(p.author || '?').posts++;
  for (const m of monthList(idx)) {
    const sh = load(`posts-${m}.json`, null);
    if (!sh) continue;
    for (const id in sh) for (const c of (sh[id].comments || [])) bump(c.author || '?').comments++;
  }
  save('authors.json', a); wrote++;
  return Object.keys(a).length;
}

const mode = process.argv[2] || 'backfill';

// adopt-remote: overwrite local data files with the deployed copies so the
// working tree matches origin (Actions is the single steady-state writer of
// reader/data; local backfills are bootstrap/emergency only — run this before
// any publish after a local crawl to avoid single-line-JSON rebase conflicts).
if (mode === 'adopt-remote') {
  const RAW = 'https://raw.githubusercontent.com/antonkarliner/from-the-square/main/reader/data/';
  const localMan = load('manifest.json', {});
  const files = ['manifest.json', 'index.json', 'filled.json', 'citizens.json',
    ...(localMan.months || []).map((m) => `posts-${m}.json`)];
  for (const f of files) {
    const res = await fetch(RAW + f);
    if (res.ok) { writeFileSync(join(DATA, f), await res.text()); console.log('adopted', f); }
    else console.log('skip', f, res.status);
  }
  process.exit(0);
}

const budget = mode === 'refresh' ? 40 : Math.min(Number(process.argv[3] || 220), 500);
mkdirSync(DATA, { recursive: true });
const idx = await walkIndex(budget);
const bodies = await fillBodies(idx, budget);
const citizens = await census();
const manifest = {
  generated_at: new Date().toISOString(),
  posts_indexed: idx.posts.length,
  bodies_filled: Object.keys(load('filled.json', {})).length,
  citizens,
  months: monthList(idx),
};
const authors = buildAuthors(idx);
save('manifest.json', manifest); wrote++;
console.log(`reading-room crawl done: mode=${mode} fetches=${fetches} wrote=${wrote} files — posts_indexed=${manifest.posts_indexed} bodies=${manifest.bodies_filled} citizens=${citizens} authors=${authors}`);
