import * as THREE from '../../vendor/three/three.module.js';

const Y = new THREE.Vector3(0, 1, 0);
const v = () => new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;
const ease = (x) => { x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10); };
const mix = (a,b,t) => a+(b-a)*t;
const sphere = new THREE.SphereGeometry(1,18,12);
const cylinder = new THREE.CylinderGeometry(1,1,1,14);
const mat = (color,roughness=.72) => new THREE.MeshStandardMaterial({color,roughness});
const scratch = {a:v(),b:v(),c:v(),d:v(),e:v(),q:new THREE.Quaternion()};

function ellipsoid(parent,material,x,y,z,sx,sy,sz) {
  const mesh=new THREE.Mesh(sphere,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function tube(parent,material,r1,r2,length) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,length,12),material);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function between(mesh,a,b,radiusX,radiusZ=radiusX) {
  scratch.a.subVectors(b,a);const length=scratch.a.length();
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(Y,scratch.a.normalize());
  mesh.scale.set(radiusX,length,radiusZ);
}
function segment(parent,material) {
  const m=new THREE.Mesh(cylinder,material);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}

// These are deliberately sculptural sporting characters, authored in geometry.
// Their limbs are posed from world-space contacts rather than action timers.
function torsoGeometry() {
  return new THREE.LatheGeometry([
    new THREE.Vector2(.225,.99),new THREE.Vector2(.23,1.05),new THREE.Vector2(.245,1.20),
    new THREE.Vector2(.30,1.40),new THREE.Vector2(.31,1.48),new THREE.Vector2(.26,1.55),
    new THREE.Vector2(.12,1.59),
  ],24);
}
function lettering(player,back) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=384;
  const c=canvas.getContext('2d');c.fillStyle=player.team===0?'#fff3d8':'#142c2e';
  c.textAlign='center';c.font='800 27px Arial';c.fillText(back?player.name.toUpperCase():(player.team===0?'KILN':'SWITCH'),128,57);
  c.font='900 170px Arial';c.fillText(String(player.number),128,229);
  if(!back){c.font='bold 16px Arial';c.fillText(player.team===0?'PITTSBURGH':'OAKLAND',128,267);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.40,.51),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
  mesh.position.set(0,1.34,back?-.232:.232);if(back)mesh.rotation.y=Math.PI;return mesh;
}
function shoe(parent,primary,accent) {
  const root=new THREE.Group();parent.add(root);
  ellipsoid(root,primary,0,0,.05,.119,.105,.226);
  ellipsoid(root,accent,0,-.055,.06,.124,.040,.231);
  ellipsoid(root,primary,0,.068,-.045,.096,.087,.10);
  const detail=new THREE.Mesh(new THREE.BoxGeometry(.115,.014,.17),accent);
  detail.position.set(0,.093,.075);detail.rotation.x=-.22;root.add(detail);
  return root;
}

