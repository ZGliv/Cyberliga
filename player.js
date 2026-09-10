import { drawArcadePortrait, paintArcadePortraits, shareArcadeLink } from './arcade-world.js';

const C = window.CYBERLIGA_CONTENT;
const B = window.CyberligaBrand;
const ARENAS = { soccer:'index.html', basketball:'hoops.html', hockey:'hockey.html', baseball:'baseball.html', combat:'fight.html', 'american-football':'football.html' };
const state = { elapsed:0, requested:{}, fallback:false, sport:null, team:null, athlete:null, rival:null, canonical:'' };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const qs = values => new URLSearchParams(values).toString();
const text = (id,value) => { const node=document.getElementById(id); if(node) node.textContent=value; };
const href = (id,value) => { const node=document.getElementById(id); if(node) node.href=value; };
const cap = value => String(value||'').replace(/^./,character=>character.toUpperCase());
const name = team => B?.displayName(team)||team.name;
const city = team => B?.displayCity(team)||team.city;
const crest = (id,team) => { const node=document.getElementById(id); if(node&&B) node.innerHTML=B.crestSvg(team); };
const profileHref = (team,athlete) => 'player.html?'+qs({sport:team.sportId,team:team.id,player:athlete.id});
function arenaHref() { return ARENAS[state.sport.id]+'?'+qs({home:state.team.id,away:state.rival.id}); }
function resolve() {
  if(!C) return false;
  const params=new URLSearchParams(location.search);
  state.requested={sport:params.get('sport'),team:params.get('team'),player:params.get('player')||params.get('athlete')};
  let sport=C.getSport(state.requested.sport);
  if(!sport){sport=C.getSport('soccer');state.fallback=true;}
  let team=C.getTeam(state.requested.team,sport.id);
  if(!team){team=sport.teams[C.hash(state.requested.team||'default')%sport.teams.length];state.fallback=true;}
  let athlete=C.getAthlete(team.id,state.requested.player);
  if(!athlete){athlete=team.athletes[C.hash(state.requested.player||'default')%team.athletes.length];state.fallback=true;}
  state.sport=sport;state.team=team;state.athlete=athlete;
  state.rival=C.getTeam(team.rivalryId,sport.id)||sport.teams.find(item=>item.id!==team.id);
  state.canonical=profileHref(team,athlete);
  return true;
}
function render() {
  const {athlete:a,team:t,sport:s,rival:r}=state;
  const brand=B?.getTeam(t.id);
  const character=window.CyberligaCharacters?.get?.(a.id);
  document.documentElement.style.setProperty('--team',t.colors.primary);
  document.documentElement.style.setProperty('--team2',t.colors.secondary);
  text('portrait-name',a.name);text('portrait-team',name(t));text('portrait-motion',s.name+' · #'+a.number);
  text('portrait-number',String(a.number).padStart(2,'0'));text('portrait-league',s.league);
  text('team-name',name(t));text('team-city',city(t)+', '+t.region);
  text('player-name',a.name);
  document.querySelector('.player-hero').dataset.longName=String(a.name.length>12);
  text('player-number','#'+a.number);text('player-role',a.role);text('player-archetype',a.archetype);
  text('player-dek',character?.gift||a.name+' '+a.signature+'.');
  text('signature',character?.motionName||cap(a.signature));text('temperament',cap(a.temperament));text('flaw-label',character?.flaw||a.flaw?'Weak spot':'Club style');text('flaw',cap(character?.flaw||a.flaw||t.motion));
  text('rivalry-name','The city rivalry');text('rivalry-title',name(t)+' vs '+name(r));
  text('rivalry-venue',brand?.venue?brand.venue+' · '+city(t):city(t));
  text('teammates-club',name(t));text('club-breadcrumb',name(t));
  crest('portrait-crest',t);crest('team-crest',t);crest('rivalry-home-crest',t);crest('rivalry-away-crest',r);
  const club='league.html?'+qs({sport:s.id,team:t.id});
  for(const id of ['club-link','club-breadcrumb','team-link']) href(id,club);
  href('top-league','league.html?sport='+encodeURIComponent(s.id));href('arena-link',arenaHref());
  href('rivalry-link','league.html?'+qs({sport:s.id,team:r.id}));
  const mates=t.athletes.filter(item=>item.id!==a.id).slice(0,4);
  document.getElementById('teammate-rail').innerHTML=mates.map(item=>`<a class="mate" href="${esc(profileHref(t,item))}"><span class="mate-image"><span class="mate-number" aria-hidden="true">${item.number}</span><canvas class="mate-portrait" data-arcade-athlete="${esc(item.id)}" data-team-id="${esc(t.id)}" data-sport="${esc(s.id)}" aria-hidden="true"></canvas></span><span class="mate-copy"><small>#${item.number} · ${esc(item.role)}</small><h3>${esc(item.name)}</h3><p>${esc(cap(item.signature))}</p></span></a>`).join('');
  const canvas=document.getElementById('athlete-portrait');drawArcadePortrait(canvas,{team:t,athlete:a,sportId:s.id});
  canvas.setAttribute('aria-label',a.name+' in the '+name(t)+' broadcast kit');
  document.getElementById('portrait').dataset.visual='authored-pixel-canvas';
  paintArcadePortraits(document.getElementById('teammate-rail'));
  const title=a.name+' / '+name(t)+' / Cyberliga';const description='#'+a.number+' '+a.role+'. '+cap(a.signature)+'. Meet '+a.name+' of '+name(t)+'.';
  document.title=title;document.querySelector('meta[name="description"]').content=description;
  for(const key of ['og:title','twitter:title']) document.querySelector(`meta[property="${key}"],meta[name="${key}"]`).content=title;
  for(const key of ['og:description','twitter:description']) document.querySelector(`meta[property="${key}"],meta[name="${key}"]`).content=description;
  const canonical='https://cyberliga-ten.vercel.app/'+state.canonical;
  document.querySelector('link[rel="canonical"]').href=canonical;document.querySelector('meta[property="og:url"]').content=canonical;
}
function visualPayload() { return {mode:'authored-pixel-canvas',rendererVersion:'1.0.0',athleteId:state.athlete?.id,sportId:state.sport?.id,teamId:state.team?.id,identityKey:'arcade/'+state.athlete?.id,surface:'athlete-file',viewOnly:true}; }
window.advanceTime=ms=>{state.elapsed+=Math.max(0,Number(ms)||0);return state.elapsed;};
window.render_game_to_text=()=>JSON.stringify({screen:'athlete-profile',coordinateSystem:'document flow; top to bottom; authored pixel portrait coordinates have origin top-left; portraits are decorative and view-only',canonical:state.canonical,fallbackUsed:state.fallback,requested:state.requested,sport:state.sport&&{id:state.sport.id,name:state.sport.name,league:state.sport.league},team:state.team&&{id:state.team.id,name:state.team.name,code:state.team.code,city:state.team.city,rival:state.rival?.name},athlete:state.athlete&&{id:state.athlete.id,name:state.athlete.name,number:state.athlete.number,role:state.athlete.role,archetype:state.athlete.archetype,temperament:state.athlete.temperament,signature:state.athlete.signature,flaw:state.athlete.flaw||null},visual:visualPayload(),statisticsSource:'not-displayed',teammateCount:state.team?Math.min(4,state.team.athletes.length-1):0,elapsedMs:state.elapsed,links:{arena:state.sport&&arenaHref(),league:state.sport&&'league.html?'+qs({sport:state.sport.id,team:state.team.id}),world:'world.html'}});
if(resolve()) {
  render();if(state.fallback)history.replaceState(null,'',state.canonical);
  document.getElementById('share-button').addEventListener('click',event=>shareArcadeLink(event.currentTarget,{title:state.athlete.name+' / Cyberliga',text:'Meet '+state.athlete.name+' of '+name(state.team)+'.',url:new URL(state.canonical,location.href).href}));
} else {
  document.getElementById('athlete-main').innerHTML='<section class="player-unavailable"><h1>The roster is unavailable.</h1><p>This athlete could not load. Return to the world and try another club.</p><a class="cl-button" href="world.html">Back to Home</a></section>';
}
