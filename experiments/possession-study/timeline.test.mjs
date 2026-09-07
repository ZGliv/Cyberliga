import test from 'node:test';
import assert from 'node:assert/strict';
import { DURATION, ROSTER, EVENTS, DRIBBLE_CONTACTS, sampleStudy } from './timeline.js';
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
function finite(value,path='$'){
  if(typeof value==='number')assert.ok(Number.isFinite(value),path);
  else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))finite(v,`${path}.${k}`);
}

test('sampling is stateless, repeatable and independent of playback frame rate',()=>{
  const times=[0,.45,3.5,5.85,10.8,11.5,12.4,12.68,12.72,13.08,19.9];
  const baseline=times.map(t=>sampleStudy(t));
  for(let frame=0;frame<144*DURATION;frame++)sampleStudy(frame/144);
  times.slice().reverse().forEach(t=>sampleStudy(t));
  times.forEach((t,i)=>assert.deepEqual(sampleStudy(t),baseline[i]));
  assert.deepEqual(sampleStudy(2),sampleStudy(22));
  assert.throws(()=>sampleStudy(Infinity),TypeError);
});

test('all six continuous paths, velocities, jumps and targets stay finite and on court',()=>{
  let previous=sampleStudy(0),minimumSeparation=Infinity;
  for(let i=1;i<20000;i++){
    const state=sampleStudy(i/1000);
    finite(state);
    assert.ok(state.ball.position[1]>=.122999,'ball never tunnels beneath hardwood');
    assert.ok(distance(previous.ball.position,state.ball.position)<.03,'ball position is continuous');
    for(const p of state.players){
      const old=previous.players[p.id];
      assert.ok(Math.abs(p.position[0])<7.5&&Math.abs(p.position[2])<7);
      assert.ok(distance(p.position,old.position)<.009,'no locomotion teleport');
      assert.ok(Math.hypot(p.vx-old.vx,p.vz-old.vz)<.12,'planar velocity remains continuous');
      assert.ok(Math.abs(p.facing-old.facing)<.012,'no angle flips');
      assert.ok(Math.abs(p.jump-old.jump)<.006,'jump is continuous');
      for(let j=p.id+1;j<6;j++)minimumSeparation=Math.min(minimumSeparation,distance(p.position,state.players[j].position));
      for(const key of['handL','handR']){
        assert.ok(p[key+'Weight']>=0&&p[key+'Weight']<=1);
        if(p[key]&&old[key]&&p[key+'Weight']>.99&&old[key+'Weight']>.99)assert.ok(distance(p[key],old[key])<.04,'active palm target cannot jump');
      }
    }
    previous=state;
  }
  assert.ok(minimumSeparation>.62,`athlete separation ${minimumSeparation}`);
});

test('Brunt plants the screen before rolling and takes off before the catch',()=>{
  const planted=sampleStudy(EVENTS.screenSet).players[1];
  for(let t=EVENTS.screenSet;t<EVENTS.screenRelease;t+=.025){
    const p=sampleStudy(t).players[1];
    assert.deepEqual(p.position,planted.position);
    assert.equal(p.speed,0);
    assert.equal(p.pose,'screen');
  }
  assert.equal(sampleStudy(EVENTS.takeoff).players[1].jump,0);
  assert.ok(sampleStudy(EVENTS.catch).players[1].jump>1.15);
  assert.equal(sampleStudy(EVENTS.land).players[1].jump,0);
  assert.ok(sampleStudy(EVENTS.land+.08).players[1].crouch>.20,'landing absorbs weight');
});

test('dribbles touch the floor at the published times and hands contact the actual ball',()=>{
  for(const t of DRIBBLE_CONTACTS){
    const s=sampleStudy(t);
    assert.ok(Math.abs(s.ball.position[1]-.123)<1e-9);
    assert.equal(s.ball.contact,null);
    assert.ok(sampleStudy(t-.001).ball.position[1]>.123);
    assert.ok(sampleStudy(t+.001).ball.position[1]>.123);
  }
  let contacts=0;
  for(let i=0;i<13000;i++){
    const s=sampleStudy(i/1000),contact=s.ball.contact;
    if(!contact)continue;
    contacts++;
    const p=s.players[contact.playerId];
    for(const key of contact.hand==='both'?['handL','handR']:[contact.hand==='left'?'handL':'handR']){
      assert.ok(p[key+'Weight']>.98,'contact grip has full influence');
      const d=distance(p[key],s.ball.position);
      assert.ok(d>.105&&d<.14,`${contact.kind} palm/ball distance ${d}`);
    }
  }
  assert.ok(contacts>1000);
});

test('lob, catch, downward hoop crossing and scoring describe the same ball',()=>{
  const release=sampleStudy(EVENTS.lob),catchState=sampleStudy(EVENTS.catch);
  assert.equal(release.ball.mode,'lob');assert.equal(release.ball.owner,null);
  assert.deepEqual(catchState.ball.position,[0,3.42,-5.75]);
  assert.equal(catchState.ball.owner,1);
  const before=sampleStudy(EVENTS.score-.001),cross=sampleStudy(EVENTS.score),after=sampleStudy(EVENTS.score+.001);
  assert.ok(before.ball.position[1]>3.05&&after.ball.position[1]<3.05);
  assert.ok(Math.hypot(cross.ball.position[0],cross.ball.position[2]+5.8)<.01);
  assert.deepEqual(before.score,[22,23]);assert.deepEqual(cross.score,[24,23]);
  assert.deepEqual(after.score,[24,23]);assert.ok(cross.clock>0);
  assert.ok(cross.net>0);
});

test('all active palm targets fit the contracted anatomical shoulder reach',()=>{
  for(let i=0;i<4000;i++){
    const s=sampleStudy(i/200);
    for(const p of s.players){
      const h=ROSTER[p.id].height/2;
      for(const side of[-1,1]){
        const key=side<0?'handL':'handR',target=p[key];
        if(!target||p[key+'Weight']<.01)continue;
        const shoulder=[p.position[0]+Math.cos(p.facing)*side*.30*h,
          1.52*h+p.jump-p.crouch,p.position[2]-Math.sin(p.facing)*side*.30*h];
        assert.ok(distance(shoulder,target)<=.70*h,`${ROSTER[p.id].name} ${key} at ${s.time} exceeds reach`);
      }
    }
  }
});

test('the loop reset is hidden by a complete final fade',()=>{
  assert.equal(sampleStudy(19.99).fade,1);
  assert.equal(sampleStudy(20).fade,1);
  assert.equal(sampleStudy(.30).fade,0);
  assert.equal(sampleStudy(18.99).fade,0);
});