export function createAthlete(player,scene) {
  const root=new THREE.Group();root.name=player.id;scene.add(root);
  const s=player.height/2;root.scale.setScalar(s);
  const skin=mat(player.skin||['#81492f','#673e2d','#c99166','#4b3028','#ad754e','#ce9d75'][Number(player.number)%6]);
  const kit=mat(player.team===0?'#ce431f':'#b8e1cf');
  const trim=mat(player.team===0?'#ffcb79':'#173f40');
  const dark=mat('#16282a');const ivory=mat('#f6f0dd');
  const hair=mat(player.hair||'#211b19');
  const body=new THREE.Group();root.add(body);
  const torso=new THREE.Mesh(torsoGeometry(),kit);torso.scale.z=.69;torso.castShadow=true;torso.receiveShadow=true;body.add(torso);
  body.add(lettering(player,false),lettering(player,true));
  const waist=tube(body,trim,.236,.235,.06);waist.position.y=1.015;waist.scale.z=.72;
  const neck=tube(body,skin,.094,.105,.15);neck.position.y=1.61;
  const collar=new THREE.Mesh(new THREE.TorusGeometry(.106,.024,8,24),trim);collar.rotation.x=Math.PI/2;collar.position.y=1.58;body.add(collar);

  const head=new THREE.Group();head.position.y=1.79;body.add(head);
  ellipsoid(head,skin,0,0,0,.166,.211,.155);
  ellipsoid(head,skin,0,-.084,.022,.142,.120,.14);
  ellipsoid(head,skin,0,-.015,.151,.047,.052,.049);
  for(const sign of [-1,1]){
    ellipsoid(head,skin,sign*.165,-.008,0,.034,.063,.040);
    ellipsoid(head,dark,sign*.063,.034,.141,.025,.015,.010);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(.07,.020,.022),hair);brow.position.set(sign*.061,.070,.140);brow.rotation.z=sign*.12;head.add(brow);
  }
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(.060,.011,.012),mat('#613d31'));mouth.position.set(0,-.095,.147);head.add(mouth);
  const idx=Number(player.number);
  if(idx===44){
    ellipsoid(head,hair,0,.12,-.006,.168,.115,.154);
    ellipsoid(head,hair,0,-.112,.072,.128,.068,.112);
    const band=new THREE.Mesh(new THREE.TorusGeometry(.16,.024,8,24),trim);band.scale.set(1,1,.87);band.rotation.x=Math.PI/2;band.position.y=.075;head.add(band);
  }else if(idx===7||idx===11){
    const curls=new THREE.InstancedMesh(sphere,hair,18);const dummy=new THREE.Object3D();
    for(let i=0;i<18;i++){
      const a=i*2.39996,r=.14*Math.sqrt((i+.5)/18);
      dummy.position.set(Math.cos(a)*r,.16+.055*(1-r/.16),Math.sin(a)*r);
      dummy.scale.set(.060,idx===7?.083:.11,.06);dummy.updateMatrix();curls.setMatrixAt(i,dummy.matrix);
    }curls.castShadow=true;head.add(curls);
  }else{
    ellipsoid(head,hair,0,.13,-.025,.16,.09,.151);
    if(idx===33){const band=new THREE.Mesh(new THREE.TorusGeometry(.159,.025,8,24),ivory);band.rotation.x=Math.PI/2;band.scale.y=.88;band.position.y=.08;head.add(band);}
  }

  const legs=[],arms=[];
  for(const sign of [-1,1]){
    const upper=segment(root,kit),lower=segment(root,(idx===7&&sign===-1)||idx===33?dark:skin);
    const knee=ellipsoid(root,(idx===7&&sign===-1)||idx===33?dark:skin,0,0,0,.098,.104,.098);
    const cuff=segment(root,trim);
    const boot=shoe(root,ivory,player.team===0?trim:dark);
    legs.push({sign,upper,lower,knee,cuff,shoe:boot,hip:v(),joint:v(),foot:v(),yaw:0});
    const shoulder=ellipsoid(body,skin,sign*.277,1.475,0,.117,.137,.12);
    const au=segment(root,idx===7&&sign===1?dark:skin),al=segment(root,skin);
    const elbow=ellipsoid(root,skin,0,0,0,.073,.073,.073);
    const hand=ellipsoid(root,skin,0,0,0,.059,.090,.052);
    // A thumb gives the palm a readable contact edge around the ball.
    ellipsoid(hand,skin,-sign*.64,.02,.46,.42,.51,.48);
    const wrist=segment(root,idx===11?trim:ivory);
    arms.push({sign,upper:au,lower:al,elbow,hand,shoulder,wrist,start:v(),joint:v(),target:v()});
  }
  const chestPivot=new THREE.Group();chestPivot.position.y=1;root.add(chestPivot);chestPivot.add(body);body.position.y=-1;
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const c=shadowCanvas.getContext('2d');const gradient=c.createRadialGradient(32,32,1,32,32,32);gradient.addColorStop(0,'rgba(16,23,24,.35)');gradient.addColorStop(1,'rgba(16,23,24,0)');c.fillStyle=gradient;c.fillRect(0,0,64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.0,.80),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;scene.add(shadow);
  return {root,body:chestPivot,head,legs,arms,shadow,player,scale:s,palms:[],feet:[],contactError:0};
}

