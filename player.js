(function () {
  'use strict';

  var C = window.CYBERLIGA_CONTENT;
  var ARENAS = { soccer:'index.html', basketball:'hoops.html', hockey:'hockey.html', baseball:'baseball.html', combat:'fight.html', 'american-football':'football.html' };
  var STAT_SETS = {
    soccer:[['APPS',16,25],['GOALS',2,16],['KEY PASSES',14,51]],
    basketball:[['GAMES',18,28],['PTS / GAME',8,29],['ASSISTS',32,138]],
    hockey:[['GAMES',17,30],['POINTS',6,28],['HITS',18,74]],
    baseball:[['GAMES',22,40],['AVG',218,347],['RBI',9,39]],
    combat:[['BOUTS',4,11],['WINS',2,10],['KNOCKDOWNS',1,8]],
    'american-football':[['GAMES',8,17],['SNAPS',128,812],['IMPACT',44,99]]
  };
  var state = { elapsed:0, requested:{}, fallback:false, sport:null, team:null, athlete:null, rival:null, rating:0, form:[], stats:[], career:{}, headlines:[], canonical:'' };

  function hash(value) { return C && C.hash ? C.hash(value) : String(value).split('').reduce(function(a,c){return ((a<<5)-a+c.charCodeAt(0))>>>0;},2166136261); }
  function randomFor(seed) { return C.seededRandom(seed); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch];}); }
  function qs(values) { var q=new URLSearchParams();Object.keys(values).forEach(function(k){if(values[k]!=null&&values[k]!=='')q.set(k,values[k]);});return q.toString(); }
  function setText(id,value){var node=document.getElementById(id);if(node)node.textContent=value;}
  function setHref(id,value){var node=document.getElementById(id);if(node)node.href=value;}
  function formatStat(sportId,label,value){ if(sportId==='baseball'&&label==='AVG')return '.'+String(value).padStart(3,'0');if(label.indexOf('/ GAME')>0)return (value/10).toFixed(1);return String(value); }

  function resolve() {
    if (!C) return null;
    var params=new URLSearchParams(location.search);
    state.requested={sport:params.get('sport'),team:params.get('team'),player:params.get('player')||params.get('athlete')};
    var sport=C.getSport(state.requested.sport);
    if(!sport){sport=C.getSport('soccer');state.fallback=true;}
    var team=C.getTeam(state.requested.team,sport.id);
    if(!team){team=sport.teams[hash(state.requested.team||'default')%sport.teams.length];state.fallback=true;}
    var athlete=C.getAthlete(team.id,state.requested.player);
    if(!athlete){athlete=team.athletes[hash(state.requested.player||'default')%team.athletes.length];state.fallback=true;}
    state.sport=sport;state.team=team;state.athlete=athlete;state.rival=C.getTeam(team.rivalryId,sport.id)||sport.teams.filter(function(t){return t.id!==team.id;})[0];
    state.canonical='player.html?'+qs({sport:sport.id,team:team.id,player:athlete.id});
    return state;
  }

  function buildStats() {
    var seed=state.sport.id+'|'+state.team.id+'|'+state.athlete.id;
    var random=randomFor(seed+'|form');
    state.form=[];
    for(var i=0;i<5;i+=1)state.form.push(58+Math.floor(random()*38));
    state.rating=Math.round(state.form.reduce(function(a,b){return a+b;},0)/state.form.length);
    var defs=STAT_SETS[state.sport.id],statRandom=randomFor(seed+'|stats');
    state.stats=defs.map(function(def){return {label:def[0],value:Math.round(def[1]+statRandom()*(def[2]-def[1]))};});
    var age=19+(hash(seed+'|age')%15),seasons=Math.max(1,age-18-(hash(seed+'|late')%3));
    state.career={age:age,seasons:seasons,appearances:seasons*(10+hash(seed+'|apps')%19),honors:hash(seed+'|honors')%6,debut:2026-seasons+1};
    state.headlines=[
      state.athlete.name+' makes “'+state.athlete.signature+'” the play '+state.team.city+' cannot stop replaying',
      state.team.name+' build the next chapter around '+state.athlete.name,
      state.athlete.name+' carries the '+state.team.motif+' into '+state.rival.city,
      'Why the '+state.athlete.role+' is becoming this rivalry’s pressure point'
    ];
  }

  function portraitVars() {
    var n=hash(state.athlete.id),figure=document.getElementById('player-figure');
    var vars={
      '--body-w':(150+n%90)+'px','--body-h':(240+(n>>>3)%105)+'px','--head':(78+(n>>>7)%52)+'px',
      '--lean':(-9+(n>>>11)%19)+'deg','--leg':(32+(n>>>15)%31)+'px','--head-x':(-24+(n>>>18)%49)+'px',
      '--arm-a':(-5+(n>>>4)%34)+'deg','--arm-b':(-28+(n>>>9)%34)+'deg','--leg-a':(-13+(n>>>14)%15)+'deg','--leg-b':(2+(n>>>20)%14)+'deg',
      '--body-radius':[(n%60+20)+'% '+((n>>>6)%60+20)+'% '+((n>>>12)%50+25)+'% '+((n>>>17)%50+25)+'%'],
      '--head-radius':[((n>>>2)%55+25)+'% '+((n>>>8)%55+25)+'% '+((n>>>13)%55+25)+'% '+((n>>>19)%55+25)+'%'],
      '--num':'"'+state.athlete.number+'"'
    };
    Object.keys(vars).forEach(function(k){figure.style.setProperty(k,vars[k]);});
  }

  function updateMetadata() {
    var title=state.athlete.name+' / '+state.team.name+' / Cyberliga';
    var desc='#'+state.athlete.number+' '+state.athlete.role+' — '+state.athlete.signature+'. Meet '+state.athlete.name+' of '+state.team.name+'.';
    document.title=title;document.querySelector('meta[name="description"]').content=desc;
    ['og:title','twitter:title'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=title;});
    ['og:description','twitter:description'].forEach(function(key){document.querySelector('meta[property="'+key+'"],meta[name="'+key+'"]').content=desc;});
    document.querySelector('link[rel="canonical"]').href='https://cyberliga-ten.vercel.app/'+state.canonical;
    document.querySelector('meta[property="og:url"]').content='https://cyberliga-ten.vercel.app/'+state.canonical;
  }

  function render() {
    var a=state.athlete,t=state.team,s=state.sport,r=state.rival,root=document.documentElement;
    root.style.setProperty('--team',t.colors.primary);root.style.setProperty('--team2',t.colors.secondary);root.style.setProperty('--accent',t.colors.accent);
    setText('issue-sport',s.name);setText('issue-code','FILE '+String(hash(a.id)%1000).padStart(3,'0'));setText('league-name',s.league);setText('team-city',t.city+', '+t.region);setText('player-name',a.name);
    setText('player-dek','A '+a.archetype+' from '+t.city+'—'+a.temperament+', with one promise: '+a.signature+'.');
    setText('player-number','#'+a.number);setText('player-role',a.role);setText('player-archetype',a.archetype);setText('portrait-team',t.name);setText('portrait-motion',t.motion+'.');
    setText('debut-year',state.career.debut);setText('team-code',t.code);setText('form-grade',state.rating>=88?'A+':state.rating>=82?'A':state.rating>=74?'B+':'B');
    setText('ticker-name',a.name.toUpperCase());setText('ticker-copy',a.signature.toUpperCase());setText('ticker-rivalry',(t.name+' / '+r.name).toUpperCase());
    setText('temperament-title',a.temperament+'.');setText('temperament-copy',a.name+' is not designed to disappear into a system. '+capitalize(a.temperament)+', this is an athlete whose shape tells you what is coming while the timing keeps the secret.');
    setText('signature',capitalize(a.signature)+'.');setText('flaw',capitalize(a.flaw||('can trust the '+t.motion+' one possession too long'))+'.');setText('silhouette',capitalize(a.silhouette)+'.');setText('club-motion',capitalize(t.motion)+'.');
    setText('rating',state.rating);setText('trend-arrow',state.form[4]>=state.form[0]?'↗':'↘');
    document.getElementById('form-chart').innerHTML=state.form.map(function(v,i){return '<span style="--h:'+v+'%" data-value="'+v+'" title="Match '+(i+1)+': '+v+' form index"></span>';}).join('');
    document.getElementById('form-chart').setAttribute('aria-label','Five-match form: '+state.form.join(', '));
    document.getElementById('season-stats').innerHTML=state.stats.map(function(x){return '<div><strong>'+esc(formatStat(s.id,x.label,x.value))+'</strong><span>'+esc(x.label)+'</span></div>';}).join('');
    setText('career-copy',state.career.seasons+' seasons have made '+a.name+' legible without making the athlete predictable. The record says consistency; the tape says controlled strangeness.');
    document.getElementById('career-numbers').innerHTML=[['AGE',state.career.age],['SEASONS',state.career.seasons],['APPEARANCES',state.career.appearances],['HONORS',state.career.honors]].map(function(x){return '<div><strong>'+x[1]+'</strong><span>'+x[0]+'</span></div>';}).join('');
    setText('quote','“'+capitalize(a.signature)+'. That is the whole warning, and somehow it is never enough.”');setText('quote-credit','The '+t.city+' touchline notebook');
    setText('pressure-home',t.code);setText('pressure-away',r.code);setText('pressure-title',t.name+' versus '+r.name+'.');setText('pressure-text',t.rivalry+' is an old argument conducted through incompatible textures. '+a.name+' enters the next chapter carrying '+t.motif+' detail against '+r.motif+'—and the pressure to make the rivalry about the present.');
    document.getElementById('headline-list').innerHTML=state.headlines.map(function(h,i){return '<li><span>0'+(i+1)+'</span><b>'+esc(h)+'</b><small>WORLD DESK / '+esc(s.code)+'</small></li>';}).join('');
    document.getElementById('teammate-rail').innerHTML=t.athletes.filter(function(x){return x.id!==a.id;}).slice(0,8).map(function(x){return '<a class="mate" href="player.html?'+qs({sport:s.id,team:t.id,player:x.id})+'"><i class="mate-mark" aria-hidden="true"></i><span><small>#'+x.number+' / '+esc(x.role)+'</small><h3>'+esc(x.name)+'</h3><p>'+esc(x.signature)+'.</p></span></a>';}).join('');
    var focus={sport:s.id,team:t.id,player:a.id},media={sport:s.id,home:t.id,away:r.id,athlete:a.id,headline:state.headlines[0]};
    setHref('arena-link',ARENAS[s.id]);setHref('top-league','league.html?sport='+encodeURIComponent(s.id));setHref('top-wire','social.html?'+qs(focus)+'#player-'+encodeURIComponent(a.id));
    setHref('rivalry-link','league.html?sport='+encodeURIComponent(s.id));setHref('wire-link','social.html?'+qs(focus)+'#player-'+encodeURIComponent(a.id));setHref('team-link','league.html?sport='+encodeURIComponent(s.id)+'#'+encodeURIComponent(t.id));
    var destinations=[['LIVE ARENA',ARENAS[s.id]],['LEAGUE ATLAS','league.html?sport='+encodeURIComponent(s.id)],['FOCUSED WORLD WIRE','social.html?'+qs(focus)+'#player-'+encodeURIComponent(a.id)],['REPLAY CENTER','replay.html?sport='+encodeURIComponent(s.id)],['MOMENT MAKER','moment.html?'+qs(media)],['CLIP DIRECTOR','clip.html?'+qs(media)],['BROADCAST GUIDE','menu.html'],['PHYSICAL WORLD','world.html']];
    document.getElementById('destination-grid').innerHTML=destinations.map(function(d,i){return '<a class="destination" href="'+esc(d[1])+'"><span>0'+(i+1)+'</span><b>'+esc(d[0])+'</b><i>↗</i></a>';}).join('');
    setText('footer-file',state.canonical.toUpperCase());portraitVars();updateMetadata();
  }

  function capitalize(value){value=String(value||'');return value.charAt(0).toUpperCase()+value.slice(1);}
  function share(){var status=document.getElementById('share-status'),url=new URL(state.canonical,location.href).href;if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(url).then(function(){status.textContent='Permanent file link copied.';},function(){status.textContent='Copy unavailable — use the address bar.';});}else{status.textContent='Permanent file ready in the address bar.';history.replaceState(null,'',state.canonical);}}
  function fail(){document.body.innerHTML='<main style="padding:10vw;font-family:Arial"><h1>THE FILE ROOM IS OFFLINE</h1><p>The shared Cyberliga world model could not load.</p><p><a href="world.html">Return to the world map →</a></p></main>';}
  function init(){if(!resolve()){fail();return;}buildStats();render();if(state.fallback)history.replaceState(null,'',state.canonical);document.getElementById('share-button').addEventListener('click',share);}

  window.advanceTime=function(ms){state.elapsed+=Math.max(0,Number(ms)||0);return state.elapsed;};
  window.render_game_to_text=function(){var media=state.sport&&{sport:state.sport.id,home:state.team.id,away:state.rival.id,athlete:state.athlete.id,headline:state.headlines[0]};return JSON.stringify({screen:'athlete-profile',coordinateSystem:'document flow; top to bottom; portrait is decorative CSS, no gameplay coordinates',canonical:state.canonical,fallbackUsed:state.fallback,requested:state.requested,sport:state.sport&&{id:state.sport.id,name:state.sport.name,league:state.sport.league},team:state.team&&{id:state.team.id,name:state.team.name,code:state.team.code,city:state.team.city,rival:state.rival&&state.rival.name},athlete:state.athlete&&{id:state.athlete.id,name:state.athlete.name,number:state.athlete.number,role:state.athlete.role,archetype:state.athlete.archetype,temperament:state.athlete.temperament,signature:state.athlete.signature,flaw:state.athlete.flaw||null},form:{rating:state.rating,lastFive:state.form,stats:state.stats},career:state.career,headlineCount:state.headlines.length,teammateCount:state.team?Math.min(8,state.team.athletes.length-1):0,elapsedMs:state.elapsed,links:{arena:state.sport&&ARENAS[state.sport.id],league:state.sport&&'league.html?sport='+state.sport.id,wire:state.canonical&&'social.html?'+qs({sport:state.sport.id,team:state.team.id,player:state.athlete.id}),replay:state.sport&&'replay.html?sport='+state.sport.id,moment:media&&'moment.html?'+qs(media),clip:media&&'clip.html?'+qs(media),guide:'menu.html',world:'world.html'}});};
  init();
})();
