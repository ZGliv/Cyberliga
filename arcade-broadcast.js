/** A view over the six existing engines. No game decisions, RNG or simulation clock live here. */
export const ARCADE_SPORTS = Object.freeze([
  {id:'soccer',name:'Soccer',short:'SOCCER',arena:'index.html',subtitle:'The beautiful game. A different universe.'},
  {id:'american-football',name:'Football',short:'FOOTBALL',arena:'football.html',subtitle:'Every down is a new story.'},
  {id:'basketball',name:'Basketball',short:'HOOPS',arena:'hoops.html',subtitle:'Big personalities. Bigger plays.'},
  {id:'hockey',name:'Hockey',short:'HOCKEY',arena:'hockey.html',subtitle:'Cold ice. Very little mercy.'},
  {id:'baseball',name:'Baseball',short:'BASEBALL',arena:'baseball.html',subtitle:'Nine innings. A world of characters.'},
  {id:'combat',name:'Combat',short:'COMBAT',arena:'fight.html',subtitle:'Two corners. Everything to prove.'}
]);
const SIDE=['#00e5ff','#ff45d6'];
const INK='#101b2b', WHITE='#f4f5e9';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const hash=s=>Array.from(String(s)).reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function color(value,fallback){return typeof value==='string'&&/^#[\da-f]{3,8}$/i.test(value)?value:fallback;}
function clockText(clock){if(typeof clock==='string')return clock;const t=Math.max(0,Math.floor(finite(clock)));return `${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;}
const spriteCache=new Map();

/** Compatibility constructors still run, but never submit an unused 3D image. */
export function prepareArcadeRenderer(renderer){
  renderer.render=(scene,camera)=>{scene?.updateMatrixWorld?.();camera?.updateMatrixWorld?.();};
  const setSize=renderer.setSize.bind(renderer);
  renderer.setSize=(...args)=>{const result=setSize(...args);renderer.domElement.width=1;renderer.domElement.height=1;return result;};
  return renderer;
}

/** Authored pixel silhouette. Pose changes follow locomotion/action, never a random wobble. */
export function athleteSprite(entity={},sport='basketball',pose=0){
  const team=entity.team===1?1:0,variant=hash(entity.id??entity.name??entity.number)%4;
  const action=String(entity.action??'').toLowerCase();
  const strike=/punch|strike|jab|hook|cross|uppercut|kick/.test(action);
  const lifted=/dunk|shoot|jump|catch|block|rebound|throw/.test(action);
  const down=/knockdown|fallen|down|fall/.test(action);
  const actionPhase=Math.round(clamp(finite(entity.progress),0,1)*5),clubAccent=color(entity.colors?.accent,WHITE);
  const key=[team,variant,sport,pose,lifted,strike,down,actionPhase,entity.number??0,clubAccent,!!entity.portrait].join(':');
  if(spriteCache.has(key))return spriteCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=42;
  const c=canvas.getContext('2d');const r=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
  const side=SIDE[team],shade=team?'#aa258b':'#078da9',skin=['#ffce9d','#c48c66','#e6ac83','#96634f'][variant];
  const step=pose%8,leg=pose?Math.round(Math.sin(step*Math.PI/4)*3):0;
  // Cleats, socks, shorts: grounded feet and a clean alternating stride.
  r(9,30,6,8,INK);r(18,30,6,8,INK);
  r(10,31+Math.max(0,leg),4,5,side);r(19,31+Math.max(0,-leg),4,5,side);
  r(7,37+Math.min(0,leg),9,3,INK);r(18,37+Math.min(0,-leg),9,3,INK);
  r(8,37+Math.min(0,leg),7,2,WHITE);r(19,37+Math.min(0,-leg),7,2,WHITE);
  r(8,19,17,13,INK);r(9,20,15,10,side);r(10,29,6,4,INK);r(18,29,6,4,INK);
  r(10,20,2,9,shade);r(12,21,9,2,clubAccent);r(21,23,2,6,shade);
  // Wide head, stepped corners and distinct hair/ear silhouettes make a compact cast.
  r(9,5,15,2,INK);r(7,7,19,11,INK);r(9,18,15,2,INK);
  r(9,8,15,9,skin);r(10,17,13,2,skin);
  if(variant===0){r(9,4,4,5,INK);r(14,3,5,6,INK);r(20,5,4,4,INK);}
  if(variant===1){r(7,6,5,8,shade);r(22,6,4,8,shade);r(10,5,13,4,side);}
  if(variant===2){r(7,2,4,8,side);r(23,2,4,8,side);r(9,8,15,3,shade);}
  if(variant===3){r(9,4,15,5,WHITE);r(7,7,5,4,WHITE);r(22,7,4,4,WHITE);}
  r(11,12,4,3,INK);r(19,12,4,3,INK);r(12,12,1,1,WHITE);r(20,12,1,1,WHITE);r(16,16,3,1,INK);
  if(sport==='american-football'||sport==='hockey'){r(8,6,17,5,side);r(7,9,3,7,side);r(23,9,3,7,side);r(9,15,16,2,INK);r(10,15,14,1,WHITE);}
  if(sport==='baseball'){r(8,6,18,5,side);r(20,10,8,2,INK);r(21,10,6,1,side);}
  const arm=lifted?-9:strike?-4:Math.round(-leg*.5);
  if(sport!=='combat'){
    r(4,21+arm,5,8,INK);r(5,22+arm,4,5,side);r(5,27+arm,4,4,skin);
    r(25,21-arm*.2,4,9,INK);r(25,22-arm*.2,3,5,side);r(25,28-arm*.2,3,3,skin);
    if(lifted){r(7,12,4,6,INK);r(8,12,3,4,skin);r(22,12,4,6,INK);r(22,12,3,4,skin);}
  }
  if(sport==='combat'){r(10,22,14,7,skin);r(10,29,14,4,side);if(entity.portrait){r(3,20,7,9,INK);r(4,20,6,5,side);r(24,20,7,9,INK);r(25,20,5,5,side);}}
  if(sport==='hockey'){r(29,26,2,12,'#b79669');r(25,38,6,2,WHITE);}
  // Bats and gloves are projected separately from actual engine contact transforms.
  // Tiny real jersey numerals, not a fake random identity.
  c.fillStyle=INK;c.font='bold 6px monospace';c.textAlign='center';c.fillText(String(entity.number??'').slice(-2),17,29);
  if(down){const lay=document.createElement('canvas');lay.width=42;lay.height=42;const d=lay.getContext('2d');d.translate(40,7);d.rotate(Math.PI/2);d.drawImage(canvas,0,0,32,34);if(spriteCache.size>1500)spriteCache.clear();spriteCache.set(key,lay);return lay;}
  if(spriteCache.size>1500)spriteCache.clear();spriteCache.set(key,canvas);return canvas;
}

export function createArenaPainter(canvas,sportId){
  const ctx=canvas.getContext('2d',{alpha:false}),tracking=new Map();
  const camera={x:0,z:0,zoom:null,ready:false};
  let previousTime=null,lastFrame=null,paintCount=0,previousPaint=performance.now(),lastViewport='';
  function paint(frame){
    lastFrame=frame;paintCount++;
    const box=canvas.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height),dpr=Math.min(window.devicePixelRatio||1,2);
    const viewportKey=`${w}/${h}`;if(viewportKey!==lastViewport){camera.zoom=null;camera.ready=false;lastViewport=viewportKey;}
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
    const t=finite(frame.time),now=performance.now();
    const dt=previousTime===null?0:clamp(t-previousTime||((frame.presentation?.replay)?(now-previousPaint)/1000:0),0,.1);previousTime=t;previousPaint=now;
    const bounds=frame.bounds||{},hx=finite(bounds.halfX,15),hz=finite(bounds.halfZ,9);
    const venueTeam=frame.teams?.find(team=>window.CyberligaBrand?.getTeam(team.id)?.venue===frame.venue?.name)||frame.teams?.[0];
    const primary=color(venueTeam?.colors?.primary,'#65758d'),accent=color(venueTeam?.colors?.accent,'#d8fd63');
    const portrait=h>w*1.15,rotated=portrait&&sportId!=='combat'&&sportId!=='baseball',shortLandscape=h<280&&w>h*2;
    const baseballClose=sportId==='baseball'&&/WINDUP|PITCH|READY|SETUP|PREPITCH|IDLE/.test(String(frame.phase));
    const baseSpan={soccer:82,'american-football':79,basketball:34,hockey:61,baseball:100,combat:13}[sportId];
    const availableW=w*(portrait?.91:.91),availableH=h*(sportId==='combat'?.72:.8);
    let scale=Math.min(availableW/(rotated?Math.min(hz*2+4,baseSpan*.68):baseSpan),availableH/((rotated?Math.min(hx*2+4,baseSpan)*.86:(hz*2+4)*.69)));
    // On phones follow the active zone instead of shrinking an entire field to a stamp.
    if(rotated){const zoneWidth={soccer:30,'american-football':33,basketball:19,hockey:26}[sportId];scale=availableW/zoneWidth;}
    if(shortLandscape&&sportId!=='baseball'&&sportId!=='combat')scale=Math.min(availableW/baseSpan,(h-18)/(hz+2.25));
    if(sportId==='baseball'){
      const close=baseballClose;
      const span=portrait?(close?26:42):(close?42:51),targetScale=Math.min(w*.88/span,h*.86/(close?18:30));
      camera.zoom??=targetScale;camera.zoom+=(targetScale-camera.zoom)*(1-Math.exp(-dt*2));scale=camera.zoom;
    }
    scale=Math.max(.2,scale);
    const depth=rotated?.86:sportId==='baseball'?.8:shortLandscape?.5:.69;
    const follow=frame.projectile||{x:0,z:0};
    const viewX=(rotated?h*.67/depth:w*.82)/(2*scale),viewZ=(rotated?w*.88:h*.67/depth)/(2*scale);
    let tx=clamp(finite(follow.x)*.72,-Math.max(0,hx-viewX+3),Math.max(0,hx-viewX+3));
    let tz=clamp(finite(follow.z)*.4,-Math.max(0,hz-viewZ+3),Math.max(0,hz-viewZ+3));
    if(sportId==='baseball'){const radius=finite(frame.presentation?.wallRadius,hz);tx=clamp(finite(follow.x)*.5+5,baseballClose?7:radius*.46,radius*.53);tz=finite(follow.z)*.35;}
    if(sportId==='combat'){tx=0;tz=0;}
    if(!camera.ready){camera.x=tx;camera.z=tz;camera.ready=true;}
    const ease=1-Math.exp(-dt*2.8);camera.x+=(tx-camera.x)*ease;camera.z+=(tz-camera.z)*ease;
    const originY=shortLandscape&&sportId!=='baseball'?(h+Math.min(scale*2.25,72))*.5:h*(sportId==='baseball'?.5:.54);
    function p(x,z,y=0){let a=x-camera.x,b=z-camera.z;if(rotated||sportId==='baseball')[a,b]=[b,-a];const shear=rotated||sportId==='baseball'?0:.22;return {x:w/2+(a+b*shear)*scale,y:originY+b*scale*depth-y*scale*.8};}
    function polygon(points,fill,stroke,width=1){ctx.beginPath();points.forEach(([x,z,y],i)=>{const q=p(x,z,y||0);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
    function line(points,stroke=WHITE,width=1.2){ctx.beginPath();points.forEach(([x,z,y],i)=>{const q=p(x,z,y||0);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
    function rect(x,z,x2,z2,fill,stroke,width){polygon([[x,z],[x2,z],[x2,z2],[x,z2]],fill,stroke,width);}
    function circle(x,z,r,stroke,fill,width=1.2){const pts=[];for(let i=0;i<=64;i++){let a=i*Math.PI/32;pts.push([x+Math.cos(a)*r,z+Math.sin(a)*r]);}polygon(pts,fill,stroke,width);}
    function label(text,x,z,size=10,col=WHITE,angle=0){
      const q=p(x,z);ctx.save();ctx.font=`900 ${size}px Arial`;
      const half=ctx.measureText(String(text)).width*.5,ca=Math.cos(angle),sa=Math.sin(angle);
      const corners=[[-half,-size],[half,-size],[half,0],[-half,0]].map(([a,b])=>({x:q.x+a*ca-b*sa,y:q.y+a*sa+b*ca}));
      // Material lettering never clips into the score/venue overlays as the camera follows play.
      if(corners.some(v=>v.x<8||v.x>w-8||v.y<38||v.y>h-12)){ctx.restore();return;}
      ctx.translate(q.x,q.y);ctx.rotate(angle);ctx.fillStyle=col;ctx.textAlign='center';ctx.fillText(String(text),0,0);ctx.restore();
    }
    ctx.fillStyle='#101e31';ctx.fillRect(0,0,w,h);
    // Fine arena grid and drawn grandstands stay deterministic and off the field of play.
    ctx.strokeStyle='#b9d1e506';ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    const pad=sportId==='combat'?1.4:3.3;
    if(sportId!=='baseball'){
      rect(-hx-pad,-hz-pad,hx+pad,hz+pad,'#263b52');
      rect(-hx-pad,-hz-pad,hx+pad,hz+pad,null,'#52667b',1);
      // Home-club colors belong to the room; athlete side colors stay constant.
      ctx.save();ctx.globalAlpha=.55;
      rect(-hx-pad,-hz-pad,hx+pad,-hz-pad+.28,primary);
      rect(-hx-pad,hz+pad-.28,hx+pad,hz+pad,primary);
      for(const side of [-1,1])line([[side*(hx+pad-.5),-hz*.75],[side*(hx+pad-.5),hz*.75]],accent,2);
      ctx.restore();
    }
    const seats=Math.min(54,Math.round(hx*2.6));
    if(sportId!=='baseball')for(let side=-1;side<=1;side+=2)for(let row=0;row<3;row++)for(let i=0;i<seats;i++){
      const q=p(-hx+(i+.5)*2*hx/seats,side*(hz+pad+1.4+row*1.4));
      const n=hash(`${side}/${row}/${i}`),sw=Math.max(2,Math.min(5,scale*.42));
      ctx.fillStyle=[primary,'#977e8d','#3c7286',accent,'#516577'][n%5];ctx.fillRect(q.x-sw*.5,q.y-3,sw,3);ctx.fillStyle=['#c89573','#e9c5a1','#997959'][n%3];ctx.fillRect(q.x-sw*.25,q.y-5,sw*.5,2);
    }
    const court=sportId==='basketball',ice=sportId==='hockey',combat=sportId==='combat',baseball=sportId==='baseball';
    const surface=court?'#d59b64':ice?'#d8e8e5':combat?'#587686':baseball?'#488363':'#477b5c';
    // The low platform edge gives depth without constantly rotating the camera.
    if(!baseball){polygon([[-hx-pad,hz+pad],[hx+pad,hz+pad],[hx+pad,hz+pad,-1],[-hx-pad,hz+pad,-1]],'#08111f');rect(-hx,-hz,hx,hz,surface);}
    const lc=ice?'#789ea9':'#f5edd6b0';
    if(!combat&&!baseball){
      for(let i=0;i<12;i++)if(i%2===0)rect(-hx+i*hx/6,-hz,-hx+(i+1)*hx/6,hz,court?'#e4ac761c':ice?'#ffffff12':'#78b97715');
      rect(-hx,-hz,hx,hz,null,lc,1.5);line([[0,-hz],[0,hz]],lc,1.3);
    }
    if(court){
      // Quiet wood joints give the floor material without competing with the play.
      ctx.save();ctx.globalAlpha=.12;
      for(let x=-hx+1;x<hx;x+=1)line([[x,-hz],[x,hz]],'#fff1cb',.6);
      for(let z=-hz+2;z<hz;z+=2)for(let x=-hx+(Math.round(z)%2?2:0);x<hx;x+=4)line([[x,z],[Math.min(x+2,hx),z]],'#6f422b',.5);
      ctx.restore();
      circle(0,0,1.8,lc,null,1.5);circle(0,0,.6,null,'#c08453');
      for(const s of [-1,1]){
        rect(s*hx,-2.5,s*(hx-5.8),2.5,'#bd784d',lc,1.4);circle(s*(hx-5.8),0,1.8,lc);
        const pts=[];for(let i=0;i<=40;i++){let a=-Math.PI/2+i*Math.PI/40;pts.push([s*(hx-1.2-Math.cos(a)*6.5),Math.sin(a)*6.5]);}line(pts,lc,1.5);
      }
      label('CYBERLIGA',0,0,Math.min(24,scale*.85),'#9a5e38',rotated?-Math.PI/2:0);
      if(!shortLandscape){label(venueTeam?.code||'HOME',-hx-1.15,0,clamp(scale*.6,7,11),'#e0e4d9',rotated?0:Math.PI/2);label(venueTeam?.code||'HOME',hx+1.4,0,clamp(scale*.6,7,11),'#e0e4d9',rotated?0:-Math.PI/2);}
    }else if(ice){
      const blue=frame.presentation?.equipment?.blueLineX??8,goalLine=frame.presentation?.equipment?.goalX??24;
      line([[0,-hz],[0,hz]],'#c56a83',2);for(const s of [-1,1]){line([[s*blue,-hz],[s*blue,hz]],'#5b93bc',2.8);line([[s*goalLine,-hz],[s*goalLine,hz]],'#c56a83',1.2);for(const z of [-hz*.52,hz*.52]){circle(s*hx*.63,z,3.2,'#c56a83');circle(s*hx*.63,z,.25,null,'#c56a83');}}circle(0,0,4.2,'#5b93bc');circle(0,0,.3,null,'#5b93bc');label('CYBERLIGA',0,1,Math.min(22,scale*1.1),'#8fb4bd',rotated?-Math.PI/2:0);
    }else if(sportId==='soccer'){
      circle(0,0,6,lc);circle(0,0,.25,null,WHITE);for(const s of [-1,1]){rect(s*hx,-9,s*(hx-12),9,null,lc);rect(s*hx,-4.5,s*(hx-4.5),4.5,null,lc);circle(s*(hx-8),0,.25,null,WHITE);}
    }else if(sportId==='american-football'){
      const yard=frame.presentation?.yardToMetre||.9144,end=hx-yard*10;
      for(let x=-end;x<=end+.01;x+=yard*10){line([[x,-hz],[x,hz]],lc,1.1);for(const z of [-hz*.62,hz*.7])label(Math.round((end-Math.abs(x))/yard),x,z,Math.min(14,scale*1.2),'#eff1d9');}
      for(let x=-hx+2;x<hx-2;x+=2){for(const z of [-hz*.19,hz*.19])line([[x,z-.25],[x,z+.25]],lc,1);}
      rect(-hx,-hz,-end,hz,'#00e5ff25');rect(end,-hz,hx,hz,'#ff45d625');
      for(const side of [-1,1])label(frame.teams?.[side<0?0:1]?.code||'CYBERLIGA',side*(hx-yard*5),0,clamp(scale*1.6,9,21),'#f5edd694',rotated?0:Math.PI/2);
      const los=frame.presentation?.lineOfScrimmage??frame.presentation?.scrimmageX;
      if(Number.isFinite(los))line([[los,-hz],[los,hz]],'#75bfff',2);
    }else if(baseball){
      const b=frame.presentation||{},home=b.homePlate||{x:0,z:0},bases=b.basePositions||[],radius=b.wallRadius||hz;
      const fan=[[0,0]];for(let i=0;i<=64;i++){const a=-Math.PI/4+i*Math.PI/128;fan.push([Math.cos(a)*radius,Math.sin(a)*radius]);}polygon(fan,'#498266','#d8e2bf',2);
      for(let ring=0;ring<3;ring++){const fence=[];for(let i=0;i<=64;i++){const a=-Math.PI/4+i*Math.PI/128;fence.push([Math.cos(a)*(radius+ring*1.6),Math.sin(a)*(radius+ring*1.6),1.6]);}line(fence,ring?'#496079':'#d8fd63',ring?4:2);}
      label(venueTeam?.code||'CYBERLIGA',radius+1.2,0,clamp(scale*1.25,9,17),accent);
      const arr=Array.isArray(bases)?bases:Object.values(bases);const coords=arr.map(v=>[v.x??v[0]??0,v.z??v[1]??0]);
      if(coords.length>=4){polygon(coords,'#bb9668','#ead9b3',1.7);polygon(coords.map(([x,z])=>[x*.76,z*.76]),'#4b8363');coords.forEach(([x,z])=>rect(x-.5,z-.5,x+.5,z+.5,WHITE));}
      circle(home.x,home.z,2.5,null,'#bb9668');const mound=b.mound||{x:hz*.2,z:0};circle(mound.x,mound.z,1.8,null,'#bb9668');line([[home.x,home.z],[radius*.707,-radius*.707]],lc);line([[home.x,home.z],[radius*.707,radius*.707]],lc);label('CYBERLIGA',radius*.68,0,Math.min(25,scale*3),'#bdd3a64a');
    }else if(combat){
      const points=[];for(let i=0;i<8;i++){let a=Math.PI/8+i*Math.PI/4;points.push([Math.cos(a)*hx,Math.sin(a)*hz]);}polygon(points,'#799398','#f5f0d980',2);circle(0,0,2.3,'#526e78',null,1.6);label('CYBERLIGA',0,0,Math.min(40,scale*.63),'#415f6d');label('FIGHT CLUB',0,.7,Math.min(12,scale*.2),'#d7e6da');
      for(let i=0;i<points.length;i++){const [x,z]=points[i],b=points[(i+1)%8];if(z<0||b[1]<0){for(let y=.5;y<=1.6;y+=.45)line([[x,z,y],[b[0],b[1],y]],'#b6d2ce85',1.2);}line([[x,z],[x,z,1.9]],i%2?'#00e5ff':'#ff45d6',3);}
    }
    // Equipment behind athletes, projected from regulation locations in engine units.
    function goal(s){const eq=frame.presentation?.equipment||{},gx=s*(eq.goalX??(ice?24:hx)),wide=eq.goalHalfWidth??(ice?2.1:4.5),height=eq.goalHeight??(ice?1.25:3.2),deep=eq.goalDepth??(ice?1.1:2.4);polygon([[gx,-wide],[gx+s*deep,-wide],[gx+s*deep,wide],[gx,wide]],ice?'#749eac44':'#d7edf222');polygon([[gx+s*deep,-wide],[gx+s*deep,-wide,height],[gx+s*deep,wide,height],[gx+s*deep,wide]],ice?'#7394a133':'#d7edf220',ice?'#688996':'#d7edf299',1);for(let i=0;i<7;i++){const z=-wide+i*wide/3;line([[gx,z],[gx+s*deep,z],[gx+s*deep,z,height],[gx,z,height]],ice?'#7697a480':'#d7edf26a',.8);}line([[gx,-wide],[gx,-wide,height],[gx,wide,height],[gx,wide]],ice?'#c84160':WHITE,2.4);}
    if(sportId==='soccer'||ice){goal(-1);goal(1);}
    function hoop(s){const eq=frame.presentation?.equipment||{},x=s*(eq.boardX??12.95),rim=s*(eq.rimX??12.35),ry=eq.rimY??3.05,r=eq.rimRadius??.45;line([[s*(eq.poleX??15.3),0],[s*(eq.poleX??15.3),0,eq.poleHeight??3.9],[x,0,3.45]],'#192a40',4);polygon([[x,-.9,2.925],[x,.9,2.925],[x,.9,3.975],[x,-.9,3.975]],'#ecf2eb9a','#f9fff3',1.4);const q=p(rim,0,ry);ctx.beginPath();ctx.ellipse(q.x,q.y,scale*r,scale*r*depth,rotated?Math.PI/2:0,0,Math.PI*2);ctx.strokeStyle='#f3573e';ctx.lineWidth=2.5;ctx.stroke();line([[rim,-r,ry],[rim,-r*.55,ry-.5],[rim,r*.55,ry-.5],[rim,r,ry]],'#fff9df',1);}
    if(court){hoop(-1);hoop(1);}
    const entities=(frame.entities||[]).filter(e=>e.visible!==false&&Number.isFinite(e.x)&&Number.isFinite(e.z));
    const sorted=entities.map(e=>({e,q:p(e.x,e.z,0)})).sort((a,b)=>a.q.y-b.q.y);
    for(const {e,q} of sorted){
      const speed=Math.hypot(finite(e.vx),finite(e.vz)),id=e.id??e.name,prev=tracking.get(id)||{stride:0,face:1,turn:0};
      prev.stride+=speed*dt*.68;
      const lateral=rotated||baseball?finite(e.vz):finite(e.vx),desired=Math.sign(lateral);
      if(Math.abs(lateral)>Math.max(.55,speed*.3)&&desired!==prev.face){prev.turn+=dt;if(prev.turn>.14){prev.face=desired;prev.turn=0;}}else prev.turn=0;
      tracking.set(id,prev);
      const runPose=speed>.35?1+Math.floor(prev.stride*8)%8:0;
      const sprite=athleteSprite({...e,colors:frame.teams?.[e.team]?.colors},sportId,runPose);
      const physical=clamp(finite(e.y),0,15),lift=physical*scale*.8;
      const size=clamp(scale*(combat?2.2:2.25),portrait?22:20,combat?132:72)*(e.action==='crouch'?.74:1),sw=size*sprite.width/sprite.height;
      ctx.fillStyle='#07182744';ctx.beginPath();ctx.ellipse(q.x,q.y+1,sw*.35,size*.075,0,0,Math.PI*2);ctx.fill();
      if(e.hasBall){ctx.strokeStyle='#f2ffb7a0';ctx.lineWidth=1.25;ctx.beginPath();ctx.ellipse(q.x,q.y+1,sw*.47,size*.11,0,0,Math.PI*2);ctx.stroke();}
      ctx.save();ctx.translate(q.x,q.y-lift);ctx.scale(prev.face,1);ctx.drawImage(sprite,-sw/2,-size,sw,size);ctx.restore();
      if(e.hasBall||combat){ctx.font=`700 ${clamp(size*.18,8,11)}px monospace`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#102135';ctx.strokeText(String(e.name||'').split(' ').slice(-1)[0].toUpperCase(),q.x,q.y-size-lift-5);ctx.fillStyle=WHITE;ctx.fillText(String(e.name||'').split(' ').slice(-1)[0].toUpperCase(),q.x,q.y-size-lift-5);}
      if(e.hasBall&&frame.projectile&&sportId!=='soccer'){
        const ball=frame.projectile,bp=p(ball.x,ball.z,ice?0:Math.max(ball.y,court?1.05:0));
        if(Math.hypot(bp.x-q.x,bp.y-(q.y-size*.45))<size*1.5){ctx.strokeStyle=ice?'#cbae82':SIDE[e.team===1?1:0];ctx.lineWidth=ice?2:Math.max(3,size*.075);ctx.beginPath();ctx.moveTo(q.x+prev.face*size*.21,q.y-size*.44-lift);ctx.lineTo(bp.x,bp.y);ctx.stroke();if(!ice){ctx.fillStyle='#e7b58c';ctx.fillRect(bp.x-2,bp.y-2,4,4);}}
      }
      // Actual strike progress supplies a readable extension; no independent hit decision.
      if(combat&&e.arms){
        for(const arm of Object.values(e.arms)){
          const points=[arm.shoulder,arm.elbow,arm.glove].map(v=>p(v.x,v.z,v.y));ctx.strokeStyle='#101b2b';ctx.lineWidth=size*.105;ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();ctx.strokeStyle='#e1ad83';ctx.lineWidth=size*.065;ctx.stroke();const gp=points[2];ctx.fillStyle=SIDE[e.team===1?1:0];ctx.fillRect(gp.x-size*.055,gp.y-size*.06,size*.11,size*.12);
        }
      }else if(combat&&e.gloves){
        for(const [side,glove] of Object.entries(e.gloves)){
          const gp=p(glove.x,glove.z,glove.y);ctx.strokeStyle=SIDE[e.team===1?1:0];ctx.lineWidth=size*.09;ctx.beginPath();ctx.moveTo(q.x+(side==='left'?-1:1)*size*.17,q.y-size*.51);ctx.lineTo(gp.x,gp.y);ctx.stroke();ctx.fillStyle=SIDE[e.team===1?1:0];ctx.fillRect(gp.x-size*.055,gp.y-size*.06,size*.11,size*.12);
        }
      }else if(combat&&/jab|punch|cross|hook|strike|uppercut|kick/.test(String(e.action).toLowerCase())){
        const opponent=entities.find(other=>other.team!==e.team),v=opponent?p(opponent.x,opponent.z):{x:q.x+40,y:q.y};
        const phase=clamp(finite(e.progress),0,1),ext=Math.sin(phase*Math.PI),dx=v.x-q.x,dy=v.y-q.y,len=Math.hypot(dx,dy)||1;
        const reach=Math.min(len*.68,size*.72)*ext;ctx.strokeStyle=SIDE[e.team===1?1:0];ctx.lineWidth=size*.13;ctx.beginPath();ctx.moveTo(q.x,q.y-size*.55);ctx.lineTo(q.x+dx/len*reach,q.y-size*.55+dy/len*reach);ctx.stroke();ctx.fillStyle=SIDE[e.team===1?1:0];ctx.fillRect(q.x+dx/len*reach-size*.075,q.y-size*.55+dy/len*reach-size*.08,size*.15,size*.16);
      }
    }
    const bat=baseball&&frame.presentation?.bat;
    if(bat?.handle&&bat?.barrel){const a=p(bat.handle.x,bat.handle.z,bat.handle.y),b=p(bat.barrel.x,bat.barrel.z,bat.barrel.y);ctx.strokeStyle='#182637';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='#efd29c';ctx.lineWidth=3;ctx.stroke();}
    const ball=frame.projectile;
    if(ball&&ball.visible!==false&&Number.isFinite(ball.x)&&Number.isFinite(ball.z)){
      const q=p(ball.x,ball.z,Math.max(0,finite(ball.y))),ground=p(ball.x,ball.z),radius=ice?clamp(scale*.19,2.5,5):baseball?clamp(scale*.15,2.7,4.5):clamp(scale*.25,3.6,8.5);
      ctx.fillStyle='#06122240';ctx.beginPath();ctx.ellipse(ground.x,ground.y,radius*1.3,radius*.55,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(q.x,q.y,radius*(sportId==='american-football'?1.4:1),radius*(ice?.6:1),-.4,0,Math.PI*2);ctx.fillStyle=court?'#ff823c':ice?'#102032':sportId==='american-football'?'#b76c40':WHITE;ctx.fill();ctx.strokeStyle=ice?'#f8fff4':'#132034';ctx.lineWidth=1.4;ctx.stroke();
      if(court){ctx.strokeStyle='#77390e';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(q.x-radius,q.y);ctx.lineTo(q.x+radius,q.y);ctx.moveTo(q.x,q.y-radius);ctx.lineTo(q.x,q.y+radius);ctx.stroke();}
      else if(sportId==='soccer'){ctx.fillStyle='#182735';ctx.fillRect(q.x-1.5,q.y-1.5,3,3);}
      if(finite(ball.y)>.8){ctx.strokeStyle='#f0fcb94d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x,q.y,radius+3,0,Math.PI*2);ctx.stroke();}
    }
    if(combat){for(let i=0;i<2;i++){const e=entities.find(v=>v.team===i);if(!e)continue;const x=i?w-28-w*.25:28;ctx.fillStyle='#0d1c30';ctx.fillRect(x,48,w*.25,4);ctx.fillStyle=SIDE[i];ctx.fillRect(x,48,w*.25*clamp(finite(e.hp??e.health,100)/(e.maxHp||100),0,1),4);}}
    return {width:w,height:h,scale,camera:{...camera},entities:entities.length,paintCount,projected:sorted.map(({e,q})=>({id:e.id,x:q.x,y:q.y})),finite:entities.every(e=>Number.isFinite(e.x+e.z))};
  }
  return {paint,get frame(){return lastFrame;}};
}

export function installArcadeBroadcast({sportId,renderer,readFrame}){
  if(window.__arcadeView)return window.__arcadeView;
  const sport=ARCADE_SPORTS.find(s=>s.id===sportId)||ARCADE_SPORTS[0];
  const styleUrl=new URL('./arcade-broadcast.css',import.meta.url).href;
  if(!Array.from(document.querySelectorAll('link[rel=stylesheet]')).some(link=>link.href===styleUrl)){const link=document.createElement('link');link.rel='stylesheet';link.href=styleUrl;document.head.append(link);}
  const league=window.CyberligaBrand?.getLeague(sportId);
  const lineups={soccer:'On the pitch','american-football':'On the field',basketball:'On the court',hockey:'On the ice',baseball:'In the ballpark',combat:'In the ring'};
  const channel=String(ARCADE_SPORTS.indexOf(sport)+1).padStart(2,'0');
  document.documentElement.classList.add('arcade-mode');
  const root=document.createElement('div');root.id='arcade-root';root.dataset.sport=sportId;
  root.innerHTML=`
    <header class="ab-header">
      <a class="ab-brand cl-brand" href="world.html" aria-label="Cyberliga Home"><i class="ab-brand-mark cl-brand-mark" aria-hidden="true"></i><span class="cl-brand-name">CYBERLIGA</span></a>
      <nav class="ab-sport-strip watch-only-exit" aria-label="Sports broadcasts">${ARCADE_SPORTS.map(s=>`<a href="${s.arena}" ${s.id===sportId?'aria-current="page"':''}>${s.short}</a>`).join('')}</nav>
      <nav class="ab-nav cl-primary-nav" aria-label="Primary navigation"><a href="world.html">Home</a><a href="league.html?sport=${sportId}">Leagues</a></nav>
    </header>
    <main class="ab-layout">
      <section class="ab-broadcast" aria-label="${sport.name} autonomous broadcast">
        <div class="ab-scoreboard" aria-label="Current score">
          <a class="ab-team" data-team-link="0" href="league.html?sport=${sportId}"><span class="ab-team-crest" data-team-crest="0" aria-hidden="true"></span><span class="ab-team-copy"><span class="ab-team-city" data-team-city="0"></span><span class="ab-team-name" data-team-name="0"></span><span class="ab-side-label"><i class="ab-side"></i>Cyan</span></span><b class="ab-score" data-score="0">0</b></a>
          <div class="ab-clock"><span class="ab-score-label">${sportId==='combat'?'LANDED':sportId==='baseball'?'COUNT':'GAME CLOCK'}</span><strong id="ab-clock">—</strong><small id="ab-period">${sport.short}</small></div>
          <a class="ab-team away" data-team-link="1" href="league.html?sport=${sportId}"><span class="ab-team-crest" data-team-crest="1" aria-hidden="true"></span><span class="ab-team-copy"><span class="ab-team-city" data-team-city="1"></span><span class="ab-team-name" data-team-name="1"></span><span class="ab-side-label"><i class="ab-side"></i>Pink</span></span><b class="ab-score" data-score="1">0</b></a>
        </div>
        <div class="ab-stage">
          <canvas id="arcade-canvas" aria-label="Live pixel ${sport.name.toLowerCase()} match"></canvas>
          <div class="ab-channel"><span class="ab-on-air"><i aria-hidden="true"></i>ON AIR</span><span>${sport.name}</span></div>
          <div class="ab-venue" id="ab-venue"></div>
          <div class="ab-playline"><span class="ab-play-mark" aria-hidden="true"></span><div><strong id="ab-event">${sport.name}</strong><small id="ab-detail">${sport.subtitle}</small></div></div>
          <div class="ab-watermark" aria-hidden="true"><i class="cl-brand-mark"></i><span>${channel}</span></div>
        </div>
      </section>
      <aside class="ab-rail watch-only-exit" aria-label="Match context">
        <div class="ab-rail-heading"><p class="ab-kicker">${esc(league?.code||sport.short)} / ${sport.name}</p><h1>${esc(league?.short||sport.name)}</h1><a href="league.html?sport=${sportId}" class="ab-league-link">League HQ <span aria-hidden="true">↗</span></a></div>
        <section class="ab-spotlight" aria-label="Player spotlight">
          <div class="ab-section-title">Player spotlight <span id="ab-spotlight-side"></span></div>
          <a id="ab-spotlight-link" class="ab-spotlight-card" href="league.html?sport=${sportId}">
            <div class="ab-spotlight-art"><span id="ab-spotlight-number" aria-hidden="true"></span><canvas id="ab-spotlight-portrait" width="32" height="42" aria-label="Featured athlete"></canvas></div>
            <div class="ab-spotlight-copy"><span id="ab-spotlight-role"></span><strong id="ab-spotlight-name"></strong><small id="ab-spotlight-club"></small></div>
          </a>
          <p class="ab-signature"><span>Signature</span><strong id="ab-spotlight-signature"></strong></p>
        </section>
        <section class="ab-cast-section" aria-label="Athletes in this match"><div class="ab-section-title">${lineups[sportId]} <span id="ab-roster-count"></span></div><div id="ab-cast"></div></section>
        <div class="ab-venue-card"><span>Home ground</span><strong id="ab-home-venue"></strong><p id="ab-home-statement"></p><a id="ab-clubs" href="league.html?sport=${sportId}">Meet the home club <span aria-hidden="true">↗</span></a></div>
      </aside>
    </main>`;
  // Navigation exits the view-only game; it is explicitly exempt from its input guard.
  root.querySelectorAll('a').forEach(anchor=>anchor.classList.add('watch-only-exit'));
  document.body.append(root);
  const canvas=root.querySelector('#arcade-canvas'),painter=createArenaPainter(canvas,sportId);
  const get=id=>root.querySelector('#ab-'+id);
  const nodes={clock:get('clock'),period:get('period'),event:get('event'),detail:get('detail'),venue:get('venue'),homeVenue:get('home-venue'),homeStatement:get('home-statement'),clubs:get('clubs'),cast:get('cast'),rosterCount:get('roster-count'),spotlightLink:get('spotlight-link'),spotlightPortrait:get('spotlight-portrait'),spotlightNumber:get('spotlight-number'),spotlightRole:get('spotlight-role'),spotlightName:get('spotlight-name'),spotlightClub:get('spotlight-club'),spotlightSignature:get('spotlight-signature'),spotlightSide:get('spotlight-side')};
  const teamNodes=[0,1].map(i=>({link:root.querySelector(`[data-team-link="${i}"]`),crest:root.querySelector(`[data-team-crest="${i}"]`),name:root.querySelector(`[data-team-name="${i}"]`),city:root.querySelector(`[data-team-city="${i}"]`),score:root.querySelector(`[data-score="${i}"]`)}));
  const set=(el,text)=>{text=String(text??'');if(el.textContent!==text)el.textContent=text;};
  const clubHref=team=>`league.html?sport=${encodeURIComponent(sportId)}&team=${encodeURIComponent(team.id)}`;
  const canonicalAthlete=(entity,teams)=>{const team=teams?.[entity.team];return team&&window.CYBERLIGA_CONTENT?.getAthlete(team.id,entity.id);};
  const athleteHref=(entity,teams)=>{const team=teams?.[entity.team],athlete=canonicalAthlete(entity,teams);return athlete?`player.html?sport=${encodeURIComponent(sportId)}&team=${encodeURIComponent(team.id)}&player=${encodeURIComponent(athlete.id)}`:team?clubHref(team):`league.html?sport=${sportId}`;};
  let rosterKey='',lastDrawKey='',venueKey='',teamsKey='',spotlightKey='',spotlightAt=-Infinity;
  const api={sportId,drawCount:0,renderer:'authored-pixel-canvas',autonomous:true,interaction:'view-only',metrics:null,draw};
  window.__arcadeFrame=readFrame;window.__arcadeView=api;
  function draw(){
    const frame=readFrame();if(!frame)return;
    // A resize can restore the legacy backing store even when simulation time
    // has not changed. Clean it before the duplicate-frame guard.
    if(renderer.domElement.width!==1||renderer.domElement.height!==1){renderer.domElement.width=1;renderer.domElement.height=1;}
    const drawKey=`${frame.time}|${frame.phase}|${canvas.clientWidth}|${canvas.clientHeight}|${window.devicePixelRatio}|${frame.presentation?.replay?(frame.entities||[]).map(e=>[e.x,e.y,e.z,e.progress].join(',')).join(';'):''}`;
    if(drawKey===lastDrawKey)return;lastDrawKey=drawKey;
    // Legacy WebGL backing stores no longer present pixels; leave their engine
    // objects mounted but keep capture clients and GPU allocation on the new stage.
    api.drawCount++;api.metrics=painter.paint(frame);
    if(document.documentElement.dataset.arcadeReady!=='true')document.documentElement.dataset.arcadeReady='true';
    (frame.teams||[]).slice(0,2).forEach((team,i)=>{let name=team.name||team.code||'';if(team.city&&name.toLowerCase().startsWith(team.city.toLowerCase()+' '))name=name.slice(team.city.length+1);set(teamNodes[i].name,name);set(teamNodes[i].city,team.city||team.code);set(teamNodes[i].score,team.score??0);const unit=sportId==='combat'?'punches landed':sportId==='baseball'?'runs':sportId==='soccer'||sportId==='hockey'?'goals':'points';const label=`${team.name}, ${team.score??0} ${unit}. Open club`;if(teamNodes[i].link.getAttribute('aria-label')!==label)teamNodes[i].link.setAttribute('aria-label',label);});
    const nextTeamsKey=(frame.teams||[]).map(t=>t.id).join('|');
    if(nextTeamsKey!==teamsKey){teamsKey=nextTeamsKey;(frame.teams||[]).slice(0,2).forEach((team,i)=>{teamNodes[i].link.href=clubHref(team);teamNodes[i].name.dataset.long=String(teamNodes[i].name.textContent.length>11);teamNodes[i].crest.innerHTML=window.CyberligaBrand?.crestSvg(team)?.replaceAll('cg-','ab-score-')||`<span>${esc(team.code)}</span>`;});}
    const periodName=sportId==='combat'?'ROUND ':sportId==='baseball'?(frame.presentation?.battingTeam===0?'TOP ':'BOT '):sportId==='hockey'?'PERIOD ':sportId==='soccer'?'HALF ':'Q';
    set(nodes.clock,sportId==='baseball'?`${frame.presentation?.balls||0}–${frame.presentation?.strikes||0}`:clockText(frame.clock));
    const downRead=sportId==='american-football'&&Number.isFinite(frame.presentation?.down)&&Number.isFinite(frame.presentation?.toGo)?` · ${frame.presentation.down} & ${Math.ceil(frame.presentation.toGo)}`:'';
    set(nodes.period,periodName+(frame.period||1)+(sportId==='baseball'?` · ${frame.presentation?.outs||0} OUT`:downRead));
    set(nodes.venue,[frame.venue?.name,frame.venue?.city].filter(Boolean).join(' / '));
    const phaseName={SET:'Finding the opening',BRINGUP:'Pushing up court',DRIVE:'Attacking the rim',WINDUP:sportId==='baseball'?'Into the windup':'Shot on the way',MADE:'Buckets.',INBOUND:'Back in play',PASS:'Moving the ball',PLAY:'In play',FACEOFF:'At the faceoff',WALKON:'Entering the arena',OPEN_PLAY:'In play'};
    set(nodes.event,frame.event?.title||phaseName[String(frame.phase).toUpperCase()]||String(frame.phase||sport.name).replaceAll('_',' '));
    const playContext=sportId==='basketball'&&frame.presentation?.shotClock!=null?`${Math.ceil(frame.presentation.shotClock)} on the shot clock${frame.presentation.playCall?' · '+frame.presentation.playCall:''}`:frame.venue?.name||sport.subtitle;
    set(nodes.detail,frame.event?.detail||playContext);
    const home=frame.teams?.find(team=>window.CyberligaBrand?.getTeam(team.id)?.venue===frame.venue?.name)||frame.teams?.[0];
    const brand=home&&window.CyberligaBrand?.getTeam(home.id);
    const nextVenueKey=[home?.id,frame.venue?.name].join('|');
    if(nextVenueKey!==venueKey){venueKey=nextVenueKey;set(nodes.homeVenue,frame.venue?.name||home?.city||'CYBERLIGA');set(nodes.homeStatement,brand?.statement||frame.venue?.city||sport.subtitle);root.style.setProperty('--ab-club-accent',color(home?.colors?.accent,'#4264ff'));if(home)nodes.clubs.href=clubHref(home);}
    const entities=(frame.entities||[]).filter(e=>e.visible!==false);set(nodes.rosterCount,`${entities.length} athletes`);
    // Engine depth stand-ins remain on the field but are not canonical athlete files.
    const profileEntities=entities.filter(e=>canonicalAthlete(e,frame.teams));
    // The rail follows genuine engine participants, but a spotlight holds long
    // enough to read. It never claims the featured athlete still owns the ball.
    const candidate=profileEntities.find(e=>e.hasBall||e.id===frame.projectile?.ownerId)||profileEntities.find(e=>/shoot|dunk|punch|strike|bat|pitch|celebrate/.test(String(e.action)))||profileEntities.find(e=>e.id===spotlightKey)||profileEntities[0];
    if(candidate&&(candidate.id!==spotlightKey&&(finite(frame.time)-spotlightAt>2.4||!entities.some(e=>e.id===spotlightKey))||!spotlightKey)){
      spotlightKey=candidate.id;spotlightAt=finite(frame.time);
      const team=frame.teams?.[candidate.team],profile=candidate.profile||{},canonical=window.CYBERLIGA_CONTENT?.getAthlete(team?.id,candidate.id),character=window.CyberligaCharacters?.get(candidate.id);
      nodes.spotlightLink.href=athleteHref(candidate,frame.teams);nodes.spotlightLink.dataset.side=candidate.team===1?'1':'0';
      set(nodes.spotlightNumber,candidate.number!=null?String(candidate.number).padStart(2,'0'):'');set(nodes.spotlightRole,candidate.role||canonical?.role||'Athlete');set(nodes.spotlightName,candidate.name||canonical?.name||'Athlete');set(nodes.spotlightClub,team?.name||team?.code||'');set(nodes.spotlightSide,team?.code||'');set(nodes.spotlightSignature,character?.motionName||canonical?.signature||profile.signature||candidate.role||'Athlete');
      const portrait=nodes.spotlightPortrait.getContext('2d');portrait.clearRect(0,0,32,42);portrait.drawImage(athleteSprite({...candidate,action:'',progress:0,portrait:true,colors:team?.colors},sportId),0,0);
    }
    // Two stable, named participants from each side lead to their canonical files.
    const selected=[...profileEntities.filter(e=>e.team===0).slice(0,2),...profileEntities.filter(e=>e.team===1).slice(0,2)];
    const key=selected.map(e=>e.id).join('|');
    if(key!==rosterKey){rosterKey=key;nodes.cast.innerHTML=selected.map((e,i)=>`<a class="ab-player watch-only-exit" data-side="${e.team===1?1:0}" href="${athleteHref(e,frame.teams)}"><canvas width="32" height="42" data-portrait="${i}" aria-hidden="true"></canvas><span><b>${esc(e.name||'Athlete')}</b><small>${esc(e.role||'Athlete')}<span>${esc(frame.teams?.[e.team]?.code||'')}</span></small></span><span class="ab-player-number">${esc(e.number!=null?'#'+e.number:'')}</span></a>`).join('');selected.forEach((e,i)=>nodes.cast.querySelector(`[data-portrait="${i}"]`).getContext('2d').drawImage(athleteSprite({...e,action:'',progress:0,portrait:true,colors:frame.teams?.[e.team]?.colors},sportId),0,0));}
  }
  // No second requestAnimationFrame: the original engine remains the only time owner.
  renderer.render=draw;
  new ResizeObserver(()=>{if(api.drawCount)draw();}).observe(root.querySelector('.ab-stage'));
  draw();
  return api;
}
