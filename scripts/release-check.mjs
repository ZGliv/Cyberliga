import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_BRANCH = 'codex/vercel-sports-revamp';
const EXPECTED_PROJECT = Object.freeze({
  projectId: 'prj_9mFssNBl04pIJlaRPyzm6gaYG2O5',
  orgId: 'team_NM5p3BbkWQgVAHTWuXrxLZCx',
  projectName: 'cyberliga',
});

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function fail(message) {
  console.error(`Release check refused: ${message}`);
  process.exit(1);
}

const cwd = await realpath(process.cwd());
const root = await realpath(git('rev-parse', '--show-toplevel'));
if (cwd !== root) fail(`run from the repository root (${root}), not ${cwd}`);

const branch = git('branch', '--show-current');
if (branch !== EXPECTED_BRANCH) fail(`expected ${EXPECTED_BRANCH}, found ${branch || 'detached HEAD'}`);

const dirty = git('status', '--porcelain=v1', '--untracked-files=all');
if (dirty) fail('the release snapshot is not committed and clean');

let linked;
try {
  linked = JSON.parse(await readFile(path.join(root, '.vercel', 'project.json'), 'utf8'));
} catch (error) {
  fail(`cannot read .vercel/project.json (${error.message})`);
}
for (const [key, value] of Object.entries(EXPECTED_PROJECT)) {
  if (linked[key] !== value) fail(`Vercel ${key} must be ${value}, found ${linked[key] || 'missing'}`);
}

const world = await readFile(path.join(root, 'world.html'), 'utf8');
if (!/24\s+GAMES/i.test(world) || !/48\s+CLUBS/i.test(world)) {
  fail('world.html is not the accepted 24-game / 48-club release homepage');
}
if (!/data-home-edition=["']world-desk["']/i.test(world) || !/>\s*Tonight\s*</i.test(world) || !/class=["'][^"']*liveboard/i.test(world)) {
  fail('world.html is missing the accepted World Desk schedule');
}

const commit = git('rev-parse', 'HEAD');
console.log(JSON.stringify({
  ready: true,
  branch,
  commit,
  worktree: root,
  vercelProject: linked.projectName,
  vercelProjectId: linked.projectId,
}, null, 2));
