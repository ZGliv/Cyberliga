import * as THREE from '../../vendor/three/three.module.js';

// An authored procedural study: quiet materials leave the physical action legible.
// The playing surface is y=0, with touchlines x=±5 and end lines z=±8.
const COURT_WIDTH = 10;
const COURT_LENGTH = 16;

function mapleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1638;
  const ctx = canvas.getContext('2d');
  const px = canvas.width / COURT_WIDTH;
  ctx.fillStyle = '#d7bd91';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stable material variation; never consumes the simulation random stream.
  const noise = (n) => {
    const value = Math.sin(n * 127.1 + 41.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const plankWidth = 34;
  for (let col = 0; col < 31; col += 1) {
    const x = col * plankWidth;
    const tone = Math.floor(noise(col + 1) * 9);
    ctx.fillStyle = `rgb(${213 + tone}, ${187 + tone}, ${145 + tone})`;
    ctx.fillRect(x, 0, plankWidth, canvas.height);
    ctx.fillStyle = 'rgba(105, 80, 49, 0.09)';
    ctx.fillRect(x, 0, 0.75, canvas.height);
    for (let section = -1; section < 7; section += 1) {
      const y = section * 290 + noise(col + 93) * 220;
      ctx.fillStyle = 'rgba(103, 75, 45, 0.10)';
      ctx.fillRect(x, y, plankWidth, 0.7);
    }
    for (let strand = 0; strand < 11; strand += 1) {
      const key = col * 100 + strand;
      const grainX = x + 3 + noise(key + 330) * 27;
      const y = noise(key + 521) * canvas.height;
      ctx.strokeStyle = `rgba(112, 82, 43, ${0.025 + noise(key + 854) * 0.025})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(grainX, y);
      ctx.bezierCurveTo(grainX - 2, y + 55, grainX + 2, y + 95, grainX, y + 165);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(px, canvas.height / COURT_LENGTH);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f5efdc';
  ctx.lineWidth = 0.065;
  // Inset by half the stripe so the entire boundary remains on the floor.
  ctx.strokeRect(-4.965, -7.965, 9.93, 15.93);
  ctx.beginPath();
  ctx.moveTo(-4.965, 0);
  ctx.lineTo(4.965, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 1.13, 0, Math.PI * 2);
  ctx.stroke();

  // These are visual goal-area markings, not a goalkeeper exclusion rule.
  for (const sign of [-1, 1]) {
    ctx.strokeStyle = sign < 0 ? 'rgba(23,104,97,0.66)' : 'rgba(182,79,46,0.62)';
    ctx.lineWidth = 0.052;
    ctx.beginPath();
    ctx.arc(0, sign * 8, 2.6, sign < 0 ? 0 : Math.PI, sign < 0 ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5efdc';
    ctx.beginPath();
    ctx.arc(0, sign * 4.25, 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f5efdc';
  ctx.beginPath();
  ctx.arc(0, 0, 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundedSlabGeometry(width, length) {
  const x = -width / 2;
  const z = -length / 2;
  const r = 0.24;
  const outline = new THREE.Shape();
  outline.moveTo(x + r, z);
  outline.lineTo(x + width - r, z);
  outline.quadraticCurveTo(x + width, z, x + width, z + r);
  outline.lineTo(x + width, z + length - r);
  outline.quadraticCurveTo(x + width, z + length, x + width - r, z + length);
  outline.lineTo(x + r, z + length);
  outline.quadraticCurveTo(x, z + length, x, z + length - r);
  outline.lineTo(x, z + r);
  outline.quadraticCurveTo(x, z, x + r, z);
  return new THREE.ExtrudeGeometry(outline, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 2,
    curveSegments: 5,
    steps: 1,
  });
}

function goal(sign, frameMaterial, netMaterial) {
  const group = new THREE.Group();
  group.name = sign < 0 ? 'north-goal' : 'south-goal';
  const mouthZ = sign * 8;
  const backZ = sign * 8.68;
  const halfWidth = 1.65;
  const height = 2.5;
  const barWidth = 0.07;
  const postGeometry = new THREE.BoxGeometry(barWidth, height, barWidth);
  for (const x of [-halfWidth, halfWidth]) {
    const post = new THREE.Mesh(postGeometry, frameMaterial);
    post.position.set(x, height / 2, mouthZ);
    post.castShadow = true;
    group.add(post);
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(3.37, barWidth, barWidth), frameMaterial);
  crossbar.position.set(0, height, mouthZ);
  crossbar.castShadow = true;
  group.add(crossbar);

  const vertices = [];
  const segment = (a, b) => vertices.push(...a, ...b);
  const spacing = 0.22;
  // Back, sides and roof only. The mouth is completely open.
  for (let x = -halfWidth; x <= halfWidth + 0.001; x += spacing) {
    segment([x, 0.04, backZ], [x, height, backZ]);
    segment([x, height, mouthZ], [x, height, backZ]);
  }
  for (let y = 0.05; y <= height; y += spacing) {
    segment([-halfWidth, y, backZ], [halfWidth, y, backZ]);
    for (const x of [-halfWidth, halfWidth]) {
      segment([x, y, mouthZ], [x, y, backZ]);
    }
  }
  for (let depth = 0; depth <= 0.681; depth += 0.226) {
    const z = mouthZ + sign * depth;
    for (const x of [-halfWidth, halfWidth]) {
      segment([x, 0.04, z], [x, height, z]);
    }
    segment([-halfWidth, height, z], [halfWidth, height, z]);
  }
  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const net = new THREE.LineSegments(netGeometry, netMaterial);
  net.name = `${group.name}-net`;
  net.userData.goalSign = sign;
  net.userData.restPositions = new Float32Array(netGeometry.attributes.position.array);
  group.add(net);
  return { group, net };
}

export function buildCourt(scene) {
  const root = new THREE.Group();
  root.name = 'court-motion-study';
  const materials = {
    slab: new THREE.MeshStandardMaterial({ color: '#365750', roughness: 0.94 }),
    apron: new THREE.MeshStandardMaterial({ color: '#e8e1cb', roughness: 0.94 }),
    wood: new THREE.MeshStandardMaterial({ map: mapleTexture(), roughness: 0.85, metalness: 0 }),
    edge: new THREE.MeshStandardMaterial({ color: '#49645a', roughness: 0.93 }),
    frame: new THREE.MeshStandardMaterial({ color: '#f3efde', roughness: 0.72 }),
    net: new THREE.LineBasicMaterial({ color: '#53635a', transparent: true, opacity: 0.22, depthWrite: false }),
  };

  const slab = new THREE.Mesh(roundedSlabGeometry(12.7, 19.6), materials.slab);
  slab.rotation.x = -Math.PI / 2;
  slab.position.y = -0.29;
  slab.receiveShadow = true;
  slab.castShadow = true;
  root.add(slab);

  const apron = new THREE.Mesh(new THREE.PlaneGeometry(12.55, 19.45), materials.apron);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.055;
  apron.receiveShadow = true;
  root.add(apron);

  const surface = new THREE.Mesh(new THREE.PlaneGeometry(COURT_WIDTH, COURT_LENGTH), materials.wood);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0;
  surface.receiveShadow = true;
  root.add(surface);

  // A muted framing rail gives the tabletop a finished edge without enclosing play.
  const edgeGeometry = new THREE.BoxGeometry(0.16, 0.012, 18.5);
  for (const x of [-5.95, 5.95]) {
    const edge = new THREE.Mesh(edgeGeometry, materials.edge);
    edge.position.set(x, -0.044, 0);
    edge.receiveShadow = true;
    root.add(edge);
  }

  // Low rebound boards explain the live bank passes without hiding the action.
  const boards = new THREE.Group();
  boards.name = 'rebound-boards';
  const addBoard = (geometry, x, z) => {
    const board = new THREE.Mesh(geometry, materials.apron);
    board.position.set(x, 0.14, z);
    board.castShadow = true;
    board.receiveShadow = true;
    boards.add(board);
  };
  const sideBoardGeometry = new THREE.BoxGeometry(0.16, 0.28, 16.72);
  for (const x of [-5, 5]) addBoard(sideBoardGeometry, x, 0);
  const endBoardGeometry = new THREE.BoxGeometry(3.35, 0.28, 0.12);
  for (const z of [-8.3, 8.3]) {
    for (const x of [-3.325, 3.325]) addBoard(endBoardGeometry, x, z);
  }
  root.add(boards);

  const goalNets = [];
  for (const sign of [-1, 1]) {
    const built = goal(sign, materials.frame, materials.net);
    root.add(built.group);
    goalNets.push(built.net);
  }
  scene.add(root);
  return { root, surface, goalNets, materials, bounds: { halfWidth: 5, halfLength: 8, goalHalfWidth: 1.65, goalHeight: 2.5 } };
}
