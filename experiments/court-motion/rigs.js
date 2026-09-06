import * as THREE from '../../vendor/three/three.module.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const geo = {
  joint: new THREE.IcosahedronGeometry(1, 1),
  head: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 4),
  round: new THREE.CylinderGeometry(1, 1, 1, 8),
  limb: new THREE.CylinderGeometry(.84, 1, 1, 7),
  box: new THREE.BoxGeometry(1, 1, 1),
};
const palettes = [
  { kit: 0xba502f, dark: 0x873b28, trim: 0xf4e6bc },
  { kit: 0x176e68, dark: 0x164b49, trim: 0xf4e6bc },
];
const profiles = {
  hare: { fur: 0x92998d, light: 0xd6d1b8, width: .32, head: .26, height: 1.03, ears: 'long' },
  badger: { fur: 0x3d4842, light: 0xe9dfc1, width: .46, head: .33, height: .99, ears: 'round' },
  stoat: { fur: 0xd9c9a5, light: 0xf5e7c4, width: .28, head: .25, height: .85, ears: 'round' },
  fox: { fur: 0xc77339, light: 0xf2dbac, width: .30, head: .27, height: .93, ears: 'point' },
  boar: { fur: 0x777c70, light: 0xa89e86, width: .49, head: .34, height: 1.02, ears: 'point' },
  lynx: { fur: 0xbf9c68, light: 0xefdbb0, width: .32, head: .27, height: 1.04, ears: 'tuft' },
};
const materialCache = new Map();
function mat(color) {
  if (!materialCache.has(color)) materialCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: .91, flatShading: true }));
  return materialCache.get(color);
}
function mesh(parent, shape, color, position, scale, rotation) {
  const item = new THREE.Mesh(geo[shape], mat(color));
  item.position.set(...position); item.scale.set(...scale);
  if (rotation) item.rotation.set(...rotation);
  item.castShadow = true; item.receiveShadow = true;
  parent.add(item); return item;
}
function link(parent, color, radius) {
  const m = new THREE.Mesh(geo.limb, mat(color));
  m.userData.radius = radius; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function aimLink(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.scale.set(m.userData.radius, Math.max(.001, d.length()), m.userData.radius);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
function jerseyTexture(number, name, team) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#f4e6bc'; ctx.textAlign = 'center';
  ctx.font = '800 27px Arial'; ctx.fillText(name.toUpperCase(), 128, 50);
  ctx.font = '900 142px Arial'; ctx.fillText(String(number), 128, 191);
  ctx.font = '700 15px Arial'; ctx.fillText(team === 0 ? 'PITTSBURGH' : 'OAKLAND', 128, 222);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
}
function solveJoint(a, b, lengthA, lengthB, bend) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const distance = clamp(direction.length(), .001, lengthA + lengthB - .001); direction.normalize();
  const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, lengthA * lengthA - along * along));
  const normal = bend.clone().addScaledVector(direction, -bend.dot(direction)).normalize();
  return a.clone().addScaledVector(direction, along).addScaledVector(normal, height);
}

// Bake the unmoving pieces within each articulated part into one mesh per material.
// Head, body, limbs and feet remain independently animated; tiny facial details no
// longer require a separate draw call each frame.
function batchStatic(parent) {
  const batches = new Map();
  for (const child of [...parent.children]) {
    if (!child.isMesh) continue;
    child.updateMatrix();
    let g = child.geometry.clone();
    if (g.index) { const expanded=g.toNonIndexed();g.dispose();g=expanded; }
    g.applyMatrix4(child.matrix);
    const key=child.material.uuid;
    if(!batches.has(key))batches.set(key,{material:child.material,geometries:[],children:[]});
    batches.get(key).geometries.push(g);batches.get(key).children.push(child);
  }
  for(const {material,geometries,children} of batches.values()){
    const count=geometries.reduce((n,g)=>n+g.attributes.position.count,0);
    const merged=new THREE.BufferGeometry();
    for(const [name,size] of [['position',3],['normal',3],['uv',2]]){
      const values=new Float32Array(count*size);let offset=0;
      for(const g of geometries){const attr=g.attributes[name];if(attr)values.set(attr.array,offset);offset+=g.attributes.position.count*size;}
      merged.setAttribute(name,new THREE.BufferAttribute(values,size));
    }
    const baked=new THREE.Mesh(merged,material);baked.castShadow=!material.transparent;baked.receiveShadow=true;parent.add(baked);
    children.forEach(c=>parent.remove(c));geometries.forEach(g=>g.dispose());
  }
}

