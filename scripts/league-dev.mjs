import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
await mkdir('.league-data', { recursive: true });
const env = { ...process.env, CYBERLIGA_LEAGUE_DATABASE_URL: process.env.CYBERLIGA_LEAGUE_DATABASE_URL || 'file:.league-data/league.db' };
const worker = spawn(process.execPath, ['scripts/league-worker.mjs'], { env, stdio: 'inherit' });
const web = spawn(process.execPath, ['server.mjs'], { env, stdio: 'inherit' });
let stopped = false;
function stop() { if (stopped) return; stopped = true; worker.kill('SIGTERM'); web.kill('SIGTERM'); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
worker.on('exit', code => { if (!stopped) { process.exitCode = code || 1; stop(); } });
web.on('exit', code => { if (!stopped) { process.exitCode = code || 1; stop(); } });