function pointFromPose(p,local,s=1){
  const sn=Math.sin(p.facing),cs=Math.cos(p.facing);
  return [p.position[0]+s*(local[0]*cs+local[2]*sn),s*local[1]+(p.jump||0),p.position[2]+s*(-local[0]*sn+local[2]*cs)];
}
function solveJoint(start,end,l1,l2,hint,out){
  const axis=scratch.b.subVectors(end,start);const raw=axis.length();const dist=clamp(raw,.03,l1+l2-.003);axis.normalize();
  const along=(l1*l1-l2*l2+dist*dist)/(2*dist);
  const bend=Math.sqrt(Math.max(.0001,l1*l1-along*along));
  const normal=scratch.c.copy(hint).addScaledVector(axis,-hint.dot(axis));
  if(normal.lengthSq()<.00001)normal.set(0,0,1).addScaledVector(axis,-axis.z);
  normal.normalize();out.copy(start).addScaledVector(axis,along).addScaledVector(normal,bend);
  if(raw>l1+l2-.003)end.copy(start).addScaledVector(axis,dist);
}

// Precompute complete footfalls once. A renderer at any refresh rate reads the
// same world-space stance and swing; it never cancels a half-finished step.
export function buildFootTracks(sampleStudy,roster,duration,rate=120){
  const states=Array.from({length:Math.ceil(duration*rate)+1},(_,i)=>sampleStudy(Math.min(i/rate,duration-.00001)));
  const tracks=roster.map((r,ri)=>{
    const result=[];const s=r.height/2;
    let next=0;let moving=null;let phase=0;let flight=null;
    const initial=states[0].players[ri];
    let feet=[-1,1].map(sign=>({p:pointFromPose(initial,[sign*.17,.105,.04],s),yaw:initial.facing}));
    for(let i=0;i<states.length;i++){
      const p=states[i].players[ri],t=i/rate;
      phase+=(p.speed||0)/rate/1.5;
      if(moving){
        const u=clamp((t-moving.start)/moving.duration,0,1),e=ease(u);
        feet[moving.side]={p:moving.from.map((a,k)=>mix(a,moving.to[k],e)+(k===1?.13*Math.sin(Math.PI*u)**2:0)),yaw:mix(moving.yaw,moving.endYaw,e)};
        if(u>=1){next=1-moving.side;moving=null;}
      }
      const airborne=(p.jump||0)>.002;
      if(airborne&&!flight){
        let landIndex=i+1;
        while(landIndex<states.length-1&&states[landIndex].players[ri].jump>.002)landIndex++;
        const landing=states[landIndex].players[ri];
        flight={start:t,land:landIndex/rate,from:feet.map(f=>({p:f.p.slice(),yaw:f.yaw})),
          to:[-1,1].map(sign=>({p:pointFromPose({...landing,jump:0},[sign*.19,.105,.015],s),yaw:landing.facing}))};
        moving=null;
      }
      if(flight&&t>=flight.land){feet=flight.to;flight=null;}
      if(!moving&&!airborne){
        const stand=[-1,1].map(sign=>pointFromPose({...p,jump:0},[sign*.17,.105,.04],s));
        const errors=feet.map((f,side)=>Math.hypot(f.p[0]-stand[side][0],f.p[2]-stand[side][2]));
        if(errors[next]>.16*s||(p.speed>.32&&t>.05)){
          const duration=clamp(.38-(p.speed||0)*.030,.22,.38);
          const future=states[Math.min(states.length-1,Math.round((t+duration*.8)*rate))].players[ri];
          const goal=pointFromPose({...future,jump:0},[(next===0?-1:1)*.17,.105,.065],s);
          const from=feet[next].p.slice();const distance=Math.hypot(goal[0]-from[0],goal[2]-from[2]);
          if(distance>1.03*s){const k=1.03*s/distance;goal[0]=mix(from[0],goal[0],k);goal[2]=mix(from[2],goal[2],k);}
          const da=Math.atan2(Math.sin(future.facing-feet[next].yaw),Math.cos(future.facing-feet[next].yaw));
          moving={side:next,start:t,duration,from,to:goal,yaw:feet[next].yaw,endYaw:feet[next].yaw+da};
        }
      }
      let output=feet.map(f=>({p:f.p.slice(),yaw:f.yaw}));
      if(flight){
        const u=clamp((t-flight.start)/(flight.land-flight.start),0,1),e=ease(u);
        const tuck=.12*Math.sin(Math.PI*u)**2,forward=[Math.sin(p.facing),0,Math.cos(p.facing)];
        output=flight.from.map((f,side)=>({p:f.p.map((a,k)=>mix(a,flight.to[side].p[k],e)+(k===1?(p.jump||0)+tuck:-forward[k]*tuck)),yaw:mix(f.yaw,flight.to[side].yaw,e)}));
      }
      result.push({feet:output,phase});
    }return result;
  });
  return {rate,tracks,at(t,index){
    const frame=clamp(t*rate,0,tracks[index].length-1),i=Math.floor(frame),u=frame-i;
    const a=tracks[index][i],b=tracks[index][Math.min(i+1,tracks[index].length-1)];
    return {phase:mix(a.phase,b.phase,u),feet:a.feet.map((f,j)=>({p:f.p.map((x,k)=>mix(x,b.feet[j].p[k],u)),yaw:mix(f.yaw,b.feet[j].yaw,u)}))};
  }};
}