export function createAthlete(player, scene) {
  const profile = profiles[player.species] || profiles.hare;
  const palette = palettes[player.team];
  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const h = profile.height, w = profile.width, shoulderY = 1.36 * h, hipY = .84 * h;
  const torso = mesh(body, 'round', palette.kit, [0, 1.12 * h, 0], [w, .60 * h, .24], [0, Math.PI / 8, 0]);
  mesh(body, 'round', palette.trim, [0, 1.408 * h, 0], [w * .72, .04, .185]);
  mesh(body, 'round', profile.fur, [0, 1.47 * h, 0], [.13, .15, .13]);
  mesh(body, 'round', palette.dark, [0, .81 * h, 0], [w * .9, .18 * h, .235]);
  for (const side of [-1, 1]) {
    mesh(body, 'box', palette.kit, [side * w * .47, .72 * h, .015], [w * .91, .30 * h, .42]);
    mesh(body, 'box', palette.trim, [side * w * .47, .582 * h, .018], [w * .93, .034, .43]);
    mesh(body, 'box', palette.trim, [side * (w * .90), 1.12 * h, 0], [.025, .51 * h, .29]);
  }
  const numberMaterial = jerseyTexture(player.number, player.name, player.team);
  for (const front of [1, -1]) {
    const print = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.50, .47 * h), numberMaterial);
    print.position.set(0, 1.135 * h, front * .244); print.rotation.y = front < 0 ? Math.PI : 0; body.add(print);
  }
  const head = new THREE.Group(); head.position.y = 1.65 * h; body.add(head);
  mesh(head, 'head', profile.fur, [0, .015, .01], [profile.head, profile.head * .97, profile.head * .90]);
  // Broad pale cheek planes and a forward muzzle make the cast read as animals in motion.
  const snout = player.species === 'boar' ? .23 : player.species === 'badger' ? .25 : .20;
  mesh(head, 'head', profile.light, [0, -.085, .18], [profile.head * .75, .12, snout]);
  mesh(head, 'head', player.species === 'boar' ? 0x9c806b : 0x28372f, [0, -.055, .18 + snout * .83], [player.species === 'boar' ? .135 : .072, player.species === 'boar' ? .10 : .048, .05]);
  if (player.species === 'boar') {
    for (const side of [-1, 1]) {
      mesh(head, 'head', 0x4c453c, [side * .056, -.045, .412], [.025, .035, .015]);
      mesh(head, 'cone', 0xe9dab5, [side * .18, -.025, .30], [.055, .23, .06], [0, 0, -side * .30]);
    }
  }
  for (const side of [-1, 1]) {
    if (player.species === 'badger') mesh(head, 'box', 0xe8dec4, [side * .15, .06, .215], [.11, .39, .04], [0, 0, side * -.22]);
    mesh(head, 'head', 0xf4e9c9, [side * profile.head * .53, .075, .205], [.085, .052, .031]);
    mesh(head, 'head', 0x27392c, [side * profile.head * .53 - side * .008, .075, .230], [.029, .039, .016]);
    mesh(head, 'box', 0x3b4134, [side * profile.head * .51, .126, .227], [.15, .035, .035], [0, 0, side * -.15]);
    if (profile.ears === 'long') {
      mesh(head, 'head', profile.fur, [side * .145, .43, -.09], [.087, .36, .069], [-.42, 0, side * -.14]);
      mesh(head, 'head', 0xbda181, [side * .145, .44, -.042], [.04, .28, .014], [-.42, 0, side * -.14]);
    } else if (profile.ears === 'round') {
      mesh(head, 'head', profile.fur, [side * profile.head * .83, profile.head * .76, -.015], [.11, .13, .072]);
      mesh(head, 'head', profile.light, [side * profile.head * .83, profile.head * .78, .04], [.063, .077, .025]);
    } else {
      mesh(head, 'cone', profile.fur, [side * .19, .30, -.018], [.14, .32, .11], [0, 0, side * -.15]);
      mesh(head, 'cone', profile.light, [side * .19, .305, .047], [.073, .22, .022], [0, 0, side * -.15]);
      if (profile.ears === 'tuft') {
        mesh(head, 'cone', 0x383b31, [side * .207, .49, -.01], [.038, .19, .033], [0, 0, side * -.18]);
        mesh(head, 'cone', profile.fur, [side * .27, -.06, .01], [.11, .29, .16], [0, 0, side * -1.6]);
      }
    }
  }
  let tail;
  if (player.species === 'fox' || player.species === 'stoat') {
    tail = new THREE.Group(); tail.position.set(0, .86 * h, -.19); body.add(tail);
    mesh(tail, 'head', profile.fur, [0, -.10, -.28], [.12, .18, .36], [-.48, 0, 0]);
    mesh(tail, 'head', player.species === 'fox' ? profile.light : 0x514d3c, [0, -.25, -.48], [.10, .12, .16], [-.48, 0, 0]);
  }
  const legs = [-1, 1].map(side => {
    const upper = link(root, profile.fur, w > .4 ? .12 : .09);
    const lower = link(root, profile.fur, w > .4 ? .105 : .072);
    const shoe = new THREE.Group(); root.add(shoe);
    mesh(shoe, 'box', 0xf3e9ce, [0, .025, .045], [.19, .065, .36]);
    mesh(shoe, 'box', palette.kit, [0, .095, .035], [.17, .11, .32]);
    mesh(shoe, 'box', palette.trim, [0, .16, .045], [.075, .015, .18]);
    return { side, upper, lower, shoe, anchor: null, start: null, target: null, swinging: false };
  });
  const arms = [-1, 1].map(side => {
    const upper = link(root, profile.fur, w > .4 ? .14 : .085);
    const lower = link(root, profile.fur, w > .4 ? .10 : .065);
    const hand = mesh(root, 'joint', profile.fur, [0, 1, 0], [.10, .12, .10]);
    const shoulder = mesh(root, 'joint', profile.fur, [side * w, shoulderY, 0], [w > .4 ? .17 : .11, .15, .13]);
    return { side, upper, lower, hand, shoulder };
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.40, .455, 48), new THREE.MeshBasicMaterial({color: 0xf7d55b, side: THREE.DoubleSide, transparent:true, opacity:.95, depthWrite:false}));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .016; root.add(ring);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(w + .10, 24), new THREE.MeshBasicMaterial({ color:0x253a2d, transparent:true, opacity:.12, depthWrite:false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .012; root.add(shadow);
  batchStatic(head);if(tail)batchStatic(tail);batchStatic(body);legs.forEach(leg=>batchStatic(leg.shoe));
  return { root, body, head, torso, tail, legs, arms, ring, profile, shoulderY, hipY, crouch:0, pickupUntil:0, phase: player.id * 1.1, lastX:player.x, lastZ:player.z, labelHeight:2.1 * h + (profile.ears === 'long' ? .23 : 0) };
}

export function updateAthlete(rig, p, ball, dt, time) {
  const { root, body, head, profile, legs, arms } = rig;
  const dx = p.x - rig.lastX, dz = p.z - rig.lastZ;
  const traveled = Math.hypot(dx, dz), speed = Math.hypot(p.vx, p.vz);
  rig.lastX = p.x; rig.lastZ = p.z;
  rig.phase += Math.min(traveled, .15) / 1.4 * TAU;
  root.position.set(p.x, 0, p.z); root.rotation.y = p.facing;
  const cy = Math.cos(p.facing), sy = Math.sin(p.facing);
  const local = (x, y, z) => new THREE.Vector3((x - p.x) * cy - (z - p.z) * sy, y, (x - p.x) * sy + (z - p.z) * cy);
  const world = (x, z) => ({ x:p.x + x * cy + z * sy, z:p.z - x * sy + z * cy });
  const moving = speed > .20;
  const bob = moving ? Math.abs(Math.sin(rig.phase)) * .025 * Math.min(speed / 2, 1) : Math.sin(time * 2 + p.id) * .005;
  const airborne = p.action === 'block' ? Math.sin(clamp(p.actionT / Math.max(.1,p.actionDuration),0,1)*Math.PI) * .19 : 0;
  const ballDistance=Math.hypot(ball.x-p.x,ball.z-p.z);
  const preparingPickup=ball.owner===null&&ball.y<1.05&&ballDistance<1.6&&/recover|retrieve/i.test(p.intent||'');
  const lowHeld=ball.owner===p.id&&ball.y<1.05;
  if(preparingPickup||lowHeld)rig.pickupUntil=time+.24;
  const crouchTarget=preparingPickup||lowHeld||time<rig.pickupUntil?.57:0;
  rig.crouch+=(crouchTarget-rig.crouch)*(1-Math.exp(-dt*(crouchTarget>rig.crouch?19:9)));
  const ballLocal=local(ball.x,ball.y,ball.z);
  const leanScale=rig.crouch/.57*.26/Math.max(.1,Math.hypot(ballLocal.x,ballLocal.z));
  const leanX=ballLocal.x*leanScale,leanZ=ballLocal.z*leanScale;
  body.position.set(leanX,bob+airborne-rig.crouch,leanZ);
  body.rotation.x = Math.min(speed * .024, .07);
  body.rotation.z = clamp((-p.vx * cy + p.vz * sy) * .018, -.065, .065);
  head.rotation.y = Math.sin(time * 1.3 + p.id) * .025;
  if (rig.tail) rig.tail.rotation.y = Math.sin(rig.phase) * .15;
  rig.ring.visible = ball.owner === p.id;
  const footSpread = profile.width * .50;
  for (const leg of legs) {
    const phase = ((rig.phase / TAU + (leg.side > 0 ? .5 : 0)) % 1 + 1) % 1;
    const home = world(leg.side * footSpread, .015);
    if (!leg.anchor) leg.anchor = { ...home };
    const movingFast = moving && traveled < .3;
    const swinging = movingFast && phase > .56;
    let lift = 0;
    let point = leg.anchor;
    if (swinging) {
      if (!leg.swinging) {
        leg.start = { ...leg.anchor };
        const stride = Math.min(.48, speed * .17);
        leg.target = {x:home.x + p.vx / Math.max(.1,speed) * stride,z:home.z + p.vz / Math.max(.1,speed) * stride};
      }
      const t = (phase - .56) / .44, eased = t*t*(3-2*t);
      point = {x:THREE.MathUtils.lerp(leg.start.x,leg.target.x,eased),z:THREE.MathUtils.lerp(leg.start.z,leg.target.z,eased)};
      lift = Math.sin(t * Math.PI) * .20;
      leg.anchor = point;
    } else if (leg.swinging) {
      if (leg.target) leg.anchor = { ...leg.target };
      point = leg.anchor;
    } else if (!movingFast || Math.hypot(point.x-home.x,point.z-home.z) > .65) {
      // Small recovery steps bring planted feet under the body after a cut or stop.
      const blend = Math.min(1,dt * 12);
      leg.anchor.x += (home.x-leg.anchor.x)*blend; leg.anchor.z += (home.z-leg.anchor.z)*blend;
      point = leg.anchor;
    }
    leg.swinging = swinging;
    const ankle = local(point.x,.15+lift+airborne,point.z);
    const hip = new THREE.Vector3(leg.side*footSpread+leanX,rig.hipY + bob + airborne-rig.crouch,leanZ);
    const knee = solveJoint(hip,ankle,.41*profile.height,.41*profile.height,new THREE.Vector3(0,.1,1));
    aimLink(leg.upper,hip,knee); aimLink(leg.lower,knee,ankle);
    leg.shoe.position.copy(ankle).add(new THREE.Vector3(0,-.12,0));
    leg.shoe.rotation.x = swinging ? -.30*Math.sin(((phase-.56)/.44)*Math.PI) : 0;
  }
  const progress = clamp(p.actionT / Math.max(.15,p.actionDuration || .4),0,1);
  for (const arm of arms) {
    const side = arm.side;
    const shoulder = new THREE.Vector3(side*(profile.width+.035)+leanX,rig.shoulderY+bob+airborne-rig.crouch,leanZ);
    let hand = new THREE.Vector3(side*(profile.width+.04),.94*profile.height+bob,Math.sin(rig.phase + (side < 0 ? Math.PI : 0))*.24*Math.min(speed/2.2,1));
    if (ball.owner === p.id) {
      hand = local(ball.x,ball.y,ball.z); hand.x += side*.115; hand.z -= .015;
    } else if(preparingPickup) {
      hand=ballLocal.clone();hand.x+=side*.115;
    } else if (p.action === 'pass' || p.action === 'shoot') {
      hand.set(side * .22, (p.action==='shoot'?1.65:1.28)*profile.height + Math.sin(progress*Math.PI)*.14, .62*(1-progress*.28));
    } else if (p.action === 'block') {
      hand.set(side * .38, 1.94 * profile.height + airborne, .24);
    } else if (p.action === 'catch' || ball.targetId === p.id && ball.mode === 'pass') {
      const distance = Math.hypot(ball.x-p.x,ball.z-p.z);
      if (distance < 2) { hand=local(ball.x,clamp(ball.y,.85,1.65),ball.z); hand.x+=side*.13; }
      else hand.set(side*.23,1.26*profile.height,.44);
    } else if (p.action === 'celebrate') {
      hand.set(side*.47,1.90*profile.height,.05);
    } else if (p.intent && /defend|mark|press|guard|block/i.test(p.intent)) {
      hand.set(side*(profile.width+.20),1.11*profile.height,.10);
    }
    // Keep reach anatomical, including when the ball is approaching rather than caught.
    const reach = hand.clone().sub(shoulder), maxReach = .71 * profile.height;
    if (reach.length() > maxReach) hand.copy(shoulder).add(reach.setLength(maxReach));
    const elbow = solveJoint(shoulder,hand,.36*profile.height,.37*profile.height,new THREE.Vector3(side*.65,-.9,-.15));
    aimLink(arm.upper,shoulder,elbow); aimLink(arm.lower,elbow,hand);
    arm.hand.position.copy(hand); arm.shoulder.position.copy(shoulder);
  }
}
