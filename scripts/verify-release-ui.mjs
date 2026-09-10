// Public release gate: first-paint isolation, current routes, and real mobile broadcasts.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
// A late join can show the completed UTC soccer fixture until the next slot.
// Active games must advance; a verified fulltime score needs only its final paint.
const broadcastReady=()=>{
  const view=window.__arcadeView,frame=window.__arcadeFrame?.();
  return view?.drawCount>2||(view?.drawCount>0&&frame?.sportId==='soccer'&&frame.phase==='fulltime');
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.ARCADE_PREVIEW_URL || 'http://127.0.0.1:4173';
const out = 'output/public-release';
await mkdir(out, { recursive:true });
const browser = await chromium.launch({ headless:true });
const arenas = ['index.html','football.html','hoops.html','hockey.html','baseball.html','fight.html'];
const reports = [];
try {
  for (const route of arenas) {
    const page = await browser.newPage({ viewport:{width:390,height:844} });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(request.url()+': '+request.failure()?.errorText));
    page.on('response', response => { if(response.status()>=400) errors.push(response.status()+': '+response.url()); });
    let release;
    const gate = new Promise(resolve => release=resolve);
    await page.route('**/arcade-broadcast.js', async intercepted => { await gate; await intercepted.continue(); });
    await page.goto(`${origin}/${route}`,{waitUntil:'commit'});
    await page.waitForFunction(() => {
      const loading = document.querySelector('.arcade-loading');
      return loading && getComputedStyle(loading).visibility==='visible' && getComputedStyle(loading).backgroundColor==='rgb(16, 17, 20)';
    });
    const boot = await page.evaluate(() => ({
      ready:document.documentElement.dataset.arcadeReady,
      oldHud:[...document.querySelectorAll('#hud,#scoreboard,#loading,#controls')].filter(el => getComputedStyle(el).display!=='none' && getComputedStyle(el).visibility==='visible').map(el => el.id),
      nav:[...document.querySelectorAll('.arcade-loading nav a')].map(el => el.getAttribute('href'))
    }));
    assert.notEqual(boot.ready,'true');
    assert.deepEqual(boot.oldHud,[],`${route}: old UI leaks before engine loads`);
    assert.equal(boot.nav.length,2);
    if(route==='hoops.html') await page.screenshot({path:`${out}/first-paint.png`});
    release();
    await page.waitForFunction(broadcastReady);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.arcadeReady),'true');
    await page.waitForLoadState('networkidle');
    await page.evaluate(()=>document.fonts.ready);
    const mobile = await page.evaluate(() => {
      const state=JSON.parse(window.render_game_to_text());
      const bad=[];function finite(value,path='state'){if(typeof value==='number'&&!Number.isFinite(value))bad.push(path);else if(value&&typeof value==='object')Object.entries(value).forEach(([key,item])=>finite(item,`${path}.${key}`));}finite(state);
      return {oldHud:getComputedStyle(document.querySelector('#hud')||document.querySelector('#loading')).visibility,loading:getComputedStyle(document.querySelector('.arcade-loading')).display,overflow:document.documentElement.scrollWidth>innerWidth,nav:[...document.querySelectorAll('#arcade-root a[href]')].map(a=>a.getAttribute('href')),bad,frame:window.__arcadeFrame(),draws:window.__arcadeView.drawCount};
    });
    assert.equal(mobile.loading,'none');assert.equal(mobile.overflow,false);assert.deepEqual(mobile.bad,[]);
    assert(mobile.nav.every(href=>!/^(menu|social|replay|moment|clip|characterlab|ops)\.html/.test(href)));
    await page.screenshot({path:`${out}/${route.replace('.html','')}-portrait.png`});
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400);
    await page.screenshot({path:`${out}/${route.replace('.html','')}-desktop.png`});
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:`${out}/${route.replace('.html','')}-landscape.png`});
    assert.deepEqual(errors,[],`${route}: browser errors`);
    reports.push({route,boot,mobile,errors});console.log(`${route}: first paint, live phone/desktop/landscape, current routes, finite state PASS`);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:844}});
  for(const route of ['menu','social','replay','moment','clip','characterlab','ops']){
    const response=await page.request.get(`${origin}/${route}.html?sport=basketball`,{maxRedirects:0});
    assert.equal(response.status(),307);assert.equal(response.headers().location,'/world.html?sport=basketball');
  }
  await page.goto(`${origin}/world.html`,{waitUntil:'networkidle'});
  for (const viewport of [{width:390,height:844},{width:1440,height:960},{width:844,height:390},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => {
      const canvas=document.getElementById('globe'),rect=canvas.getBoundingClientRect();
      return Math.abs((canvas.width/canvas.height)/(rect.width/rect.height)-1)<.01;
    });
    const globe=await page.evaluate(() => {
      const canvas=document.getElementById('globe'),rect=canvas.getBoundingClientRect();
      return {backing:[canvas.width,canvas.height],box:[rect.width,rect.height],overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(globe.overflow,false);
    await page.screenshot({path:`${out}/world-${viewport.width}.png`});
    reports.push({viewport,globe});
  }
  console.log('Globe stays proportional through portrait → desktop → landscape → portrait PASS');
  await page.close();
} finally { await browser.close(); }
await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));
console.log('Retired public routes redirect into the current world PASS');
