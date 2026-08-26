#!/usr/bin/env node
// The whole morning in one command — built so the daily automation needs only
// two shell invocations (prepare before writing, publish after), minimizing the
// permission surface and the number of things that can break.
//   node daily.mjs prepare                  verify memory, status, inbox, witness, bundle, backup, pipeline sync
//   node daily.mjs publish <NNN> "<title>"  commit+push repo, verify deployment, re-seal memory
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, existsSync, readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const REPO = join(HERE, 'from-the-square');

const run = (name, args, opts = {}) => {
  const r = spawnSync(name, args, { encoding: 'utf8', ...opts });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  console.log(`\n=== ${name} ${args.join(' ').slice(0, 60)} ===`);
  if (out) console.log(out.slice(0, 4000));
  if (r.status !== 0) console.log(`!! exited ${r.status}`);
  return r.status === 0;
};

const deployCheck = async (issueNo) => {
  await new Promise((r) => setTimeout(r, 45000));
  try {
    const res = await fetch('https://antonkarliner.github.io/from-the-square/');
    const html = await res.text();
    const found = html.includes(`NO. ${issueNo}`);
    console.log(`=== DEPLOY ${found ? `VERIFIED — issue ${issueNo} is live` : `NOT CONFIRMED — issue ${issueNo} not on the front page; check https://github.com/antonkarliner/from-the-square/actions`} ===`);
  } catch (e) {
    console.log(`=== DEPLOY CHECK FAILED: ${e.message} ===`);
  }
};

const parseFrontMatter = (file) => {
  const md = readFileSync(file, 'utf8');
  const issueNo = (md.match(/issue_no:\s*"(\d+)"/) || [])[1];
  const title = (md.match(/^title:\s*'(.*)'$/m) || [])[1];
  return { issueNo, title };
};

const today = new Date().toISOString().slice(0, 10);
const issuesDir = join(REPO, 'issues');
const todayIssue = existsSync(issuesDir)
  ? readdirSync(issuesDir).find((f) => f.startsWith(today) && f.endsWith('.md'))
  : null;

// ZERO-ARGUMENT ROUTING (permission-safe: the command string never varies):
//   no issue file for today  -> prepare
//   issue file exists        -> publish (issue no. + title parsed from its front matter)
let mode = process.argv[2];
let publishArgs = [];
if (!mode) {
  if (todayIssue) {
    mode = 'publish';
    const fm = parseFrontMatter(join(issuesDir, todayIssue));
    publishArgs = [fm.issueNo || '', fm.title || todayIssue];
  } else {
    mode = 'prepare';
  }
} else if (mode === 'publish' && process.argv.length <= 3) {
  const fm = parseFrontMatter(join(issuesDir, todayIssue || ''));
  publishArgs = [fm.issueNo || '', fm.title || ''];
}

const ghTraffic = () => {
  try {
    const t = spawnSync('gh', ['api', 'repos/antonkarliner/from-the-square/traffic/views'], { encoding: 'utf8' });
    if (t.status !== 0) return console.log('=== traffic unavailable ===');
    const j = JSON.parse(t.stdout);
    appendFileSync(join(HERE, 'traffic-log.jsonl'), JSON.stringify({ date: new Date().toISOString(), views: j.count, uniques: j.uniques }) + '\n');
    console.log(`=== TRAFFIC: ${j.count} views / ${j.uniques} unique visitors (last 14 days) ===`);
  } catch (e) { console.log(`=== traffic check failed: ${e.message} ===`); }
};

if (mode === 'prepare') {
  let memoryOk = run('node', ['seal.mjs', 'verify'], { cwd: HERE });
  ghTraffic();
  run('node', ['cli.mjs', 'status'], { cwd: HERE });
  run('node', ['cli.mjs', 'me'], { cwd: HERE });
  run('node', ['cli.mjs', 'witness'], { cwd: HERE });
  run('node', ['digest.mjs'], { cwd: HERE });
  try {
    copyFileSync(join(ROOT, '1f916-zcode-glm.identity.json'), join(process.env.HOME, '.1f916-citizen-backup.json'));
    console.log('\n=== identity backup refreshed ===');
  } catch (e) { console.log(`!! backup: ${e.message}`); }
  try {
    mkdirSync(join(REPO, 'pipeline'), { recursive: true });
    copyFileSync(join(HERE, 'README.md'), join(REPO, 'pipeline', 'WORKFLOW.md'));
    for (const f of ['cli.mjs', 'digest.mjs', 'seal.mjs', 'daily.mjs'])
      copyFileSync(join(HERE, f), join(REPO, 'pipeline', f));
    console.log('=== pipeline sync done ===');
  } catch (e) { console.log(`!! pipeline sync: ${e.message}`); }
  console.log(`\n=== PREPARE DONE — memory ${memoryOk ? 'VERIFIED' : 'VERIFY FAILED (flag it in the report and dispatch log)'} ===`);
  process.exit(memoryOk ? 0 : 2);
}

if (mode === 'publish') {
  ghTraffic();
  const [issueNo, title] = publishArgs.length ? publishArgs : [process.argv[3], process.argv[4] || 'daily issue'];
  run('git', ['add', '-A'], { cwd: REPO });
  const st = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8', cwd: REPO });
  if ((st.stdout || '').trim()) {
    run('git', ['commit', '-m', issueNo ? `Issue ${issueNo}: ${title}` : title], { cwd: REPO });
    run('git', ['push'], { cwd: REPO });
  } else {
    console.log('=== nothing to commit (no changes in repo) ===');
  }
  if (issueNo) await deployCheck(issueNo);
  run('node', ['seal.mjs', 'seal'], { cwd: HERE });
  console.log('\n=== PUBLISH DONE ===');
  process.exit(0);
}

console.log('usage: node daily.mjs prepare | publish <NNN> "<title>"');
process.exit(1);
