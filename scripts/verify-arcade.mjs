// Browser integration gate. Set PLAYWRIGHT_MODULE to a local Playwright module if it is not installed.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.ARCADE_PREVIEW_URL||'http://127.0.0.1:4188';
const output=path.resolve('output/arcade-integration');await mkdir(output,{recursive:true});
const games=[['soccer','index.html'],['american-football','football.html'],['basketball','hoops.html'],['hockey','hockey.html'],['baseball','baseball.html'],['combat','fight.html']];
const selected=process.env.ARCADE_SPORTS?.split(',');
const browser=await chromium.launch({headless:true});const reports=[];
try{
  for(const [sport,route] of games){
    if(selected&&!selected.includes(sport))continue;
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
    page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+': '+r.url());});
    await page.goto(`${origin}/${route}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__arcadeView?.drawCount>2);
    const pair=await page.evaluate(sport=>{const teams=CYBERLIGA_CONTENT.getTeams(sport);return [teams[5].id,teams[2].id];},sport);
    await page.goto(`${origin}/${route}?home=${pair[0]}&away=${pair[1]}&league=${sport}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__arcadeView?.drawCount>2);
    const result=await page.evaluate(()=>{
      window.dispatchEvent(new Event('resize'));
      const captureCanvas=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0]?.id;
      window.advanceTime(2000);const f=window.__arcadeFrame(),nonfinite=[];
      function check(v,p='frame'){if(typeof v==='number'&&!Number.isFinite(v))nonfinite.push(p);else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>check(x,`${p}.${k}`));}check(f);
      return {sport:f.sportId,captureCanvas,teams:f.teams.map(t=>t.id),score:f.teams.map(t=>String(t.score)),hud:[...document.querySelectorAll('[data-score]')].map(n=>n.textContent),event:f.event?.title||null,hudEvent:document.querySelector('#ab-event').textContent,overflow:document.documentElement.scrollWidth>innerWidth,nav:[...document.querySelectorAll('.ab-nav a')].map(a=>({label:a.textContent,href:a.getAttribute('href'),visible:a.getBoundingClientRect().width>0})),sports:document.querySelectorAll('.ab-sport-strip a').length,nonfinite,paintCount:window.__arcadeView.drawCount,entityCount:f.entities.filter(e=>e.visible!==false).length};
    });
    assert.deepEqual(result.teams,sport==='baseball'?[pair[1],pair[0]]:pair,`${sport}: selected home/away orientation`);assert.deepEqual(result.hud,result.score,`${sport}: HUD agrees with authoritative score`);
    assert.equal(result.captureCanvas,'arcade-canvas',`${sport}: resize keeps capture selection on the visible canvas`);
    if(result.event)assert.equal(result.hudEvent,result.event,`${sport}: event updates during deterministic stepping`);
    assert.deepEqual(result.nav.map(n=>n.label),['Home','Leagues']);assert(result.nav.every(n=>n.href&&n.visible));assert.equal(result.sports,6);assert.equal(result.overflow,false);assert.deepEqual(result.nonfinite,[]);assert(result.entityCount>0);assert.deepEqual(errors,[]);
    if(sport==='hockey'){
      result.goalieClear=await page.evaluate(()=>{
        window.__CYBERLIGA_HOCKEY_TEST__.forceMoment('goalieClear');let covered=null,released=null;
        for(let i=0;i<48;i++){window.advanceTime(50);const f=window.__arcadeFrame(),owner=f.entities.find(e=>e.id===f.projectile.ownerId);if(!covered&&owner?.role==='G')covered={id:owner.id,time:f.time};if(covered&&!released&&owner?.id!==covered.id)released={time:f.time};}
        return {covered,released,releaseSeconds:covered&&released?released.time-covered.time:null};
      });
      assert(result.goalieClear.covered&&result.goalieClear.released&&result.goalieClear.releaseSeconds<=1.2,'Goalie must clear covered puck instead of stalling');
    }
    await page.screenshot({path:path.join(output,`${sport}-portrait.png`)});assert.deepEqual(errors,[]);reports.push({...result,errors});console.log(`${sport}: route, real score/event, navigation, finite state, portrait layout and errors PASS`);
    await context.close();
  }
}finally{await browser.close();}
await writeFile(path.join(output,'report.json'),JSON.stringify(reports,null,2));
