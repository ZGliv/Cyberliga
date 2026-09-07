const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Recorded before the contact-origin correction, using the seven deterministic seeds below.
const expected=[{"scenario":"single","seed":743712137,"time":2.7333333333333285,"play":{"type":"LINER","quality":0.74,"canCatch":false,"fieldClean":false},"chaserId":"seoul-moon-jars-a5","flight":{"time":0.7851206471954989,"target":{"x":18.703260858805564,"z":-3.640370173364794}}},{"scenario":"ground","seed":1450084384,"time":2.7333333333333285,"play":{"type":"GROUND","quality":0.61,"canCatch":false,"fieldClean":true},"chaserId":"seoul-moon-jars-a5","flight":{"time":0.49607138784919075,"target":{"x":11.883733790741879,"z":-0.3796410473145602}}},{"scenario":"double","seed":1088205366,"time":2.7666666666666617,"play":{"type":"LINER","quality":0.77,"canCatch":false,"fieldClean":false},"chaserId":"seoul-moon-jars-depth-8","flight":{"time":0.9672492365402344,"target":{"x":24.51823677745552,"z":-0.61623222237476}}},{"scenario":"double_play","seed":830094478,"time":2.7333333333333285,"play":{"type":"GROUND","quality":0.58,"canCatch":false,"fieldClean":true},"chaserId":"seoul-moon-jars-a1","flight":{"time":0.34802281183048245,"target":{"x":5.308174300030905,"z":-1.3763238067598096}}},{"scenario":"fly","seed":2415522833,"time":2.749999999999995,"play":{"type":"FLY","quality":0.71,"canCatch":true,"fieldClean":false},"chaserId":"seoul-moon-jars-depth-8","flight":{"time":1.0181540210513893,"target":{"x":23.212978839048976,"z":2.5502593569788807}}},{"scenario":"homer","seed":802237407,"time":2.7333333333333285,"play":{"type":"DEEP DRIVE","quality":0.63,"canCatch":true,"fieldClean":false},"chaserId":"seoul-moon-jars-depth-8","flight":{"time":1.1927674718381234,"target":{"x":32.874871444339334,"z":-1.0385197551192673}}},{"scenario":"foul","seed":4186796964,"time":2.749999999999995,"play":{"type":"FOUL","quality":null,"canCatch":null,"fieldClean":null},"chaserId":null,"flight":{"time":1.0778529895619275,"target":{"x":-7.247403291281921,"z":13.794919870563586}}}];
const baseline=process.argv.includes('--baseline'),name='baseball-contact';
await mkdir('output/arcade-contact',{recursive:true});
const output=`output/arcade-contact/${name}-${baseline?'before':'after'}.json`;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(60000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.ARCADE_PREVIEW_URL||'http://127.0.0.1:4188'}/baseball.html?manual=1&fresh=1&match=0`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__arcadeFrame&&window._baseballTest);
 const rows=await page.evaluate(()=>{
  const rows=[];
  for(const scenario of ['single','ground','double','double_play','fly','homer','foul']){
   window._baseballTest.deterministic(`arcade-contact-${scenario}`);window._baseballTest.scenario(scenario);
   let previous;
   for(let i=0;i<500;i++){
    window.advanceTime(1000/60);const frame=window.__arcadeFrame(),state=JSON.parse(window.render_game_to_text());
    if(previous?.frame.projectile.mode==='PITCH'&&frame.projectile.mode==='LIVE'){
     const vy=frame.projectile.vy+22/60,y=scenario==='foul'?1.1:1.05;
     const flightTime=(vy+Math.sqrt(vy*vy+44*y))/22;
     rows.push({scenario,previous:previous.frame.projectile,frame,state,seed:window._baseballTest.getSeed(),
      legacyFlight:{time:flightTime,target:{x:.1+frame.projectile.vx*flightTime,z:frame.projectile.vz*flightTime}}});break;
    }
    previous={frame};
   }
  }
  return rows;
 });
 assert.equal(rows.length,7);assert.deepEqual(errors,[]);
 if(!baseline){
  const before=expected;
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  for(const row of rows){const old=before.find(b=>b.scenario===row.scenario),contact=row.frame.presentation.contact;
   assert.ok(contact,`contact metadata missing: ${row.scenario}`);
   assert.equal(row.seed,old.seed,`RNG changed: ${row.scenario}`);assert.equal(row.frame.time,old.time,`event time changed: ${row.scenario}`);
   for(const key of ['type','quality','canCatch','fieldClean'])assert.deepEqual(row.state.play?.[key],old.play[key],`${key} changed: ${row.scenario}`);
   assert.equal(row.frame.presentation.play.chaserId,old.chaserId,`fielder selection changed: ${row.scenario}`);
   assert.ok(row.frame.entities.some(e=>e.duty==='fielder'&&e.fieldPosition===1&&e.action==='crouch'),`catcher not planted in crouch: ${row.scenario}`);
   assert.ok(d(contact.point,row.previous)<1e-8,`contact position resets: ${row.scenario}`);
   const ball=row.frame.projectile;assert.ok(d(ball,{x:row.previous.x+ball.vx/60,y:row.previous.y+ball.vy/60,z:row.previous.z+ball.vz/60})<1e-8,`first flight step teleports: ${row.scenario}`);
   assert.ok(d(row.frame.presentation.bat.barrel,contact.point)<1e-8,`bat misses contact: ${row.scenario}`);
   assert.ok(Math.abs(contact.flightTime-old.flight.time)<1e-8,`flight time changed: ${row.scenario}`);
   assert.ok(Math.hypot(contact.target.x-old.flight.target.x,contact.target.z-old.flight.target.z)<1e-8,`flight target changed: ${row.scenario}`);
  }
 }
 await writeFile(output,JSON.stringify(rows,null,2));console.log(`${baseline?'BASELINE':'PASS'}: ${rows.length} forced-contact families, errors=${errors.length}`);
 await page.screenshot({path:`output/arcade-contact/${name}-${baseline?'before':'after'}.png`});
}finally{await browser.close();}
