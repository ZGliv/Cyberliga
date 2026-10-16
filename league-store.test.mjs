import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectLeague, initializeLeague, tickLeague, readLeague, foundingTeams } from './lib/league-store.js';

test('all six founding leagues retain 48 clubs, 416 real named athletes', async () => {
  const teams = await foundingTeams();
  assert.equal(teams.length, 48);
  assert.equal(teams.flatMap(team => team.athletes).length, 416);
  assert.equal(new Set(teams.flatMap(team => team.athletes.map(athlete => athlete.publicId))).size, 416);
});

test('durable seasons catch up, finalize once, retain history and survive restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cyberliga-test-'));
  const url = `file:${dir}/league.db`; const epoch = 1_800_000_000_000; const roundMs = 6000;
  let db = connectLeague({ url });
  try {
    await initializeLeague(db, { epoch, roundMs });
    await tickLeague(db, epoch + 1000);
    let league = await readLeague(db);
    assert.equal(league.summary.liveGames, 4);
    assert.equal(league.summary.completedGames, 0);
    assert(league.standings.every(row => row.played === 0));
    const firstId = league.season.id;
    const checkpoint = epoch + 15 * roundMs + 2000;
    let tick = await tickLeague(db, checkpoint, { maxRounds: 3 });
    assert.equal(tick.backlogRounds, 12);
    while (tick.backlogRounds) tick = await tickLeague(db, checkpoint, { maxRounds: 3 });
    league = await readLeague(db, { seasonId: firstId });
    assert.equal(league.fixtures.length, 56);
    assert.equal(league.summary.completedGames, 56);
    assert(league.standings.every(row => row.played === 14));
    assert.equal(league.standings.reduce((n, row) => n + row.wins, 0), league.standings.reduce((n, row) => n + row.losses, 0));
    assert.equal(league.standings.reduce((n, row) => n + row.scoreFor, 0), league.standings.reduce((n, row) => n + row.scoreAgainst, 0));
    const before = JSON.stringify(league.standings);
    const eventCount = (await db.execute('SELECT count(*) n FROM league_events')).rows[0].n;
    await Promise.all([tickLeague(db, checkpoint), tickLeague(db, checkpoint - 1000)]);
    assert.equal((await db.execute('SELECT count(*) n FROM league_events')).rows[0].n, eventCount);
    db.close(); db = connectLeague({ url });
    // Re-initialization never resets the epoch or rewrites roster/history.
    await initializeLeague(db, { epoch: Date.now(), roundMs: 9000 });
    league = await readLeague(db, { seasonId: firstId });
    assert.equal(JSON.stringify(league.standings), before);
    assert.equal(league.roundMs, roundMs);
    assert.equal((await readLeague(db)).season.number, 2);
    const detail = await readLeague(db, { seasonId: firstId, fixtureId: league.fixtures[0].fixtureId });
    assert(detail.fixture.events.some(event => event.kind === 'match_final'));
    const athleteIds = new Set(league.teams.flatMap(team => team.athletes.map(athlete => athlete.publicId)));
    assert(league.leaders.every(athlete => athleteIds.has(athlete.publicId)));
    for (const sport of ['soccer', 'basketball', 'hockey', 'baseball', 'combat', 'american-football']) {
      const season = await readLeague(db, { sport, seasonId: `${sport}-s00001` });
      assert.equal(season.summary.completedGames, 56);
      assert(season.standings.every(row => row.played === 14));
    }
    await assert.rejects(() => readLeague(db, { sport: 'missing' }), /unknown_sport/);
    await assert.rejects(() => readLeague(db, { fixtureId: 'missing' }), /unknown_fixture/);
    const delayed = await readLeague(db, { now: Date.now() + 100_000 });
    assert.equal(delayed.delayed, true);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test('no-worker visits catch up with bounded work and racing clients see one history', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cyberliga-visits-'));
  const url = `file:${dir}/league.db`, epoch = Date.now() - 100 * 6000;
  const writer = connectLeague({url}), visitor = connectLeague({url});
  try {
    await initializeLeague(writer,{epoch,roundMs:6000});
    // No worker runs for 100 rounds. A request may materialize only four rounds.
    const result = await tickLeague(visitor,Date.now(),{maxRounds:4,minIntervalMs:30_000});
    assert.equal(result.processedRounds,4); assert(result.backlogRounds >= 96);
    assert.equal((await readLeague(visitor)).catchingUp,true);
    const now=Date.now();
    const racing=await Promise.all([tickLeague(visitor,now,{maxRounds:4,minIntervalMs:30_000}),tickLeague(writer,now,{maxRounds:4,minIntervalMs:30_000})]);
    assert.deepEqual(racing.map(item=>item.completedRounds).sort((a,b)=>a-b),[8,12]);
    let next;
    do { next=await tickLeague(writer,now,{maxRounds:4,minIntervalMs:30_000}); } while(next.backlogRounds);
    const a=await readLeague(writer),b=await readLeague(visitor);
    assert.deepEqual(a.standings,b.standings);assert.equal(a.catchingUp,false);
    assert.equal((await tickLeague(visitor,now,{maxRounds:4,minIntervalMs:30_000})).skipped,true);
    assert.equal((await writer.execute('SELECT count(*) n FROM league_fixtures WHERE finalized=1')).rows[0].n,2400);
  } finally {writer.close();visitor.close();await rm(dir,{recursive:true,force:true});}
});

test('a failed write transaction leaves no partial fixtures or advanced cursor',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cyberliga-rollback-'));
  const db=connectLeague({url:`file:${dir}/league.db`});
  try {
    const epoch=Date.now();await initializeLeague(db,{epoch,roundMs:6000});
    const fault={transaction:async mode=>{
      const tx=await db.transaction(mode);
      return {execute:tx.execute.bind(tx),batch:async statements=>{await tx.batch(statements.slice(0,6));throw new Error('simulated interrupted write');},commit:tx.commit.bind(tx),rollback:tx.rollback.bind(tx),close:tx.close.bind(tx)};
    }};
    await assert.rejects(()=>tickLeague(fault,epoch+7000),/simulated interrupted write/);
    assert.equal((await db.execute('SELECT count(*) n FROM league_fixtures')).rows[0].n,0);
    assert.equal((await db.execute('SELECT completed_round FROM league_state')).rows[0].completed_round,-1);
    await tickLeague(db,epoch+7000);assert.equal((await readLeague(db)).summary.completedGames,4);
  } finally {db.close();await rm(dir,{recursive:true,force:true});}
});
