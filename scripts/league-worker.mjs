import { mkdir } from 'node:fs/promises';
import { connectLeague, initializeLeague, tickLeague } from '../lib/league-store.js';

if (!process.env.CYBERLIGA_LEAGUE_DATABASE_URL && !process.env.TURSO_DATABASE_URL) {
  await mkdir('.league-data', { recursive: true });
  process.env.CYBERLIGA_LEAGUE_DATABASE_URL = 'file:.league-data/league.db';
}
const db = connectLeague();
await initializeLeague(db);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });
console.log('Cyberliga league worker ready. Saved seasons advance every six minutes. Ctrl+C stops after the current transaction.');
while (!stopping) {
  let result;
  try { result = await tickLeague(db, Date.now(), { maxRounds: 4, minIntervalMs:30_000 }); console.log(JSON.stringify({ at: new Date().toISOString(), ...result })); }
  catch (error) { console.error('League tick failed; next attempt in five seconds:', error.message); }
  if (process.argv.includes('--once')) break;
  if (!result?.backlogRounds) for (let i = 0; i < 60 && !stopping; i++) await new Promise(resolve => setTimeout(resolve, 500));
}
db.close();
