// Render the release share card from the actual globe, club canon and athlete sprite.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.ARCADE_PREVIEW_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.goto(origin+'/world.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  // Export composition only; these overrides never enter the public application.
  await page.addStyleTag({content:`
    .arcade-home .topbar{height:76px;padding:0 36px}.cl-brand-name{font-size:38px}.cl-brand-mark{width:30px;height:30px}
    .world-layout{height:554px;grid-template-columns:710px 490px}.world-masthead-note{font-size:11px;margin-left:auto}.topbar .nav{display:none}
    .aw-world-intro{inset:0 36px auto;min-height:118px}.aw-world-intro h1{font-size:56px}.aw-world-intro>span{display:none}.aw-world-intro p{font-size:11px}
    #globe{top:116px;height:426px}.aw-world-cast,.aw-globe-caption{display:none}.marker{font-size:12px;min-height:32px;padding:6px 10px}
    .liveboard{padding:30px 28px}.panel-label{padding-bottom:20px}.desk-title>strong{font-size:52px}.desk-eyebrow{font-size:11px}.desk-date,.sport-stage{display:none}
    .game-drawer{overflow:hidden;padding-bottom:0}.league-group{padding-top:0}.league-group-head{display:none}.fixture-card:not(.fixture-card-lead),.league-group:not(:first-child){display:none}
    .fixture-card-lead{margin:0}.lead-feature{grid-template-columns:140px 1fr;padding:20px 20px 18px;gap:16px}.lead-art{height:170px}.lead-portrait{width:142px;height:149px}.lead-number{font-size:155px;top:-3px}
    .lead-athlete{font-size:56px}.lead-role,.lead-motion,.lead-rival{font-size:12px}.lead-club strong{font-size:22px}.lead-matchline{padding:18px 0}.lead-footer{padding-bottom:17px}.lead-ground{font-size:11px}
  `});
  await page.evaluate(()=>{document.querySelector('.desk-eyebrow').textContent='416 ORIGINAL CHARACTERS';document.querySelector('.desk-title>strong').textContent='Six sports. One world.';document.querySelector('.world-masthead-note').textContent='CYBERLIGA-TEN.VERCEL.APP';window.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>{const c=document.getElementById('globe'),r=c.getBoundingClientRect();return Math.abs((c.width/c.height)/(r.width/r.height)-1)<.01});await page.waitForTimeout(300);
  await page.screenshot({path:new URL('../cyberliga-share.png',import.meta.url).pathname});
} finally {await browser.close();}
