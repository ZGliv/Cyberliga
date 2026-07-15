import * as THREE from 'three';
import './branddata.js';
import './arena-establishing.js';

const BRAND = globalThis.CyberligaBrand;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function color(value, fallback = '#ffffff') {
  try { return new THREE.Color(value || fallback); } catch { return new THREE.Color(fallback); }
}

function box(group, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function buildTheme(group, team, brand) {
  const primary = color(team.colors.primary, '#00e5ff');
  const accent = color(team.colors.accent, '#ffe16d');
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a111a, roughness: 0.72, metalness: 0.35 });
  const local = new THREE.MeshStandardMaterial({
    color: primary.clone().multiplyScalar(0.46),
    emissive: primary,
    emissiveIntensity: 0.09,
    roughness: 0.64,
    metalness: 0.18,
  });
  const light = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.62, toneMapped: false });
  const theme = brand.scene || 'megacity';

  if (theme === 'oldstone') {
    for (const side of [-1]) {
      for (let index = 0; index < 9; index += 1) {
        const x = -36 + index * 9;
        const arch = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.38, 8, 22, Math.PI), local);
        arch.position.set(x, 19.2, side * 36.8);
        arch.rotation.set(0, side < 0 ? 0 : Math.PI, 0);
        group.add(arch);
        box(group, [0.75, 11, 0.75], [x - 3.4, 13.8, side * 36.8], dark);
        box(group, [0.75, 11, 0.75], [x + 3.4, 13.8, side * 36.8], dark);
      }
    }
  } else if (theme === 'harbor') {
    for (const side of [-1]) {
      for (let index = 0; index < 7; index += 1) {
        const x = -34 + index * 11.2;
        box(group, [0.32, 18 + (index % 2) * 3, 0.32], [x, 22, side * 37], dark, [0, 0, side * (index % 2 ? 0.13 : -0.13)]);
        box(group, [12, 0.22, 0.45], [x + 5, 29 + (index % 3), side * 36.8], light, [0, 0, index % 2 ? 0.12 : -0.12]);
      }
    }
  } else if (theme === 'desert') {
    for (const side of [-1]) {
      for (let row = 0; row < 3; row += 1) {
        for (let index = 0; index < 12; index += 1) {
          box(group, [7.2, 0.16, 0.24], [-38 + index * 7, 27 + row * 2.8, side * (35.5 + row * 1.2)], index % 2 ? local : light, [0, 0, index % 2 ? 0.2 : -0.2]);
        }
      }
    }
  } else if (theme === 'industrial') {
    for (const side of [-1]) {
      for (let index = 0; index < 11; index += 1) {
        const x = -39 + index * 8;
        box(group, [0.5, 19, 0.5], [x, 21, side * 37], dark);
        box(group, [8.5, 0.34, 0.34], [x + 4, 30 - (index % 2) * 2, side * 37], local, [0, 0, index % 2 ? 0.22 : -0.22]);
      }
    }
  } else {
    for (const side of [-1]) {
      for (let index = 0; index < 9; index += 1) {
        const x = -36 + index * 9;
        const height = 11 + (index % 4) * 3;
        box(group, [4.8, height, 1.6], [x, 17 + height / 2, side * 37.5], index % 3 ? dark : local);
        box(group, [4.2, 0.24, 1.8], [x, 17 + height, side * 37.2], light);
      }
    }
  }
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      material.map?.dispose?.();
      material.dispose?.();
    }
    object.userData?.ownedTexture?.dispose?.();
  });
}

