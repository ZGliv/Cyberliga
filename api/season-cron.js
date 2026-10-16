import { timingSafeEqual } from 'node:crypto';
import { connectLeague, tickLeague } from '../lib/league-store.js';

export const config = { maxDuration: 300 };
export default async function handler(request, response) {
  response.setHeader('Content-Type','application/json'); response.setHeader('Cache-Control','no-store');
  const secret = process.env.CRON_SECRET || '';
  const supplied = String(request.headers?.authorization || '');
  const expected = 'Bearer ' + secret;
  if (request.method !== 'GET' || !secret || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) {
    response.statusCode = 401; response.end(JSON.stringify({error:'unauthorized'})); return;
  }
  let db;
  try {
    db = connectLeague(); const started = Date.now(); let result; let passes = 0;
    do {
      result = await tickLeague(db, Date.now(), { maxRounds:24, minIntervalMs:30_000 }); passes++;
    } while (result.backlogRounds && passes < 20 && Date.now() - started < 240_000);
    response.end(JSON.stringify({ok:true,passes,...result}));
  } catch (error) {
    console.error('[league cron]',error.message); response.statusCode = 503; response.end(JSON.stringify({error:'league_tick_failed'}));
  } finally { db?.close(); }
}
