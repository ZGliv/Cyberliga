// The public journey must stay coherent across the discovery and broadcast surfaces.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
// A late join can show the completed UTC soccer fixture until the next slot.
// Active games must advance; a verified fulltime score needs only its final paint.
const broadcastReady=()=>{
  const view=window.__arcadeView,frame=window.__arcadeFrame?.();
  return view?.drawCount>2||(view?.drawCount>0&&frame?.sportId==='soccer'&&frame.phase==='fulltime');
};
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.ARCADE_PREVIEW_URL||'http://127.0.0.1:4173';
const output='output/network-ui';await mkdir(output,{recursive:true});
const sports=['soccer','american-football','basketball','hockey','baseball','combat'];
const browser=await chromium.launch({headless:true});const reports=[];
function captureErrors(page){const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});page.on('requestfailed',r=>errors.push(`${r.failure()?.errorText} ${r.url()}`));return errors;}
async function inspect(page,label){
  await page.waitForFunction(()=>typeof window.render_game_to_text==='function');
  await page.evaluate(()=>document.fonts.ready);
  const result=await page.evaluate(()=>{
    const state=JSON.parse(window.render_game_to_text());const bad=[];
    function finite(v,p='state'){if(typeof v==='number'&&!Number.isFinite(v))bad.push(p);else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))finite(x,p+'.'+k);}finite(state);
    const nav=[...document.querySelectorAll('nav[aria-label="Primary navigation"] a')].filter(a=>a.getBoundingClientRect().width>0);
    return {overflow:document.documentElement.scrollWidth>innerWidth,bad,nav:nav.map(a=>({text:a.textContent.trim(),href:a.getAttribute('href')})),font:document.fonts.check('800 32px "Barlow Condensed"'),brandFont:getComputedStyle(document.querySelector('.cl-brand-name')).fontFamily,screen:state.screen||state.sport||state.mode};
  });
  assert.equal(result.overflow,false,label+' overflow');assert.deepEqual(result.bad,[],label+' finite state');
  assert.deepEqual(result.nav.map(a=>a.text),['Home','Leagues'],label+' navigation');assert(result.font&&result.brandFont.includes('Barlow Condensed'),label+' self-hosted typography');
  return result;
}
try {
  for(const sport of sports){
    const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=captureErrors(page);
    await page.goto(`${origin}/world.html`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelectorAll('.fixture-card').length===24);
    const filterLabel='Show '+sport.replaceAll('-',' ')+' games';await page.getByRole('button',{name:filterLabel,exact:true}).click();
    assert.equal(await page.locator('.fixture-card').count(),4,sport+' fixture filter');
    const watch=page.locator('#watch-featured');const box=await watch.boundingBox();assert(box&&box.height>=44&&box.y+box.height<=844,sport+' first-fold watch action');
    const fixture=await watch.getAttribute('href');await watch.click();await page.waitForFunction(broadcastReady);
    const arena=await inspect(page,sport+' arena');const frame=await page.evaluate(()=>window.__arcadeFrame());assert.equal(frame.sportId,sport);
    await page.locator('.ab-nav').getByRole('link',{name:'Leagues',exact:true}).click();await page.waitForSelector('.club-card');
    assert.equal(await page.locator('.club-card').count(),8);assert.equal(await page.locator('#channel-grid>a').count(),4);
    const clubs=page.locator('.club-card');const clubId=await clubs.nth(5).getAttribute('data-team');await clubs.nth(5).click();
    const athlete=page.locator('.athlete-row').first();const athleteHref=await athlete.getAttribute('href');const athleteId=new URL(athleteHref,origin).searchParams.get('player');await athlete.click();
    await page.waitForFunction(()=>typeof window.render_game_to_text==='function'&&JSON.parse(render_game_to_text()).screen==='athlete-profile');const profile=await inspect(page,sport+' profile');
    const identity=await page.evaluate(()=>JSON.parse(render_game_to_text()));assert.equal(identity.athlete.id,athleteId);assert.equal(identity.team.id,clubId);assert.equal(identity.sport.id,sport);
    assert.equal(await page.locator('#season-stats,#career-numbers,#form-chart').count(),0);
    const matchup=await page.locator('#arena-link').getAttribute('href');assert.equal(new URL(matchup,origin).searchParams.get('home'),clubId);
    await page.locator('#arena-link').click();await page.waitForFunction(broadcastReady);const returnFrame=await page.evaluate(()=>window.__arcadeFrame());assert(returnFrame.teams.some(t=>t.id===clubId));
    await page.locator('.ab-nav').getByRole('link',{name:'Home',exact:true}).click();await page.waitForSelector('#watch-featured');await inspect(page,sport+' return Home');
    assert.deepEqual(errors,[],sport+' browser errors');reports.push({sport,fixture,clubId,athleteId,matchup,arena,profile,errors});await context.close();console.log(`${sport}: Home → match → HQ → athlete → match → Home PASS`);
  }
  const context=await browser.newContext({viewport:{width:320,height:700},reducedMotion:'reduce'});const page=await context.newPage();const errors=captureErrors(page);
  await page.goto(`${origin}/player.html?sport=american-football&team=atlanta-peaches&player=atlanta-peaches-a21`,{waitUntil:'networkidle'});await inspect(page,'long athlete name');
  await page.screenshot({path:`${output}/long-athlete-mobile.png`,fullPage:true});
  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedPayload=data;}}));
  await page.locator('#share-button').click();assert((await page.evaluate(()=>window.__sharedPayload.url)).includes('atlanta-peaches-a21'));assert.equal(await page.locator('#share-button').isDisabled(),false);
  await page.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedLink=value;}}});});
  await page.locator('#share-button').click();assert.equal(await page.locator('#share-button').textContent(),'Link copied');assert((await page.evaluate(()=>window.__copiedLink)).includes('atlanta-peaches-a21'));await page.locator('#share-button').click();await page.waitForTimeout(2500);assert((await page.locator('#share-button').textContent()).includes('Share athlete'),'Repeated share restores original button');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await page.locator('#share-button').click();assert.equal(await page.locator('#share-button').textContent(),'Use address bar');await inspect(page,'share failure fallback');assert.deepEqual(errors,[]);reports.push({share:'native/copy/unavailable pass',longName:'Chattahoochee Chuck',errors});await context.close();
} finally {await browser.close();}
await writeFile(`${output}/report.json`,JSON.stringify(reports,null,2));
