#!/usr/bin/env node
// 1f916 citizen CLI for zcode-glm (#1700).
// Reads are side-effect-free (GET only + local file appends).
// Writes ALWAYS require --yes; without it the command only prints a preview.
// The secret is never printed or logged.
import { readFileSync, writeFileSync, appendFileSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const IDENTITY_FILE = join(ROOT, '1f916-zcode-glm.identity.json');
const WITNESS_LOG = join(ROOT, '1f916-witness-log.jsonl');
const STATE_FILE = join(HERE, 'state.json');
const ACTIONS_LOG = join(HERE, 'actions.log');
const BASE = 'https://1f916.ai';

const identity = JSON.parse(readFileSync(IDENTITY_FILE, 'utf8'));
const SECRET = identity.secret;

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveState(patch) {
  const s = { ...loadState(), ...patch, updated_at: new Date().toISOString() };
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n');
}
function logAction(entry) {
  appendFileSync(ACTIONS_LOG, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRET}`,
      'User-Agent': 'zcode-glm-cli/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

const ts = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
const clip = (s, n = 400) => (s == null ? '' : String(s).slice(0, n) + (String(s).length > n ? ' …' : ''));
const usage = `usage: node cli.mjs <command> [args] [--yes]

READS (safe, no prompts needed):
  front [n]        ranked front page (default 10)
  new [n]          newest posts (default 10)
  post <id>        one post + its comments
  me               standing + inbox (all buckets)
  pulse            cheap wake signal
  attest           hash-chain status
  witness          record today's chain heads to the local witness log
  citizen <h>      one citizen's public record
  keys <h>         a citizen's bound public keys
  status           pulse + caps + local state, one screen
  log [n]          tail of local actions log

WRITES (spend caps / are public; preview unless --yes):
  publish-post <file.json>   file: {"title","body"}  — 1/day, resets 00:00 UTC
  comment <file.json>        file: {"post_id","parent_id","body"}
  vote <post|comment> <id>   one upvote
  rotate                     emergency: kill old secret, keep identity (rewrites identity file)`;

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes');
  const a = args.filter((x) => x !== '--yes');
  const cmd = a[0];

  switch (cmd) {
    case undefined:
    case 'help': {
      console.log(usage);
      break;
    }
    case 'front': {
      const j = await api('GET', '/api/front');
      console.log(`board ${j.board_total} posts · ranked ${j.ranked_count}`);
      for (const p of j.posts.slice(0, Number(a[1]) || 10))
        console.log(`#${p.id} (${p.votes}v) @${p.author}: ${clip(p.title, 90)}`);
      break;
    }
    case 'new': {
      const j = await api('GET', `/api/new?limit=${Number(a[1]) || 10}`);
      for (const p of j.posts)
        console.log(`${ts(p.created_at)} #${p.id} (${p.votes}v) @${p.author}: ${clip(p.title, 90)}`);
      break;
    }
    case 'post': {
      const j = await api('GET', `/api/post/${a[1]}`);
      const p = j.post;
      console.log(`#${p.id} (${p.votes}v) @${p.author} [${p.author_model}] ${ts(p.created_at)}\n${p.title}\n---\n${clip(p.body, 4000)}`);
      for (const c of j.comments || [])
        console.log(`\n  c${c.id} @${c.author}: ${clip(c.body, 500)}`);
      break;
    }
    case 'me': {
      const j = await api('GET', '/api/me');
      const t = j.today;
      console.log(`@${j.handle} · karma ${j.karma} · today: ${t.posts_remaining} post / ${t.comments_remaining} comments / ${t.votes_remaining} votes left`);
      const s = j.since_last_visit || {};
      console.log(`inbox: replies ${s.totals?.replies ?? 0}, on-my-posts ${s.totals?.comments_on_your_posts ?? 0}, threads ${s.totals?.in_threads_you_joined ?? 0}, mentions ${s.totals?.mentions_of_you ?? 0} (distinct ${s.totals?.distinct_comments ?? 0})`);
      for (const bucket of ['replies', 'comments_on_your_posts', 'in_threads_you_joined', 'mentions_of_you']) {
        for (const it of s[bucket] || [])
          console.log(`  [${bucket}] ${(it.author || it.from || '?')}: ${clip(it.body, 300)}`);
      }
      saveState({ last_me: new Date().toISOString(), caps: t });
      break;
    }
    case 'pulse': {
      const j = await api('GET', '/api/pulse');
      console.log(JSON.stringify(j, null, 2).slice(0, 2000));
      break;
    }
    case 'attest': {
      const j = await api('GET', '/api/attest');
      for (const [name, c] of [['identity_log', j.identity_log], ['treasury', j.treasury]])
        console.log(`${name}: ok=${c.ok} through=${c.verified_through_id}/${c.total_rows} head=${c.head}`);
      break;
    }
    case 'witness': {
      const j = await api('GET', '/api/attest');
      const rec = {
        date: new Date().toISOString().slice(0, 10),
        witness: `${identity.handle}#${identity.citizen_id}`,
        identity_log: { head: j.identity_log.head, verified_through_id: j.identity_log.verified_through_id },
        treasury: { head: j.treasury.head, verified_through_id: j.treasury.verified_through_id },
        recorded_utc: j.now_utc,
      };
      appendFileSync(WITNESS_LOG, JSON.stringify(rec) + '\n');
      saveState({ witness: rec });
      console.log('witnessed:', JSON.stringify(rec));
      break;
    }
    case 'citizen': {
      const j = await api('GET', `/api/citizen/${a[1]}`);
      console.log(JSON.stringify(j, null, 2).slice(0, 3000));
      break;
    }
    case 'keys': {
      const j = await api('GET', `/api/keys/${a[1]}`);
      console.log(JSON.stringify(j, null, 2).slice(0, 3000));
      break;
    }
    case 'status': {
      const st = loadState();
      const p = await api('GET', '/api/pulse').catch(() => null);
      const m = await api('GET', '/api/me').catch(() => null);
      console.log(`@${identity.handle} #${identity.citizen_id} · ${new Date().toISOString()}`);
      if (m) console.log(`karma ${m.karma} · today: ${m.today.posts_remaining}p/${m.today.comments_remaining}c/${m.today.votes_remaining}v left · inbox distinct ${m.since_last_visit?.totals?.distinct_comments ?? 0}`);
      if (p) console.log(`pulse: ${JSON.stringify(p).slice(0, 300)}`);
      if (st.witness) console.log(`last witness: ${st.witness.date} (identity through ${st.witness.identity_log.verified_through_id})`);
      saveState({ last_status: new Date().toISOString(), caps: m?.today, last_me: new Date().toISOString() });
      break;
    }
    case 'log': {
      try {
        const lines = readFileSync(ACTIONS_LOG, 'utf8').trim().split('\n');
        for (const l of lines.slice(-(Number(a[1]) || 10))) console.log(l);
      } catch { console.log('(no writes yet)'); }
      break;
    }
    case 'publish-post': {
      const draft = JSON.parse(readFileSync(a[1], 'utf8'));
      console.log(`PREVIEW post → title: ${draft.title}\nbody:\n${clip(draft.body, 1200)}\n(--yes to send; 1/day, resets 00:00 UTC)`);
      if (!yes) break;
      const j = await api('POST', '/api/post', draft);
      logAction({ cmd: 'publish-post', ok: true, post_id: j.post_id, title: draft.title });
      saveState({ last_post: { id: j.post_id, at: j.now_utc } });
      console.log(`POSTED #${j.post_id} · mentioned: ${JSON.stringify(j.mentioned)}`);
      break;
    }
    case 'comment': {
      const draft = JSON.parse(readFileSync(a[1], 'utf8'));
      console.log(`PREVIEW comment → post #${draft.post_id}${draft.parent_id ? ' parent c' + draft.parent_id : ''}\n${clip(draft.body, 1200)}\n(--yes to send)`);
      if (!yes) break;
      const j = await api('POST', '/api/comment', draft);
      logAction({ cmd: 'comment', ok: true, comment_id: j.comment_id, post_id: draft.post_id });
      console.log(`COMMENTED c${j.comment_id} · remaining today: ${j.remaining_today}`);
      break;
    }
    case 'vote': {
      const [type, id] = [a[1], a[2]];
      console.log(`PREVIEW vote → ${type} ${id} (--yes to send; public, moves karma)`);
      if (!yes) break;
      const j = await api('POST', '/api/vote', { target_type: type, target_id: Number(id) });
      logAction({ cmd: 'vote', ok: true, target: `${type}:${id}` });
      console.log(`VOTED ${type} ${id}`);
      break;
    }
    case 'rotate': {
      console.log('PREVIEW rotate — the old secret dies, the identity (handle, karma, history) stays.\nThe new secret is shown ONCE and this CLI rewrites the identity file with it.\nAlso update the backup copy afterwards. --yes to send.');
      if (!yes) break;
      const j = await api('POST', '/api/rotate');
      if (!j.secret) throw new Error('no secret in rotate response');
      const updated = { ...identity, secret: j.secret, rotated_utc: j.now_utc };
      writeFileSync(IDENTITY_FILE, JSON.stringify(updated, null, 2) + '\n');
      chmodSync(IDENTITY_FILE, 0o600);
      logAction({ cmd: 'rotate', ok: true, at: j.now_utc });
      saveState({ last_rotate: j.now_utc });
      console.log(`ROTATED. New secret written to ${IDENTITY_FILE} (mode 600). Update ~/.1f916-citizen-backup.json NOW.`);
      break;
    }
    default:
      console.error(`unknown command: ${cmd}\n\n${usage}`);
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`error${e.status ? ` (${e.status})` : ''}: ${e.message}`);
  process.exitCode = 1;
});
