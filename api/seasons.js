import { connectLeague, readLeague, tickLeague } from '../lib/league-store.js';

let client;
export default async function handler(request, response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  function send(status, body) { response.statusCode = status; response.end(request.method === 'HEAD' ? undefined : JSON.stringify(body)); }
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) { response.setHeader('Allow', 'GET, HEAD'); return send(405, { error: 'method_not_allowed' }); }
  if (!process.env.CYBERLIGA_LEAGUE_DATABASE_URL && !process.env.TURSO_DATABASE_URL) return send(200, { available: false, error: 'league_not_connected', message: 'Saved league history is not connected on this deployment.' });
  const params = new URL(request.url, 'http://localhost').searchParams;
  try {
    client ||= connectLeague();
    // Only the server clock drives progress. Limit each visit to four missed rounds.
    // The write transaction rechecks the clock, serializing racing visitors/workers.
    await tickLeague(client, Date.now(), { maxRounds:4, minIntervalMs:30_000 });
    send(200, await readLeague(client, { sport: params.get('sport') || 'soccer', seasonId: params.get('season') || undefined, fixtureId: params.get('fixture') || undefined }));
  } catch (error) {
    if (['unknown_sport', 'unknown_season', 'unknown_fixture'].includes(error.message)) return send(404, { error: error.message });
    console.error('[league read]', error.message);
    send(503, { error: 'league_unavailable', message: 'Saved league history is temporarily unavailable. Try again shortly.' });
  }
}
