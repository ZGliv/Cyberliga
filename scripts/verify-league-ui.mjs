import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectLeague, initializeLeague, tickLeague } from '../lib/league-store.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const directory = await mkdtemp(join(tmpdir(), 'cyberliga-browser-'));
const url = `file:${directory}/league.db`;
const db = connectLeague({ url });
const epoch = Date.now() - 15 * 6000 - 2000;
await initializeLeague(db, { epoch, roundMs:6000 });
await tickLeague(db);
db.close();
const port = 4197;
const server = spawn(process.execPath, ['server.mjs'], { env:{ ...process.env, PORT:String(port), CYBERLIGA_LEAGUE_DATABASE_URL:url }, stdio:'ignore' });
const origin = `http://127.0.0.1:${port}`;
const output = 'output/league-ui'; await mkdir(output, { recursive:true });
const browser = await chromium.launch({ headless:true });
const report = [];
try {
  for (let i = 0; i < 40; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve,100)); }
  for (const width of [1440,375,390]) {
    const page = await browser.newPage({ viewport:{width,height:1000} });
    const errors=[]; page.on('pageerror',error=>errors.push(error.message)); page.on('console',message=>{ if(message.type()==='error') errors.push(message.text()); });
    await page.goto(origin+'/league.html');
    await page.waitForFunction(()=>window.CyberligaLeagueHQ?.getState().standingsSource==='persistent-simulation');
    assert.equal(await page.locator('#season-standings tr').count(),8);
    await page.selectOption('#season-picker','soccer-s00001');
    await page.waitForFunction(()=>document.querySelector('#season-table-caption').textContent.includes('56 completed'));
    assert.equal(await page.locator('.season-result').count(),56);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    await page.locator('#season-history').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${output}/season-${width}.png`});
    await page.locator('.season-result').first().click();
    await page.waitForFunction(()=>document.querySelector('#fixture-events li')?.textContent.includes('match started'));
    assert(await page.locator('#fixture-events').textContent().then(text=>text.includes('match final')));
    await page.screenshot({path:`${output}/report-${width}.png`});
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#fixture-dialog').isVisible(),false);
    await page.reload(); await page.waitForFunction(()=>window.CyberligaLeagueHQ?.getState().standingsSource==='persistent-simulation');
    assert.equal(await page.locator('#season-standings tr').count(),8);
    assert.deepEqual(errors,[]);report.push({width,historyResults:56,standingsRows:8,matchReport:true,reload:true,errors});await page.close();
  }
  const page=await browser.newPage();
  for(const sport of ['soccer','basketball','hockey','baseball','combat','american-football']) {
    await page.goto(origin+'/league.html?sport='+sport);
    await page.waitForFunction(()=>window.CyberligaLeagueHQ?.getState().standingsSource==='persistent-simulation');
    await page.selectOption('#season-picker',sport+'-s00001');
    await page.waitForFunction(()=>document.querySelector('#season-table-caption').textContent.includes('56 completed'));
    assert.equal(await page.locator('#season-standings tr').count(),8);
    report.push({sport,completedGames:56,leaders:await page.locator('.season-leader').count()});
  }
  await page.close();
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); server.kill('SIGTERM'); await new Promise(resolve=>server.on('exit',resolve)); await rm(directory,{recursive:true,force:true}); }
