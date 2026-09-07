import * as THREE from '../../vendor/three/three.module.js';
import { buildArena } from './arena.js';
import { DURATION, ROSTER, sampleStudy } from './timeline.js';
import { createAthlete, buildFootTracks, poseAthlete, athleteMetrics } from './athletes.js';

const canvas=document.querySelector('#court'),stage=document.querySelector('.stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#192c30');scene.fog=new THREE.Fog('#192c30',34,75);
scene.add(new THREE.HemisphereLight('#eef5e2','#314650',2.1));
const key=new THREE.DirectionalLight('#ffedca',3.5);key.position.set(-8,17,7);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-13,right:13,top:14,bottom:-14,near:.5,far:45});
key.shadow.normalBias=.025;key.shadow.bias=-.00015;key.shadow.radius=3;scene.add(key);
const fill=new THREE.DirectionalLight('#bee1f3',1.5);fill.position.set(10,10,-9);scene.add(fill);
const rimLight=new THREE.DirectionalLight('#ffba78',.7);rimLight.position.set(-10,7,-8);scene.add(rimLight);
const arena=buildArena(scene);
const rigs=ROSTER.map(p=>createAthlete(p,scene));
const feet=buildFootTracks(sampleStudy,ROSTER,DURATION);
const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,100);
const ball=new THREE.Group();scene.add(ball);
const leather=new THREE.MeshStandardMaterial({color:'#ea7422',roughness:.76});
const orb=new THREE.Mesh(new THREE.SphereGeometry(.123,24,16),leather);orb.castShadow=true;ball.add(orb);
const seam=new THREE.MeshStandardMaterial({color:'#38291d',roughness:1});
for(let i=0;i<3;i++){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.1234,.0042,5,48),seam);
  if(i===1)ring.rotation.y=Math.PI/2;if(i===2)ring.rotation.x=Math.PI/2;ball.add(ring);
}
const orbShadow=new THREE.Mesh(new THREE.CircleGeometry(.125,24),new THREE.MeshBasicMaterial({color:'#24251c',transparent:true,opacity:.26,depthWrite:false}));
orbShadow.rotation.x=-Math.PI/2;orbShadow.position.y=.018;scene.add(orbShadow);
let time=0,manual=false,lastNow=performance.now(),width=1,height=1,frameCount=0,contextLost=false;
let state=sampleStudy(0);
const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp;
const ease=x=>{x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10);};
const range=(t,a,b)=>ease((t-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;

function directCamera(t){
  const aspect=width/height,portrait=aspect<1;
  const close=range(t,8.6,12.15),hero=range(t,13.8,16.0),reset=range(t,18.3,19.75);
  const action=close*(1-reset),face=hero*(1-reset);
  const widePos=portrait?[2.1,17.5,19]:[10.5,13,18.5];
  const actionPos=portrait?[2.5,12,10]:[8.8,9.5,8.5];
  const heroPos=portrait?[5.0,6.8,3.8]:[7.5,5.6,3.0];
  camera.position.set(...widePos);
  camera.position.lerp(new THREE.Vector3(...actionPos),action);
  camera.position.lerp(new THREE.Vector3(...heroPos),face*.7);
  const focus=new THREE.Vector3(portrait?.6:0,.4,-.1);
  focus.lerp(new THREE.Vector3(.1,1.35,-4.4),action);
  focus.lerp(new THREE.Vector3(0,1.15,-4.8),face*.65);
  camera.lookAt(focus);
  const wideSpan=portrait?13.0/aspect:Math.max(12.8,24.4/aspect);
  const actionSpan=portrait?7.1/aspect:Math.max(8.1,14.8/aspect);
  const heroSpan=portrait?6.5/aspect:Math.max(7.0,12.8/aspect);
  const span=mix(mix(wideSpan,actionSpan,action),heroSpan,face*.7);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  camera.updateProjectionMatrix();camera.updateMatrixWorld();
}

function updateHUD(){
  $('home-score').textContent=state.score[0];$('away-score').textContent=state.score[1];
  $('clock').textContent=Number(state.clock).toFixed(1);
  const t=state.time;
  let kicker,title,description,name,number,role;
  if(t<6.5){kicker='01 / SET THE TRAP';title='Make them<br>commit.';description='Brunt plants the screen. Hart waits for the gap.';name='HART';number='07';role='THE PLAYMAKER';}
  else if(t<9.8){kicker='02 / TURN THE CORNER';title='Two on<br>the ball.';description='The help comes over. The lane opens behind it.';name='HART';number='07';role='DRAWS THE DEFENSE';}
  else if(t<12.73){kicker='03 / FIND THE SKY';title='He saw it<br>first.';description='Hart puts it where only Brunt can reach.';name='BRUNT';number='44';role='THE FINISHER';}
  else{kicker='04 / ALLEY-OOP';title='Hart to<br>Brunt.';description='One screen. One read. Two points.';name='BRUNT';number='44';role='ALLEY-OOP · +2 POINTS';}
  $('beat-kicker').textContent=kicker;
  if($('beat-title').innerHTML!==title)$('beat-title').innerHTML=title;
  $('beat-description').textContent=description;$('featured-name').textContent=name;$('featured-number').textContent=number;$('featured-role').textContent=role;
  const resultAlpha=range(t,13.15,13.45)*(1-range(t,15.7,16.2));
  $('result').style.opacity=String(resultAlpha);
  $('result').style.transform=`translate(-50%,${12*(1-resultAlpha)}px)`;
  $('result').setAttribute('aria-hidden',String(resultAlpha<.05));
  $('fade').style.opacity=String(state.fade||0);
  $('progress').style.transform=`scaleX(${t/DURATION})`;
}

function draw(){
  state=sampleStudy(time);
  for(let i=0;i<rigs.length;i++)poseAthlete(rigs[i],state.players[i],state,feet.at(state.time,i));
  ball.position.fromArray(state.ball.position);
  if(Array.isArray(state.ball.rotation))ball.rotation.set(...state.ball.rotation);
  else ball.rotation.set(state.time*2.7,state.time*.8,state.time*.2);
  orbShadow.position.x=state.ball.position[0];orbShadow.position.z=state.ball.position[2];
  const h=state.ball.position[1];orbShadow.scale.setScalar(1+h*.17);orbShadow.material.opacity=clamp(.33-h*.043,.10,.33);
  arena.update(state.time,state);directCamera(state.time);updateHUD();
  if(!contextLost)renderer.render(scene,camera);
}
function resize(){
  const bounds=stage.getBoundingClientRect();width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
  renderer.setSize(width,height,false);draw();
}
function frame(now){
  const dt=Math.min((now-lastNow)/1000,.25);lastNow=now;
  if(!manual&&!document.hidden){time+=dt;draw();frameCount++;}
  requestAnimationFrame(frame);
}
function project(point){
  const p=new THREE.Vector3().fromArray(point).project(camera);
  return {x:(p.x*.5+.5)*width,y:(.5-p.y*.5)*height,visible:Math.abs(p.x)<=1&&Math.abs(p.y)<=1&&p.z>=-1&&p.z<=1};
}
function metrics(){
  return {time:state.time,viewport:{width,height},players:rigs.map(r=>{const m=athleteMetrics(r);return {...m,screen:project(m.head)};}),
    ball:ball.position.toArray(),ballScreen:project(ball.position.toArray()),rim:arena.rimCenter||[0,3.05,-5.8],rimScreen:project([0,3.05,-5.8]),
    camera:{position:camera.position.toArray(),span:camera.top-camera.bottom},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,frames:frameCount};
}
function textState(){
  return JSON.stringify({mode:'choreographed-possession',autonomous:false,loopSeconds:DURATION,time:state.time,stage:state.stage,score:state.score,clock:state.clock,fade:state.fade,
    coordinateSystem:'metres; y up; x across court; z toward midcourt; rim at [0,3.05,-5.8]',
    ball:state.ball,players:state.players.map(p=>({id:p.id,position:p.position,facing:p.facing,jump:p.jump,pose:p.pose,handL:p.handL,handR:p.handR,handLWeight:p.handLWeight,handRWeight:p.handRWeight})),
    viewport:{width,height,orientation:width<height?'portrait':'landscape'},input:'view-only'});
}
window.render_game_to_text=textState;
window.advanceTime=ms=>{
  if(!Number.isFinite(ms)||ms<0)throw new RangeError('advanceTime expects a nonnegative number of milliseconds');
  manual=true;time+=ms/1000;draw();return JSON.parse(textState());
};
window.__study={seek(seconds){if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('seek expects nonnegative seconds');manual=true;time=seconds;draw();return state;},state:()=>state,metrics};
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;});
canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;draw();});
document.addEventListener('visibilitychange',()=>{lastNow=performance.now();});
new ResizeObserver(resize).observe(stage);
resize();$('loading').remove();requestAnimationFrame(frame);
