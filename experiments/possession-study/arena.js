import * as THREE from '../../vendor/three/three.module.js';

// Authored procedural geometry and canvas artwork; no generated or remote assets.
const C = {
  ink: '#152725', dark: '#0c1718', edge: '#35433f', ember: '#c9502d',
  cream: '#f5e6c8', maple: '#cda66c', gold: '#b28b58', teal: '#80afa5',
};
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const hash = n => {
  const value = Math.sin(n * 127.1 + 19.73) * 43758.5453;
  return value - Math.floor(value);
};

function canvasTexture(canvas, anisotropy = 8) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function trackedText(ctx, text, x, y, spacing = 0) {
  const letters = [...text];
  const width = letters.reduce((total, letter) => total + ctx.measureText(letter).width, 0) + spacing * (letters.length - 1);
  let cursor = x - width / 2;
  for (const letter of letters) {
    ctx.fillText(letter, cursor, y);
    cursor += ctx.measureText(letter).width + spacing;
  }
}

function makeCourtTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  const size = 18.4;
  const scale = canvas.width / size;
  const X = x => (x + size / 2) * scale;
  const Z = z => (z + size / 2) * scale;
  const rect = (x, z, w, h, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(X(x), Z(z), w * scale, h * scale);
  };
  ctx.fillStyle = '#d2af78';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Long maple boards, staggered joints and restrained grain, all deterministically authored.
  const boardWidth = 0.19;
  for (let column = 0; column < Math.ceil(size / boardWidth); column += 1) {
    const x = column * boardWidth * scale;
    const width = boardWidth * scale;
    const value = hash(column + 2);
    ctx.fillStyle = `hsl(${35 + value * 4} 48% ${64 + value * 8}%)`;
    ctx.fillRect(x, 0, width + 1, canvas.height);
    ctx.fillStyle = 'rgba(87,58,30,.15)';
    ctx.fillRect(x, 0, 0.8, canvas.height);
    const offset = hash(column + 70) * 2.5 * scale;
    for (let y = offset; y < canvas.height; y += (1.8 + hash(column + y) * 1.4) * scale) {
      ctx.fillStyle = 'rgba(91,63,35,.17)';
      ctx.fillRect(x + 0.5, y, width - 1, 0.8);
    }
    for (let grain = 0; grain < 3; grain += 1) {
      const gx = x + width * (0.18 + grain * 0.27);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      for (let y = 0; y <= canvas.height; y += 85) ctx.lineTo(gx + Math.sin(y * 0.006 + column + grain) * 1.3, y);
      ctx.strokeStyle = 'rgba(102,68,34,.065)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  // Broad outer aprons frame the play and give team color a clear architectural home.
  rect(-9.2, -9.2, 18.4, 1.83, C.ink);
  rect(-9.2, 7.37, 18.4, 1.83, C.ink);
  rect(-9.2, -7.37, 1.53, 14.74, C.ink);
  rect(7.67, -7.37, 1.53, 14.74, C.ink);
  rect(-7.62, -7.30, 15.24, 0.12, C.ember);
  rect(-7.62, 7.18, 15.24, 0.12, C.ember);
  rect(-7.62, -7.18, 0.12, 14.36, C.ember);
  rect(7.50, -7.18, 0.12, 14.36, C.ember);

  // A dark key gives orange and pale-teal uniforms a readable background at the finish.
  rect(-2.45, -7, 4.9, 5.8, 'rgba(27,48,43,.96)');
  rect(-2.40, -6.94, 4.8, 0.11, C.ember);
  const path = (points, color = '#2d3b32', width = 0.055) => {
    ctx.beginPath();
    points.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const arc = (x, z, radius, from, to, color = '#2d3b32', width = 0.055) => {
    ctx.beginPath();
    ctx.arc(X(x), Z(z), radius * scale, from, to);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * scale;
    ctx.stroke();
  };
  path([[-7.5, -7], [7.5, -7], [7.5, 7], [-7.5, 7], [-7.5, -7]]);
  path([[-2.45, -7], [-2.45, -1.2], [2.45, -1.2], [2.45, -7]], C.cream);
  const corner = Math.asin(Math.sqrt(6.75 ** 2 - 6.6 ** 2) / 6.75);
  const arcStartZ = -5.8 + Math.sqrt(6.75 ** 2 - 6.6 ** 2);
  path([[-6.6, -7], [-6.6, arcStartZ]]);
  path([[6.6, -7], [6.6, arcStartZ]]);
  arc(0, -5.8, 6.75, corner, Math.PI - corner);
  arc(0, -1.2, 1.8, 0, Math.PI);
  ctx.setLineDash([0.16 * scale, 0.13 * scale]);
  arc(0, -1.2, 1.8, Math.PI, Math.PI * 2, C.cream);
  ctx.setLineDash([]);
  arc(0, -5.8, 1.25, 0, Math.PI, C.cream);
  path([[-1.25, -5.8], [-1.25, -6.25]], C.cream);
  path([[1.25, -5.8], [1.25, -6.25]], C.cream);
  arc(0, 7, 1.8, Math.PI, Math.PI * 2);
  for (const z of [-5.2, -4.25, -3.3, -2.35]) {
    path([[-2.45, z], [-2.7, z]], C.cream, 0.07);
    path([[2.45, z], [2.7, z]], C.cream, 0.07);
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.cream;
  ctx.font = '900 103px Arial, sans-serif';
  trackedText(ctx, 'PITTSBURGH', X(0), Z(-8.24), 17);
  ctx.font = '700 44px Arial, sans-serif';
  ctx.fillStyle = '#b9a884';
  trackedText(ctx, 'K I L N   A T H L E T I C   C L U B', X(0), Z(8.24), 1.4);

  // Quiet kiln-shaped center emblem, kept below ball/athlete contrast.
  ctx.save();
  ctx.translate(X(0), Z(3.8));
  ctx.globalAlpha = 0.075;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-0.74 * scale, -0.82 * scale);
  ctx.lineTo(0.74 * scale, -0.82 * scale);
  ctx.lineTo(0.74 * scale, 0.42 * scale);
  ctx.lineTo(0, 0.91 * scale);
  ctx.lineTo(-0.74 * scale, 0.42 * scale);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#dbc18e';
  ctx.font = '900 123px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('K', 0, 0);
  ctx.restore();
  return canvasTexture(canvas);
}

function makeRibbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#182a27'; ctx.fillRect(0, 0, 2048, 128);
  ctx.fillStyle = C.ember; ctx.fillRect(0, 0, 2048, 5); ctx.fillRect(0, 123, 2048, 5);
  ctx.textBaseline = 'middle'; ctx.font = '900 54px Arial, sans-serif'; ctx.fillStyle = C.cream;
  trackedText(ctx, 'PITTSBURGH KILN', 490, 67, 5);
  trackedText(ctx, 'OUR COURT. OUR CITY.', 1510, 67, 3);
  ctx.fillStyle = C.ember; ctx.fillRect(1001, 37, 7, 54);
  // Fine LED lattice is artwork, not thousands of emitting meshes.
  ctx.fillStyle = 'rgba(0,0,0,.17)';
  for (let x = 0; x < 2048; x += 5) ctx.fillRect(x, 0, 1, 128);
  for (let y = 0; y < 128; y += 5) ctx.fillRect(0, y, 2048, 1);
  return canvasTexture(canvas, 4);
}

export function buildArena(scene) {
  const root = new THREE.Group(); root.name = 'Authored basketball arena'; scene.add(root);
  const materials = [];
  const textures = [];
  const mat = (color, extra = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...extra });
    materials.push(material); return material;
  };
  const ink = mat(C.ink);
  const dark = mat(C.dark);
  const steel = mat('#465650', { roughness: 0.43, metalness: 0.64 });
  const ember = mat(C.ember, { roughness: 0.46 });
  const padding = mat('#a13b24', { roughness: 0.9 });
  const cream = mat(C.cream);
  const floorMap = makeCourtTexture(); textures.push(floorMap);
  const wood = mat('#ffffff', { map: floorMap, roughness: 0.54 });
  const mesh = (geometry, material, position, shadow = false) => {
    const item = new THREE.Mesh(geometry, material);
    if (position) item.position.set(...position);
    item.castShadow = shadow; item.receiveShadow = true; root.add(item); return item;
  };
  const box = (w, h, d, material, position, shadow = false) => mesh(new THREE.BoxGeometry(w, h, d), material, position, shadow);
  const beam = (from, to, width, depth, material) => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to);
    const item = box(width, a.distanceTo(b), depth, material, a.clone().add(b).multiplyScalar(0.5).toArray(), true);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return item;
  };

  const apron = mesh(new THREE.PlaneGeometry(50, 50), dark, [0, -0.22, 0]); apron.rotation.x = -Math.PI / 2;
  box(18.58, 0.19, 18.58, ink, [0, -0.11, 0]);
  const court = mesh(new THREE.PlaneGeometry(18.4, 18.4), wood, [0, 0, 0]); court.rotation.x = -Math.PI / 2;
  court.name = 'Warm maple basketball court';

  // Hoop assembly: the glass and markings face the +z broadcast camera.
  box(1.5, 0.28, 1.62, ink, [0, 0.08, -8.35], true);
  box(1.10, 1.86, 1.12, padding, [0, 1.04, -8.32], true);
  box(0.10, 1.70, 0.025, ember, [-0.40, 1.08, -7.746]);
  box(0.10, 1.70, 0.025, ember, [0.40, 1.08, -7.746]);
  beam([-0.25, 1.86, -8.30], [-0.25, 3.50, -6.33], 0.22, 0.24, steel);
  beam([0.25, 1.86, -8.30], [0.25, 3.50, -6.33], 0.22, 0.24, steel);
  beam([0, 3.03, -7.75], [0, 3.57, -6.30], 0.30, 0.22, ink);
  box(0.60, 0.26, 0.12, steel, [0, 3.48, -6.31], true);

  const glass = mat('#b9d4cf', { transparent: true, opacity: 0.17, roughness: 0.18, metalness: 0.08, depthWrite: false, side: THREE.DoubleSide });
  const backboard = box(1.80, 1.05, 0.035, glass, [0, 3.42, -6.22]);
  backboard.renderOrder = 2;
  const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.82, 1.07, 0.038));
  const frameMaterial = new THREE.LineBasicMaterial({ color: '#bfd3cc', transparent: true, opacity: 0.9 }); materials.push(frameMaterial);
  const frame = new THREE.LineSegments(frameGeometry, frameMaterial); frame.position.copy(backboard.position); root.add(frame);
  box(1.82, 0.12, 0.095, padding, [0, 2.905, -6.19], true);
  const targetPoints = [
    -0.295, 3.05, -6.192, 0.295, 3.05, -6.192,
    0.295, 3.05, -6.192, 0.295, 3.50, -6.192,
    0.295, 3.50, -6.192, -0.295, 3.50, -6.192,
    -0.295, 3.50, -6.192, -0.295, 3.05, -6.192,
  ];
  const targetGeometry = new THREE.BufferGeometry(); targetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(targetPoints, 3));
  const targetMaterial = new THREE.LineBasicMaterial({ color: '#f0e8d8' }); materials.push(targetMaterial);
  root.add(new THREE.LineSegments(targetGeometry, targetMaterial));
  box(0.14, 0.045, 0.23, ember, [0, 3.038, -6.12], true);
  const rim = mesh(new THREE.TorusGeometry(0.236, 0.017, 8, 48), ember, [0, 3.05, -5.8], true);
  rim.name = 'Rim — centre [0,3.05,-5.8]'; rim.rotation.x = Math.PI / 2;

  // Diamond net: 12 attachment points, 7 rows, one dynamic line draw call.
  const net = new THREE.Group(); net.name = 'Deformable basketball net'; net.position.copy(rim.position); root.add(net);
  const sections = 12; const rows = 7;
  const netSegments = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let section = 0; section < sections; section += 1) {
      netSegments.push([row, section, row + 1, section]);
      netSegments.push([row, section, row + 1, (section + (row % 2 ? 1 : sections - 1)) % sections]);
    }
  }
  for (let section = 0; section < sections; section += 1) netSegments.push([rows - 1, section, rows - 1, (section + 1) % sections]);
  const netPositions = new Float32Array(netSegments.length * 6);
  const netGeometry = new THREE.BufferGeometry();
  netGeometry.setAttribute('position', new THREE.BufferAttribute(netPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const netMaterial = new THREE.LineBasicMaterial({ color: '#fff1d7', transparent: true, opacity: 0.86 }); materials.push(netMaterial);
  const ropes = new THREE.LineSegments(netGeometry, netMaterial); ropes.frustumCulled = false; net.add(ropes);
  function updateNet(time, amount) {
    const point = (row, section) => {
      const t = row / (rows - 1);
      const angle = (section + (row % 2) * 0.5) / sections * Math.PI * 2;
      const radius = 0.225 - t * 0.095 + Math.sin(t * Math.PI * 0.85) * amount * 0.066;
      const sway = Math.sin(time * 20 - t * 2.4) * amount * t * 0.027;
      return [Math.cos(angle) * radius + sway, -0.015 - t * (0.49 + amount * 0.09), Math.sin(angle) * radius];
    };
    let index = 0;
    for (const [r1, s1, r2, s2] of netSegments) {
      for (const value of point(r1, s1)) netPositions[index++] = value;
      for (const value of point(r2, s2)) netPositions[index++] = value;
    }
    netGeometry.attributes.position.needsUpdate = true;
  }
  updateNet(0, 0);

  // Seating terraces are behind the baseline and beyond the two sidelines.
  // Nothing crosses the camera-facing edge of the floor.
  const seating = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let row = 0; row < 4; row += 1) {
      box(0.95, 0.35 + row * 0.38, 15.4, ink, [side * (10.25 + row * 0.98), -0.16 + (0.35 + row * 0.38) / 2, -0.5]);
      for (let seat = 0; seat < 18; seat += 1) seating.push({ x: side * (10.25 + row * 0.98), y: 0.32 + row * 0.38, z: -7.4 + seat * 0.8, facing: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  for (let row = 0; row < 4; row += 1) {
    box(20.2, 0.35 + row * 0.38, 0.95, ink, [0, -0.16 + (0.35 + row * 0.38) / 2, -10.45 - row * 0.98]);
    for (let seat = 0; seat < 23; seat += 1) seating.push({ x: -9.1 + seat * 0.8, y: 0.32 + row * 0.38, z: -10.45 - row * 0.98, facing: 0 });
  }
  const dummy = new THREE.Object3D();
  const seatMaterial = mat('#263833', { roughness: 0.9 });
  const seatBases = new THREE.InstancedMesh(new THREE.BoxGeometry(0.47, 0.08, 0.44), seatMaterial, seating.length);
  const seatBacks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.43, 0.07), seatMaterial, seating.length);
  root.add(seatBases, seatBacks);
  for (const [i, seat] of seating.entries()) {
    dummy.position.set(seat.x, seat.y + 0.31, seat.z); dummy.rotation.set(0, seat.facing, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); seatBases.setMatrixAt(i, dummy.matrix);
    dummy.position.x -= Math.sin(seat.facing) * 0.19; dummy.position.z -= Math.cos(seat.facing) * 0.19; dummy.position.y += 0.20; dummy.updateMatrix(); seatBacks.setMatrixAt(i, dummy.matrix);
  }
  seatBases.instanceMatrix.needsUpdate = true; seatBacks.instanceMatrix.needsUpdate = true;

  const occupied = seating.filter((_, i) => hash(i + 83) > 0.11);
  const crowdMaterial = mat('#ffffff', { roughness: 0.94 });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 7, 5), crowdMaterial, occupied.length);
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.20, 0.42, 6), crowdMaterial, occupied.length);
  const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.105, 0.37, 0.12), crowdMaterial, occupied.length * 2);
  const arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.055, 0.06, 0.34, 5), crowdMaterial, occupied.length * 2);
  for (const item of [heads, bodies, legs, arms]) { item.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(item); }
  const shirts = ['#233733', '#364139', '#aa4c2d', '#d2c4a8', '#172c2a', '#3f5049', '#b86c42'];
  const skin = ['#bd8f68', '#6a4835', '#d2ae8e', '#8e6346', '#493d32'];
  const color = new THREE.Color();
  for (let i = 0; i < occupied.length; i += 1) {
    bodies.setColorAt(i, color.set(shirts[Math.floor(hash(i + 316) * shirts.length)]));
    heads.setColorAt(i, color.set(skin[Math.floor(hash(i + 714) * skin.length)]));
    for (let j = 0; j < 2; j += 1) {
      legs.setColorAt(i * 2 + j, color.set('#182422'));
      arms.setColorAt(i * 2 + j, color.set(shirts[Math.floor(hash(i + 316) * shirts.length)]));
    }
  }
  let lastCrowdAmount = -1;
  function updateCrowd(amount) {
    if (Math.abs(lastCrowdAmount - amount) < 0.004) return;
    lastCrowdAmount = amount;
    for (const [i, seat] of occupied.entries()) {
      const homeSection = hash(i + 121) > 0.2;
      const lift = homeSection ? amount * (0.09 + hash(i + 503) * 0.20) : 0;
      const cosine = Math.cos(seat.facing); const sine = Math.sin(seat.facing);
      dummy.rotation.set(0, seat.facing, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(seat.x, seat.y + 0.58 + lift, seat.z); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.y = seat.y + 0.91 + lift; dummy.scale.set(0.95, 1.12, 1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(1, 1, 1);
      for (let j = 0; j < 2; j += 1) {
        const side = j ? 1 : -1;
        dummy.position.set(seat.x + cosine * side * 0.105 + sine * 0.1, seat.y + 0.20 + lift * 0.3, seat.z - sine * side * 0.105 + cosine * 0.1);
        dummy.rotation.set(-0.2, seat.facing, 0); dummy.updateMatrix(); legs.setMatrixAt(i * 2 + j, dummy.matrix);
        dummy.position.set(seat.x + cosine * side * 0.22, seat.y + 0.53 + lift * 1.8, seat.z - sine * side * 0.22);
        dummy.rotation.set(-0.32, seat.facing, side * (-0.13 + amount * (homeSection ? 1.9 : 0.08)));
        dummy.updateMatrix(); arms.setMatrixAt(i * 2 + j, dummy.matrix);
      }
    }
    for (const item of [heads, bodies, legs, arms]) item.instanceMatrix.needsUpdate = true;
  }
  updateCrowd(0);

  // One quiet ribbon behind the hoop, plus slim physical rails rather than a neon box.
  const ribbonMap = makeRibbonTexture(); textures.push(ribbonMap);
  const ribbonMaterial = new THREE.MeshBasicMaterial({ map: ribbonMap, toneMapped: false }); materials.push(ribbonMaterial);
  box(18.8, 0.75, 0.25, dark, [0, 0.57, -9.48]);
  const ribbon = mesh(new THREE.PlaneGeometry(18.55, 0.65), ribbonMaterial, [0, 0.6, -9.34]);
  ribbon.name = 'Pittsburgh identity LED ribbon';
  for (const side of [-1, 1]) {
    box(0.18, 0.80, 15.5, dark, [side * 9.5, 0.2, -0.8]);
    box(0.025, 0.045, 15.35, ember, [side * 9.398, 0.63, -0.8]);
  }
  // Low benches and equipment at the far corners keep the playing silhouette unobstructed.
  for (const side of [-1, 1]) {
    box(2.5, 0.10, 0.48, steel, [side * 6.2, 0.30, -8.45]);
    box(2.5, 0.48, 0.07, ink, [side * 6.2, 0.56, -8.69]);
    box(0.09, 0.32, 0.34, steel, [side * 6.2 - 0.96, 0.11, -8.45]);
    box(0.09, 0.32, 0.34, steel, [side * 6.2 + 0.96, 0.11, -8.45]);
  }

  let disposed = false;
  return {
    root, court, rim, net, backboard,
    courtBounds: { minX: -7.5, maxX: 7.5, minZ: -7, maxZ: 7 },
    rimCenter: new THREE.Vector3(0, 3.05, -5.8),
    update(time, state = {}) {
      if (disposed) return;
      const amount = clamp01(typeof state.net === 'number' ? state.net : state.net?.impact ?? state.net?.strength);
      updateNet(Number.isFinite(time) ? time : 0, amount);
      updateCrowd(clamp01(Math.max(amount, typeof state.impact === 'number' ? state.impact : 0)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set();
      root.traverse(item => { if (item.geometry) geometries.add(item.geometry); });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      root.removeFromParent();
    },
  };
}
