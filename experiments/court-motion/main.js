import * as THREE from '../../vendor/three/three.module.js';
import { createSimulation, stepSimulation, snapshot, FIXED_STEP } from './sim.js';
import { createAthlete, updateAthlete } from './rigs.js';
import { buildCourt } from './court.js';

const canvas = document.querySelector('#court');
const stage = document.querySelector('.stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.10;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xddd8c8);
const camera = new THREE.OrthographicCamera(-8,8,12,-12,.1,100);
scene.add(new THREE.HemisphereLight(0xfff7df,0x8c9b81,1.65));
const sun = new THREE.DirectionalLight(0xffedcd,2.4);
sun.position.set(-7,17,9); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-12,right:12,top:13,bottom:-13,near:.1,far:40});
sun.shadow.normalBias=.025; sun.shadow.bias=-.0002; sun.shadow.radius=3; scene.add(sun);
const fill = new THREE.DirectionalLight(0xd8e8e5,.6); fill.position.set(8,10,-9); scene.add(fill);
const court = buildCourt(scene);
const seed = new URLSearchParams(location.search).get('seed') || '7';
const sim = createSimulation(seed);
const rigs = sim.players.map(p=>createAthlete(p,scene));
// Gait and planted-foot state advance only at the simulation rate. Rendering
// borrows interpolated transforms without changing those animation decisions.
const poseQuaternion = new Float64Array(4);
const rigPoses = rigs.map((rig,i)=>{
  updateAthlete(rig,sim.players[i],sim.ball,0,sim.time);
  const nodes=[rig.root,rig.body,rig.head,rig.tail,
    ...rig.legs.flatMap(leg=>[leg.upper,leg.lower,leg.shoe]),
    ...rig.arms.flatMap(arm=>[arm.upper,arm.lower,arm.hand,arm.shoulder])].filter(Boolean);
  const current=new Float64Array(nodes.length*10);
  capturePose(nodes,current);
  return{nodes,current,previous:current.slice(),ring:rig.ring,currentRing:rig.ring.visible,previousRing:rig.ring.visible};
});
function capturePose(nodes,target){
  for(let i=0;i<nodes.length;i++){
    const node=nodes[i],offset=i*10;
    node.position.toArray(target,offset);
    node.quaternion.toArray(target,offset+3);
    node.scale.toArray(target,offset+7);
  }
}
function restorePose(pose){
  for(let i=0;i<pose.nodes.length;i++){
    const node=pose.nodes[i],offset=i*10;
    node.position.fromArray(pose.current,offset);
    node.quaternion.fromArray(pose.current,offset+3);
    node.scale.fromArray(pose.current,offset+7);
  }
  pose.ring.visible=pose.currentRing;
}
function interpolatePose(pose,alpha){
  const a=pose.previous,b=pose.current;
  for(let i=0;i<pose.nodes.length;i++){
    const node=pose.nodes[i],o=i*10;
    node.position.set(THREE.MathUtils.lerp(a[o],b[o],alpha),THREE.MathUtils.lerp(a[o+1],b[o+1],alpha),THREE.MathUtils.lerp(a[o+2],b[o+2],alpha));
    THREE.Quaternion.slerpFlat(poseQuaternion,0,a,o+3,b,o+3,alpha);
    node.quaternion.fromArray(poseQuaternion);
    node.scale.set(THREE.MathUtils.lerp(a[o+7],b[o+7],alpha),THREE.MathUtils.lerp(a[o+8],b[o+8],alpha),THREE.MathUtils.lerp(a[o+9],b[o+9],alpha));
  }
  pose.ring.visible=alpha<.5?pose.previousRing:pose.currentRing;
}
const labels = sim.players.map(p=>{
  const label=document.createElement('div'); label.className='player-label';
  label.innerHTML=`${p.name.toUpperCase()}<span class="number">${p.number}</span>`;
  document.querySelector('#player-labels').append(label); return label;
});
const labelPositions=sim.players.map(()=>null);
const ballMaterial = new THREE.MeshStandardMaterial({color:0xf2c019,roughness:.67,metalness:0,emissive:0xb56b0c,emissiveIntensity:.08});
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),ballMaterial);
ballMesh.castShadow=true; scene.add(ballMesh);
ballMesh.add(new THREE.Mesh(new THREE.SphereGeometry(.202,20,14),new THREE.MeshBasicMaterial({color:0x453c20,side:THREE.BackSide})));
const seamMaterial = new THREE.MeshBasicMaterial({color:0x5b491c});
for(let i=0;i<3;i++){
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.19,.007,4,36),seamMaterial);
  ring.rotation.set(i===1?Math.PI/2:0,i===2?Math.PI/2:0,0); ballMesh.add(ring);
}
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.18,24),new THREE.MeshBasicMaterial({color:0x44452c,transparent:true,opacity:.3,depthWrite:false}));
ballShadow.rotation.x=-Math.PI/2; ballShadow.position.y=.022; scene.add(ballShadow);
// A short, restrained flight streak helps locate a small ball on a portrait screen.
const trailPositions=new Float32Array(12*3);
const trailGeometry=new THREE.BufferGeometry(); trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0xfff2ad,transparent:true,opacity:.45,depthWrite:false}));
trail.frustumCulled=false; scene.add(trail);
let trailPoints=[];
const $home=document.querySelector('#home-score'),$away=document.querySelector('#away-score'),$clock=document.querySelector('#clock');
const $possession=document.querySelector('#possession'),$moment=document.querySelector('#moment'),$momentType=document.querySelector('#moment-type'),$momentText=document.querySelector('#moment-text');
let width=1,height=1,orientation='portrait',manual=false,contextLost=false,lastNow=performance.now(),accumulator=0,renderFrames=0;
let previous = visualState();
let lastEvent=0,featuredEvent=sim.events[0],goalTime=-99,goalSign=0;
function visualState(){return{time:sim.time,players:sim.players.map(p=>({...p})),ball:{...sim.ball}};}
function resize(){
  const r=stage.getBoundingClientRect(); width=r.width;height=r.height;
  renderer.setSize(width,height,false);
  const aspect=width/height; orientation=aspect>1.35?'landscape':'portrait';
  if(orientation==='portrait'){
    camera.position.set(0,22,16);camera.lookAt(0,.20,0);
    const span=Math.max(17.3,13.3/aspect);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  }else{
    const compact=height<350;
    camera.position.set(compact?26:21,compact?20:25,0);camera.lookAt(0,.20,0);
    const span=Math.max(compact?9.4:11.9,20.2/aspect);
    camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  }
  camera.updateProjectionMatrix();
  render(1,0);
}
new ResizeObserver(resize).observe(stage);
function tick(){
  previous=visualState();
  // A prior draw may have left scene nodes between ticks; restore their actual
  // current pose before any rig code reads or updates a transform.
  for(const pose of rigPoses){restorePose(pose);pose.previous.set(pose.current);pose.previousRing=pose.currentRing;}
  stepSimulation(sim,FIXED_STEP);
  for(let i=0;i<rigs.length;i++){
    updateAthlete(rigs[i],sim.players[i],sim.ball,FIXED_STEP,sim.time);
    capturePose(rigPoses[i].nodes,rigPoses[i].current);
    rigPoses[i].currentRing=rigs[i].ring.visible;
  }
}
function interpolatePlayer(p,i,a){
  const old=previous.players[i];
  const angle=Math.atan2(Math.sin(p.facing-old.facing),Math.cos(p.facing-old.facing));
  return{...p,x:THREE.MathUtils.lerp(old.x,p.x,a),z:THREE.MathUtils.lerp(old.z,p.z,a),facing:old.facing+angle*a};
}
const eventNames={start:'OPENING POSSESSION',pass:'PASS',catch:'RECEIVED',shoot:'SHOT',shot:'SHOT',goal:'GOAL',interception:'INTERCEPTION',block:'BLOCK',miss:'LIVE REBOUND',recovery:'RECOVERY',turnover:'CHANGE OF POSSESSION',restart:'RESTART',violation:'TURNOVER'};
function updateHUD(){
  $home.textContent=sim.score[0];$away.textContent=sim.score[1];
  const seconds=Math.floor(sim.time);$clock.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $possession.textContent=sim.phase==='restart'?'RESETTING THE PLAY':`${sim.possession===0?'KILN':'SWITCH'} BALL · ${Math.ceil(sim.possessionClock)}s`;
  for(const event of sim.events){
    if(event.id<=lastEvent)continue;
    lastEvent=event.id;
    if(event.type==='goal'){goalTime=event.time;goalSign=event.team===0?-1:1;}
    const important=['goal','interception','block','miss','turnover','violation'].includes(event.type);
    const preserve=featuredEvent&&['goal','interception','block'].includes(featuredEvent.type)&&sim.time-featuredEvent.time<2.2;
    if(important||!preserve)featuredEvent=event;
  }
  if(featuredEvent){
    $momentType.textContent=eventNames[featuredEvent.type]||featuredEvent.type.toUpperCase();
    $momentText.textContent=featuredEvent.text;
    $moment.classList.toggle('away',featuredEvent.team===1);
    $moment.classList.toggle('quiet',sim.time-featuredEvent.time>3.2);
  }
}
function render(alpha,dt,draw=true){
  const viewBall={...sim.ball,x:THREE.MathUtils.lerp(previous.ball.x,sim.ball.x,alpha),y:THREE.MathUtils.lerp(previous.ball.y,sim.ball.y,alpha),z:THREE.MathUtils.lerp(previous.ball.z,sim.ball.z,alpha)};
  const displayTime=THREE.MathUtils.lerp(previous.time,sim.time,alpha);
  const boxes=[];
  sim.players.forEach((p,i)=>{
    const view=interpolatePlayer(p,i,alpha);
    interpolatePose(rigPoses[i],alpha);
    const point=new THREE.Vector3(view.x,.05,view.z).project(camera);
    let px=(point.x+1)*width/2,py=(-point.y+1)*height/2+15;
    const active=viewBall.owner===p.id;
    labels[i].classList.toggle('active',active);
    const lw=labels[i].offsetWidth||55;
    px=THREE.MathUtils.clamp(px,lw/2+8,width-lw/2-8);
    for(const b of boxes)if(Math.abs(b.x-px)<(b.w+lw)/2+4&&Math.abs(b.y-py)<14)py=b.y+15;
    py=THREE.MathUtils.clamp(py,35,height-34);boxes.push({x:px,y:py,w:lw});
    if(!labelPositions[i]||dt<=0)labelPositions[i]={x:px,y:py};
    else{const blend=1-Math.exp(-dt*14);labelPositions[i].x+=(px-labelPositions[i].x)*blend;labelPositions[i].y+=(py-labelPositions[i].y)*blend;}
    labels[i].style.transform=`translate(${labelPositions[i].x}px,${labelPositions[i].y}px) translate(-50%,-50%)`;
  });
  ballMesh.position.set(viewBall.x,viewBall.y,viewBall.z);
  ballMesh.rotation.x=displayTime*4;ballMesh.rotation.z=displayTime*2;
  ballShadow.position.set(viewBall.x,.027,viewBall.z);
  const s=1+viewBall.y*.14;ballShadow.scale.setScalar(s);ballShadow.material.opacity=.30/(1+viewBall.y*.28);
  const flying=['pass','shot','loose'].includes(viewBall.mode);
  trail.visible=flying&&Math.hypot(viewBall.vx,viewBall.vz)>3;
  if(flying){trailPoints.unshift(ballMesh.position.clone());trailPoints=trailPoints.slice(0,12);}else trailPoints=[];
  for(let i=0;i<12;i++){const v=trailPoints[i]||ballMesh.position;trailPositions[i*3]=v.x;trailPositions[i*3+1]=v.y;trailPositions[i*3+2]=v.z;}
  trailGeometry.attributes.position.needsUpdate=true;
  if(court.goalNets){
    const since=displayTime-goalTime;
    for(const net of court.goalNets){
      const rest=net.userData.restPositions,pos=net.geometry.attributes.position;
      if(!rest||!pos)continue;
      for(let i=0;i<pos.count;i++){
        const ripple=net.userData.goalSign===goalSign&&since>=0&&since<.9?Math.sin(since*20+rest[i*3]*2)*Math.exp(-since*4)*.08:0;
        pos.array[i*3+2]=rest[i*3+2]+ripple;
      }pos.needsUpdate=true;
    }
  }
  updateHUD();if(draw&&!contextLost){renderer.render(scene,camera);renderFrames++;}
}
function frame(now){
  const dt=Math.min((now-lastNow)/1000,.10);lastNow=now;
  if(!manual&&!contextLost){accumulator+=dt;while(accumulator+1e-9>=FIXED_STEP){tick();accumulator=Math.max(0,accumulator-FIXED_STEP);}render(accumulator/FIXED_STEP,dt);}
  requestAnimationFrame(frame);
}
window.advanceTime=(ms)=>{
  if(!Number.isFinite(ms)||ms<0)throw new Error('advanceTime requires a nonnegative finite duration');
  manual=true;
  accumulator+=ms/1000;
  while(accumulator+1e-9>=FIXED_STEP){tick();accumulator=Math.max(0,accumulator-FIXED_STEP);}
  render(1,0);
};
window.render_game_to_text=()=>JSON.stringify({
  autonomous:true,interaction:'view-only',prototype:true,
  coordinateSystem:'metres; x=left/right, y=height, z=court length; PIT attacks z=-8, OAK z=+8',
  rules:'3v3; 3-second carry, 12-second possession, 1 point for a goal; boards keep missed balls live',
  ...snapshot(sim),
});
window.__courtMotionQA={get renderFrames(){return renderFrames;},get drawCalls(){return renderer.info.render.calls;},get triangles(){return renderer.info.render.triangles;},get orientation(){return orientation;},get manual(){return manual;},get contextLost(){return contextLost;},get pose(){return{ticks:sim.ticks,athletes:rigPoses.map((pose,i)=>({id:sim.players[i].id,phase:rigs[i].phase,transforms:Array.from(pose.current)}))};}};
document.addEventListener('visibilitychange',()=>{lastNow=performance.now();});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;document.querySelector('#loading').hidden=false;document.querySelector('#loading').textContent='Restoring the court…';});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;lastNow=performance.now();document.querySelector('#loading').hidden=true;resize();render(1,0);});
resize();render(1,0);document.querySelector('#loading').hidden=true;requestAnimationFrame(frame);
