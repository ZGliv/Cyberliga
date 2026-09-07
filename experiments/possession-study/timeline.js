// Choreographed motion study, not an autonomous game or an official result.
// World units are metres, +y up, +z toward midcourt. Sampling owns no mutable state.
export const DURATION = 20;
export const EVENTS = Object.freeze({ screenSet: 3.5, screenRelease: 5.7, crossover: 5.85,
  drive: 6.5, help: 9.9, pickup: 10.8, lob: 11.5, load: 11.65, takeoff: 11.96,
  catch: 12.4, dunkRelease: 12.68, score: 12.72, land: 13.08, reactionEnd: 16.8, fade: 19 });
export const DRIBBLE_CONTACTS = Object.freeze(Array.from({ length: 12 }, (_, i) => .45 + i * .9));
export const ROSTER = Object.freeze([
  { id: 0, name: 'HART', number: 7, team: 0, height: 1.90, skin: 0x8e553b, hair: 0x211b19, style: 'close-crop', role: 'handler' },
  { id: 1, name: 'BRUNT', number: 44, team: 0, height: 2.15, skin: 0x51372c, hair: 0x171516, style: 'power', role: 'roller' },
  { id: 2, name: 'ZIP', number: 11, team: 0, height: 1.82, skin: 0xb77d53, hair: 0x302118, style: 'curls', role: 'spacer' },
  { id: 3, name: 'REED', number: 4, team: 1, height: 1.94, skin: 0x694735, hair: 0x17171a, style: 'fade', role: 'on-ball' },
  { id: 4, name: 'TOLL', number: 33, team: 1, height: 2.08, skin: 0xaa7858, hair: 0x292020, style: 'strong', role: 'help' },
  { id: 5, name: 'SABLE', number: 21, team: 1, height: 1.88, skin: 0x815140, hair: 0x211919, style: 'braids', role: 'corner' },
]);
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const envelope = (t, a, b, c, d) => smooth(a, b, t) * (1 - smooth(c, d, t));
function hermite(a, b, va, vb, u, duration) {
  if(a===b&&va===0&&vb===0)return a;
  const u2 = u * u, u3 = u2 * u;
  return (2*u3-3*u2+1)*a + (u3-2*u2+u)*duration*va + (-2*u3+3*u2)*b + (u3-u2)*duration*vb;
}
function derivative(a, b, va, vb, u, duration) {
  if(a===b&&va===0&&vb===0)return 0;
  return ((6*u*u-6*u)*a + (3*u*u-4*u+1)*duration*va + (-6*u*u+6*u)*b + (3*u*u-2*u)*duration*vb) / duration;
}
// [time, x, z, vx, vz]; tangents are metres/second. Deliberate stops have zero tangents.
const PATHS = [
  [[0,-3.6,2.5,0,0],[1.8,-3.45,2.05,.12,-.25],[3.5,-3.05,1.25,.18,-.38],
   [5.2,-2.95,1.1,0,0],[5.7,-2.8,1.33,.7,.15],[6.5,-1.35,1.20,1.6,-.45],
   [8,-.15,-.60,1.1,-1.05],[9.9,1.45,-2.1,.25,-.18],[10.6,1.62,-2.2,0,0],
   [12.1,1.62,-2.2,0,0],[13.7,1.7,-2.4,0,0],[15.2,1.25,-2.25,-.5,.25],
   [17,0.15,-1.5,-.3,.7],[19,-.2,.1,0,0],[20,-.2,.1,0,0]],
  [[0,1.8,-.55,0,0],[1.7,.45,.1,-1.1,.25],[3.25,-2.15,.55,-.45,0],[3.5,-2.3,.55,0,0],
   [5.7,-2.3,.55,0,0],[6.6,-2.10,-.25,.5,-1.2],[8,-1.25,-2.20,.5,-1.5],
   [10.1,-.58,-3.78,.25,-.65],[11.5,-.16,-4.87,.12,-.65],[11.96,-.07,-5.18,.12,-.6],
   [12.4,0,-5.42,0,-.3],[12.72,0,-5.47,0,0],[13.08,.04,-5.38,.15,.45],
   [13.7,.15,-5.06,.1,.3],[14.6,.2,-4.93,0,0],[16,.08,-4.5,-.2,.5],
   [18,-.6,-2.45,-.2,1.05],[19.2,-.8,-1.45,0,0],[20,-.8,-1.45,0,0]],
  [[0,4.7,-4.15,0,0],[3,5.45,-5.22,.2,-.2],[5.5,5.55,-5.32,0,0],
   [8.8,5.55,-5.32,0,0],[10.5,5.78,-4.82,.12,.3],[12.5,5.85,-4.75,0,0],
   [14,5.3,-4.2,-.6,.7],[16,3.2,-2.8,-.7,.4],[18.7,2.35,-1.55,0,0],[20,2.35,-1.55,0,0]],
  [[0,-3.0,1.04,0,0],[3.5,-2.95,.14,.1,-.2],[4.7,-2.97,.0,0,0],
   [5.7,-3.04,.28,-.08,.25],[6.25,-3.12,.56,0,0],[6.9,-3.08,-.13,.1,-1.2],
   [8.6,-1.55,-1.17,1.1,-.4],[10.9,.12,-2.07,.4,-.3],[12.2,.36,-2.55,0,0],
   [13.7,.35,-2.62,0,0],[15.5,.8,-3.15,.4,-.4],[18,2.3,-3.8,0,0],[20,2.3,-3.8,0,0]],
  [[0,.4,-3.55,0,0],[5.7,-.05,-3.3,0,0],[7.4,-.35,-3.15,.08,.15],
   [9.9,.70,-3.10,.8,.20],[10.8,1.12,-3.05,0,0],[11.45,1.30,-3.0,0,0],
   [12.2,.91,-3.85,-.35,-1.5],[12.8,.79,-4.45,0,-.65],[13.3,.78,-4.65,0,0],
   [14.6,.9,-4.65,0,0],[16.5,1.8,-4.7,.3,0],[19,2.2,-4.7,0,0],[20,2.2,-4.7,0,0]],
  [[0,3.83,-3.65,0,0],[4.5,4.3,-4.42,.1,-.1],[8.4,4.36,-4.53,0,0],
   [10,3.46,-4.32,-.7,.2],[10.8,3.18,-4.25,0,0],[11.7,3.58,-4.51,.7,-.3],
   [12.5,4.12,-4.8,.4,-.1],[13.9,4.20,-4.85,0,0],[16,3.38,-4.30,-.4,.35],
   [18.8,2.65,-2.45,0,0],[20,2.65,-2.45,0,0]],
];
const FACING = [
  [[0,3.00],[3.5,3.05],[5.25,2.82],[6.6,2.12],[8.3,2.5],[10.5,3.52],[11.65,3.55],[13.5,3.65],[15.3,3.7],[17.4,5.75],[20,6.1]],
  [[0,-1.05],[3.3,-1.65],[5.7,-1.65],[6.9,-2.85],[9.9,-3.05],[11.7,-3.14],[13.2,-3.14],[14.5,-4.20],[16,-4.7],[18.5,-6.3],[20,-6.3]],
  [[0,-1.4],[5,-1.60],[10,-1.78],[12.7,-1.95],[14.2,-2.35],[16.4,-3.9],[19,-5.8],[20,-5.8]],
  [[0,-.25],[3.5,-.15],[5.4,.5],[6.5,1.35],[8.5,1.90],[10.8,2.3],[12.5,2.95],[14.7,3.05],[18,1.7],[20,1.7]],
  [[0,-.60],[7,-.45],[9.4,.40],[10.8,.60],[11.6,.5],[12.6,-2.6],[13.3,-3.3],[16,-4.4],[20,-4.2]],
  [[0,1.1],[6,1.2],[9.7,1.8],[11.1,2.45],[12.4,1.55],[14,2.2],[17,3.2],[20,3.0]],
];
function pathAt(id, t) {
  const keys = PATHS[id];
  let i = keys.findIndex((key, n) => n < keys.length-1 && t < keys[n+1][0]);
  if (i < 0) i = keys.length-2;
  const a = keys[i], b = keys[i+1], duration = b[0]-a[0], u = clamp((t-a[0])/duration);
  return { x: hermite(a[1],b[1],a[3],b[3],u,duration), z: hermite(a[2],b[2],a[4],b[4],u,duration),
    vx: derivative(a[1],b[1],a[3],b[3],u,duration), vz: derivative(a[2],b[2],a[4],b[4],u,duration) };
}
function scalarAt(keys, t) {
  let i = keys.findIndex((k,n) => n < keys.length-1 && t < keys[n+1][0]);
  if (i < 0) i = keys.length-2;
  const a = keys[i], b = keys[i+1], duration = b[0]-a[0], u = clamp((t-a[0])/duration);
  return hermite(a[1],b[1],a[2]||0,b[2]||0,u,duration);
}
const JUMP = [[0,0,0],[11.96,0,0],[12.035,.30,4.0],[12.36,1.2,.55],
  [12.46,1.23,0],[12.72,.97,-1.9],[13.02,.08,-2.1],[13.08,0,0],[20,0,0]];