export function createSoccerVenueIdentity({ scene }) {
  let root = new THREE.Group();
  root.name = 'spectator-soccer-venue-identity';
  scene.add(root);
  let home = null;
  let away = null;
  let brand = null;
  let ribbons = [];
  let time = 0;
  let energy = 0;

  function configure(nextHome, nextAway) {
    scene.remove(root);
    disposeGroup(root);
    root = new THREE.Group();
    root.name = 'spectator-soccer-venue-identity';
    scene.add(root);
    home = nextHome;
    away = nextAway;
    brand = BRAND?.getTeam?.(home.content?.id || home.id) || {
      venue: `${home.content?.city || 'Cyberliga'} Ground`, venueLine: 'A purpose-built civic football ground.',
      ritual: 'The home crowd moves as one.', statement: home.name, scene: 'megacity', kitPattern: 'pulse', mark: 'pulse',
    };
    const contentTeam = home.content || home;
    buildTheme(root, contentTeam, brand);
    // Keep large identity art in the non-interactive establishing shot. Live cameras
    // can move outside either touchline for cards, replays and set pieces, so even a
    // far-stand plane can cross the pitch when that camera cuts low. Architecture,
    // fascia frames and ritual ribbons carry the same identity safely during play.

    ribbons = [];
    const homeColor = color(contentTeam.colors.primary);
    const accentColor = color(contentTeam.colors.accent);
    const awayContent = away.content || away;
    const awayColor = color(awayContent.colors.primary);
    for (const side of [-1, 1]) {
      for (let index = 0; index < 10; index += 1) {
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: index % 3 ? homeColor.clone().multiplyScalar(0.48) : accentColor.clone().multiplyScalar(0.68),
          emissive: index % 3 ? homeColor : accentColor,
          emissiveIntensity: 0.12,
          roughness: 0.5,
          metalness: 0.25,
        });
        const x = -39 + index * 8.7;
        box(root, [0.34, 5.5, 0.34], [x, 3.1, side * 29.2], frameMaterial);
        box(root, [8.2, 0.28, 0.34], [x + 4, 5.75, side * 29.2], frameMaterial);
      }
    }
    for (const side of [-1, 1]) {
      for (let index = 0; index < 28; index += 1) {
        const material = new THREE.MeshBasicMaterial({
          color: index % 6 ? homeColor : awayColor,
          transparent: true,
          opacity: 0.2,
          toneMapped: false,
        });
        const ribbon = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.22, 0.12), material);
        ribbon.position.set(-35.8 + index * 2.65, 7.1 + (index % 3) * 0.3, side * 29.45);
        root.add(ribbon);
        ribbons.push({ mesh: ribbon, index, side });
      }
    }
    energy = 0.35;
  }

  function update(dt, context = {}) {
    time += Math.min(0.1, Math.max(0, dt || 0));
    const target = clamp((context.excitement || 0) + (context.mode === 'goal' ? 1 : 0) + (context.mode === 'setpiece' ? 0.24 : 0), 0, 1);
    energy += (target - energy) * (1 - Math.exp(-(target > energy ? 7 : 0.7) * dt));
    const pattern = brand?.kitPattern || 'pulse';
    for (const item of ribbons) {
      let wave;
      if (pattern === 'fold' || pattern === 'weave' || pattern === 'bramble') wave = ((Math.floor(time * 5) + item.index) % 7 < 3) ? 1 : 0.1;
      else if (pattern === 'lantern' || pattern === 'serrated') wave = Math.max(0, Math.sin(time * 7 + item.index * 0.86));
      else if (pattern === 'tension' || pattern === 'speed') wave = Math.exp(-Math.pow((((time * 8 + item.index) % 28) - 14) / 4, 2));
      else wave = 0.5 + 0.5 * Math.sin(time * 5 + item.index * 0.44 + item.side);
      item.mesh.material.opacity = 0.14 + energy * (0.18 + 0.66 * wave);
      item.mesh.scale.y = 1 + energy * wave * 1.8;
    }
  }

  function state() {
    return brand ? {
      venue: brand.venue,
      venueLine: brand.venueLine,
      ritual: brand.ritual,
      statement: brand.statement,
      scene: brand.scene,
      pattern: brand.kitPattern,
      mark: brand.mark,
      energy: +energy.toFixed(2),
    } : null;
  }

  return { configure, update, state, get group() { return root; } };
}

export function soccerClubVisual(team) {
  const content = team?.content || team;
  const brand = BRAND?.getTeam?.(content?.id) || null;
  return {
    brandColor: content?.colors?.primary,
    secondaryColor: content?.colors?.secondary || content?.colors?.primary,
    accentColor: content?.colors?.accent,
    teamCode: content?.code,
    kitPattern: brand?.kitPattern || 'pulse',
    venue: brand?.venue || `${content?.city || 'Cyberliga'} Ground`,
  };
}