export function poseAthlete(rig,p,state,footPose){
  const {root,body,head,scale:s}=rig;
  root.position.set(p.position[0],p.jump||0,p.position[2]);root.rotation.y=p.facing;
  const crouch=p.crouch||0;body.position.y=1-crouch;
  const speed=p.speed||0;const moving=clamp(speed/2.5,0,1);
  const gait=Math.sin(footPose.phase*Math.PI*2);
  body.rotation.x=clamp(p.lean||0,-.35,.35);
  body.rotation.z=.018*gait*moving;
  // Small chest motion, no constant head bob or camera shake.
  body.position.z=-.015*crouch;
  root.updateMatrixWorld(true);
  const ball=state.ball.position;
  const look=Math.atan2(ball[0]-p.position[0],ball[2]-p.position[2])-p.facing;
  head.rotation.y=clamp(Math.atan2(Math.sin(look),Math.cos(look)),-.65,.65)*.5;
  head.rotation.x=-clamp((ball[1]-1.7-(p.jump||0))*.15,-.15,.3);

  for(let i=0;i<2;i++){
    const leg=rig.legs[i],world=footPose.feet[i];
    leg.hip.set(leg.sign*.15,1.00-crouch,0);
    leg.foot.fromArray(world.p);root.worldToLocal(leg.foot);
    const hint=scratch.d.set(0,0,1);
    solveJoint(leg.hip,leg.foot,.51,.51,hint,leg.joint);
    between(leg.upper,leg.hip,leg.joint,.133,.141);
    between(leg.lower,leg.joint,leg.foot,.078,.081);
    leg.knee.position.copy(leg.joint);
    const cuffA=scratch.d.copy(leg.hip).lerp(leg.joint,.77),cuffB=scratch.e.copy(leg.hip).lerp(leg.joint,.90);
    between(leg.cuff,cuffA,cuffB,.138,.145);
    leg.shoe.position.copy(leg.foot);leg.shoe.rotation.y=world.yaw-p.facing;
  }
  rig.contactError=0;
  for(let i=0;i<2;i++){
    const arm=rig.arms[i],side=i===0?'L':'R';
    arm.shoulder.getWorldPosition(arm.start);root.worldToLocal(arm.start);
    const defensive=rig.player.team===1;
    const swing=gait*moving*arm.sign;
    let target=new THREE.Vector3(arm.sign*(defensive?.48:.33),defensive?1.15:1.03-crouch,.16+swing*.16);
    if(p.id===1){
      const screen=p.screenWeight||0;
      const celebrate=p.celebrateWeight||0;
      target.lerp(new THREE.Vector3(arm.sign*.19,1.15,.30),screen);
      target.lerp(new THREE.Vector3(arm.sign*.41,1.18,.28),celebrate);
    }
    if(p.id===4){
      const contest=ease((state.time-11.8)/.4)*(1-ease((state.time-12.5)/.5));
      target.lerp(new THREE.Vector3(arm.sign*(i===1?.16:.38),i===1?2.08:1.48,.32),contest);
    }
    if(p.id===2){
      const ready=ease((state.time-5.6)/.6)*(1-ease((state.time-11.7)/.5));
      const cheer=ease((state.time-12.8)/.5)*(1-ease((state.time-14.0)/.6));
      target.lerp(new THREE.Vector3(arm.sign*.31,1.30,.35),ready);
      target.lerp(new THREE.Vector3(arm.sign*.36,1.85,.22),cheer);
    }
    if(p.id===0&&i===1){
      const acknowledge=ease((state.time-13.4)/.5)*(1-ease((state.time-15.1)/.6));
      target.lerp(new THREE.Vector3(.12,1.60,.64),acknowledge);
    }
    const explicit=p[`hand${side}`];
    if(explicit){
      const goal=new THREE.Vector3().fromArray(explicit);root.worldToLocal(goal);
      target.lerp(goal,p[`hand${side}Weight`]??1);
    }
    arm.target.copy(target);
    const requested=target.clone();
    // All authored reaches stay in front of the shoulder. A lateral pole keeps
    // the elbow plane well away from the gather's forward/upward singularity.
    const hint=scratch.d.set(arm.sign,0,0);
    solveJoint(arm.start,arm.target,.36,.35,hint,arm.joint);
    if(explicit)rig.contactError=Math.max(rig.contactError,arm.target.distanceTo(requested)*s);
    between(arm.upper,arm.start,arm.joint,.092,.095);
    between(arm.lower,arm.joint,arm.target,.068,.070);
    arm.elbow.position.copy(arm.joint);arm.hand.position.copy(arm.target);
    scratch.a.subVectors(arm.target,arm.joint).normalize();arm.hand.quaternion.setFromUnitVectors(Y,scratch.a);
    const wristA=scratch.d.copy(arm.joint).lerp(arm.target,.82),wristB=scratch.e.copy(arm.joint).lerp(arm.target,.95);
    between(arm.wrist,wristA,wristB,.072,.074);
  }
  rig.shadow.position.x=p.position[0];rig.shadow.position.z=p.position[2];
  rig.shadow.scale.setScalar(1+(p.jump||0)*.2);rig.shadow.material.opacity=1-(p.jump||0)*.3;
  root.updateMatrixWorld(true);
}

export function athleteMetrics(rig){
  const arr=o=>o.getWorldPosition(new THREE.Vector3()).toArray();
  const leftFoot=arr(rig.legs[0].shoe),rightFoot=arr(rig.legs[1].shoe);
  return {id:rig.player.id,position:rig.root.position.toArray(),height:rig.player.height,
    leftFoot,rightFoot,leftSole:leftFoot[1]-.095*rig.scale,rightSole:rightFoot[1]-.095*rig.scale,
    leftKnee:arr(rig.legs[0].knee),rightKnee:arr(rig.legs[1].knee),
    leftHand:arr(rig.arms[0].hand),rightHand:arr(rig.arms[1].hand),leftElbow:arr(rig.arms[0].elbow),rightElbow:arr(rig.arms[1].elbow),
    head:arr(rig.head),contactError:rig.contactError};
}