function basicPlayer(id, t) {
  const p = pathAt(id,t), facing = scalarAt(FACING[id],t);
  let jump = id === 1 ? Math.max(0,scalarAt(JUMP,t)) : 0;
  if (id === 4) jump = .19 * envelope(t,12.0,12.25,12.38,12.66);
  const load = id === 1 ? .25 * envelope(t,11.52,11.82,11.89,12.00) : 0;
  const land = id === 1 ? .27 * envelope(t,13.02,13.16,13.28,13.66) : 0;
  const guard = id >= 3 ? .065 : .015;
  return { id, position:[p.x,0,p.z], facing, vx:p.vx, vz:p.vz, speed:Math.hypot(p.vx,p.vz),
    jump, crouch:Math.max(load,land,guard), lean:clamp(Math.hypot(p.vx,p.vz)*.055,0,.14), pose:'move',
    handL:null, handR:null, handLWeight:0, handRWeight:0,
    screenWeight:id===1?envelope(t,3.05,3.50,5.45,5.95):0,
    celebrateWeight:id<3?envelope(t,id===2?13.05:id===1?13.60:13.80,id===2?13.60:id===1?14.15:14.30,16.25,17.10):0 };
}
function point(p, side, height, forward) {
  return [p.position[0]+Math.cos(p.facing)*side+Math.sin(p.facing)*forward,
    height+p.jump-p.crouch,
    p.position[2]-Math.sin(p.facing)*side+Math.cos(p.facing)*forward];
}
function dribbleTop(t) {
  const p = basicPlayer(0,t), side = t < 5.85 ? .44 : -.44;
  return point(p,side, .123 + .5*9.81*.45*.45 + p.crouch, .27);
}
function topVelocity(t) {
  const a = dribbleTop(Math.max(0,t-.001)), b = dribbleTop(Math.min(10.8,t+.001));
  const span = Math.min(10.8,t+.001)-Math.max(0,t-.001);
  return a.map((x,i)=>(b[i]-x)/span);
}
function dribbleAt(t) {
  const cycle = Math.min(11,Math.floor(t/.9)), start = cycle*.9, u = clamp((t-start)/.9);
  const a = dribbleTop(start), b = dribbleTop(start+.9), av = topVelocity(start), bv = topVelocity(start+.9);
  const drop = Math.min(u,1-u)*.9;
  return [hermite(a[0],b[0],av[0],bv[0],u,.9), a[1]-.5*9.81*drop*drop,
    hermite(a[2],b[2],av[2],bv[2],u,.9)];
}
const CATCH_POINT = [0,3.42,-5.75];
function releasePoint() { return point(basicPlayer(0,EVENTS.lob),0,1.895,.40); }
function lobVelocity() {
  const a = releasePoint(), duration = EVENTS.catch-EVENTS.lob;
  return [(CATCH_POINT[0]-a[0])/duration,(CATCH_POINT[1]-a[1]+.5*9.81*duration*duration)/duration,(CATCH_POINT[2]-a[2])/duration];
}
function ballAt(t) {
  if (t < EVENTS.pickup) return { position:dribbleAt(t), mode:'dribble',owner:0 };
  if (t < EVENTS.lob) {
    const a=dribbleTop(EVENTS.pickup), b=releasePoint(), av=topVelocity(EVENTS.pickup), bv=lobVelocity();
    const duration=EVENTS.lob-EVENTS.pickup,u=(t-EVENTS.pickup)/duration;
    return {position:a.map((v,i)=>hermite(v,b[i],av[i],bv[i],u,duration)),mode:'gather',owner:0};
  }
  if (t < EVENTS.catch) {
    const a=releasePoint(),v=lobVelocity(),u=t-EVENTS.lob;
    return {position:[a[0]+v[0]*u,a[1]+v[1]*u-.5*9.81*u*u,a[2]+v[2]*u],mode:'lob',owner:null};
  }
  if (t < EVENTS.score) {
    const a=CATCH_POINT, end=[0,3.05,-5.8],duration=EVENTS.score-EVENTS.catch,u=(t-EVENTS.catch)/duration;
    const v=lobVelocity();v[1]-=9.81*(EVENTS.catch-EVENTS.lob);
    return {position:a.map((x,i)=>hermite(x,end[i],v[i],[0,-5,0][i],u,duration)),
      mode:t<EVENTS.dunkRelease?'dunk':'dunk-flight',owner:t<EVENTS.dunkRelease?1:null};
  }
  const elapsed=t-EVENTS.score, drop=3.05-.123;
  const fall=(-5+Math.sqrt(25+2*9.81*drop))/9.81;
  if(elapsed<fall)return{position:[.32*smooth(0,fall,elapsed),3.05-5*elapsed-.5*9.81*elapsed*elapsed,mix(-5.8,-5.28,smooth(0,fall,elapsed))],mode:'drop',owner:null};
  const bounceT=elapsed-fall;
  let y=.123;
  if(bounceT<.60)y+=3.0*bounceT-.5*10*bounceT*bounceT;
  else if(bounceT<.90){const u=bounceT-.60;y+=1.5*u-.5*10*u*u;}
  const roll=smooth(0,3.2,bounceT);
  return{position:[mix(.32,1.62,roll),Math.max(.123,y),mix(-5.28,-2.75,roll)],mode:bounceT<.90?'bounce':'settled',owner:null};
}
function palmsAroundBall(player, ball, weight, side='both') {
  const cy=Math.cos(player.facing),sy=Math.sin(player.facing);
  if(side!=='right') { player.handL=[ball[0]-.095*cy,ball[1]-.065,ball[2]+.095*sy];player.handLWeight=weight; }
  if(side!=='left') { player.handR=[ball[0]+.095*cy,ball[1]-.065,ball[2]-.095*sy];player.handRWeight=weight; }
}
function stageAt(t) {
  if(t<3.5)return['setup','MAKE HIM MOVE','Hart changes the dribble rhythm while Brunt approaches.'];
  if(t<5.7)return['screen','THE SCREEN IS SET','Brunt plants. Reed must decide which way around.'];
  if(t<6.5)return['crossover','CHANGE THE ANGLE','Hart crosses left as Reed commits around the screen.'];
  if(t<9.9)return['drive','TWO DEFENDERS, ONE CHOICE','Hart turns the corner. Brunt rolls into the opening.'];
  if(t<11.5)return['read','THE HELP COMMITS','Toll steps toward Hart. The space behind him opens.'];
  if(t<12.4)return['lob','THROW IT ABOVE THE HELP','Hart lifts the pass as Brunt leaves the floor.'];
  if(t<12.72)return['finish','CATCH. FINISH.','Brunt meets the descending ball above the rim.'];
  if(t<13.68)return['landing','PITTSBURGH TAKES THE LEAD','The ball clears the rim. Brunt absorbs the landing.'];
  if(t<16.8)return['reaction','HART SAW IT. BRUNT FINISHED IT.','One screen, one commitment, one connection.'];
  return['reset','ONE POSSESSION STUDY','A choreographed motion study. The sequence will loop.'];
}
export function sampleStudy(seconds) {
  if(!Number.isFinite(seconds))throw new TypeError('sampleStudy expects finite seconds');
  const t=seconds>=0?seconds%DURATION:((seconds%DURATION)+DURATION)%DURATION;
  const players=ROSTER.map(p=>basicPlayer(p.id,t)),ball=ballAt(t);
  const hart=players[0],brunt=players[1];
  hart.pose=t<5.7?'dribble':t<6.5?'crossover':t<10.8?'drive':t<11.5?'gather':t<12.0?'lob':t<14?'followthrough':t<16.8?'celebrate':'move';
  brunt.pose=t<3.5?'move':t<5.7?'screen':t<11.52?'roll':t<11.96?'gather':t<12.4?'jump':t<12.68?'dunk':t<13.08?'jump':t<13.68?'land':t<16.8?'celebrate':'move';
  players[2].pose=t<13?'ready':t<16.8?'celebrate':'move';
  players[3].pose=t<5.7?'guard':t<8.5?'chase':t<12.8?'guard':'recover';
  players[4].pose=t<9.9?'guard':t<11.6?'help':t<12.66?'contest':'recover';
  players[5].pose=t<9.9?'guard':t<11.5?'help':'recover';
  ball.contact=null;
  if(t<10.8) {
    const cycle=Math.round(t/.9),top=cycle*.9,near=Math.abs(t-top),weight=1-smooth(.025,.17,near);
    const side=top<5.85?'right':'left',key=side==='right'?'handR':'handL';
    // Hand presses the top of the ball at the upper turn, then releases it.
    const target=ball.position;
    hart[key]=[target[0],Math.max(.94,ball.position[1])+.115,target[2]];
    hart[key+'Weight']=weight;
    if(near<.025)ball.contact={playerId:0,hand:side,kind:'dribble'};
  } else if(t<11.5) {
    palmsAroundBall(hart,ball.position,1,'left');
    // The dribbling palm rolls around the ball into a support grip rather than
    // jumping from its top to its underside at pickup.
    const grip=smooth(10.8,11.00,t),cy=Math.cos(hart.facing),sy=Math.sin(hart.facing);
    const offset=[-.095*cy*grip,mix(.115,-.065,grip),.095*sy*grip];
    const length=Math.hypot(...offset)||1;
    hart.handL=offset.map((v,i)=>ball.position[i]+v*.115/length);
    palmsAroundBall(hart,ball.position,smooth(11.19,11.32,t),'right');
    ball.contact={playerId:0,hand:t<11.32?'left':'both',kind:'gather'};
  }
  if(t>=11.5&&t<11.82) {
    const target=releasePoint();
    palmsAroundBall(hart,target,1-smooth(11.5,11.82,t));
  }
  if(t>=11.96&&t<12.4) {
    // Raised receiving hands stay near the body until the final reachable ball approach.
    const receive=point(brunt,0,1.99,.28),w=smooth(11.96,12.16,t),blend=smooth(12.29,12.4,t);
    const target=receive.map((x,i)=>mix(x,ball.position[i],blend));
    palmsAroundBall(brunt,target,w);
  }
  if(t>=12.4&&t<12.68) {
    palmsAroundBall(brunt,ball.position,1);ball.contact={playerId:1,hand:'both',kind:'dunk'};
  } else if(t>=12.68&&t<12.97) {
    const target=point(brunt,0,1.93,.26),weight=1-smooth(12.73,12.97,t);
    const release=ballAt(12.68).position,blend=smooth(12.68,12.84,t);
    palmsAroundBall(brunt,release.map((x,i)=>mix(x,target[i],blend)),weight);
  }
  // This is the one physical downward crossing through the rim's opening.
  const scored=t>=EVENTS.score&&ball.position[1]<=3.05+1e-10;
  const [stage,title,description]=stageAt(t);
  const since=t-EVENTS.score;
  const net=since<-.025?0:smooth(-.025,.08,since)*Math.exp(-Math.max(0,since)*3.4);
  return{time:t,stage,title,description,score:scored?[24,23]:[22,23],
    clock:Math.max(0,14-Math.min(t,EVENTS.score)),players,
    ball:{...ball,rotation:[t*1.7,t*.6,t*2.1]},net,
    impact:Math.max(envelope(t,12.70,12.74,12.78,12.96),.5*envelope(t,13.03,13.10,13.13,13.30)),
    fade:Math.max(1-smooth(0,.25,t),smooth(19,19.72,t)),
    provenance:'choreographed-motion-study',events:EVENTS};
}
