import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectLeague, initializeLeague } from './lib/league-store.js';

test('real HTTP reads recover an unattended league; the daily cron is authenticated',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'cyberliga-http-'));
  const url=`file:${dir}/league.db`,epoch=Date.now()-100*6000;
  const db=connectLeague({url});await initializeLeague(db,{epoch,roundMs:6000});
  const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',CYBERLIGA_LEAGUE_DATABASE_URL:url,CRON_SECRET:'test-only-cron-secret'},stdio:['ignore','pipe','pipe']});
  const origin=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('server startup timeout')),5000);
    server.stdout.on('data',data=>{const match=data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});
    server.on('error',reject);
  });
  try {
    let response=await fetch(origin+'/api/seasons?observedAt=2100-01-01&sport=soccer');assert.equal(response.status,200);
    let value=await response.json();assert.equal(value.catchingUp,true);
    assert.equal((await db.execute('SELECT completed_round FROM league_state')).rows[0].completed_round,3);
    assert(Date.parse(value.observedAt)<Date.now()+1000,'request cannot supply simulation time');
    const racing=await Promise.all([fetch(origin+'/api/seasons').then(r=>r.json()),fetch(origin+'/api/seasons').then(r=>r.json())]);
    assert(racing.every(item=>item.persisted));
    assert.equal((await db.execute('SELECT completed_round FROM league_state')).rows[0].completed_round,11);
    assert.equal((await fetch(origin+'/api/seasons',{method:'POST',body:'{"observedAt":"2100-01-01"}'})).status,405);
    assert.equal((await fetch(origin+'/api/season-cron')).status,401);
    assert.equal((await fetch(origin+'/api/season-cron',{headers:{authorization:'Bearer ééééééééééééééééééééé'}})).status,401);
    response=await fetch(origin+'/api/season-cron',{headers:{authorization:'Bearer test-only-cron-secret'}});
    assert.equal(response.status,200);assert.equal((await response.json()).backlogRounds,0);
    const [a,b]=await Promise.all([fetch(origin+'/api/seasons').then(r=>r.json()),fetch(origin+'/api/seasons').then(r=>r.json())]);
    assert.equal(a.catchingUp,false);assert.deepEqual(a.standings,b.standings);
    assert.equal((await db.execute('SELECT count(*) n FROM league_fixtures WHERE finalized=1')).rows[0].n,2400);
    assert.equal((await fetch(origin+'/.league-data/league.db')).status,400);
    assert.equal((await fetch(origin+'/api/seasons?sport=unknown')).status,404);
  } finally {server.kill('SIGTERM');await once(server,'exit');db.close();await rm(dir,{recursive:true,force:true});}
});
