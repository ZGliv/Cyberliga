import * as THREE from 'three';
import './branddata.js';
import './arena-establishing.js';

const BRAND = globalThis.CyberligaBrand;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function color(value, fallback = '#ffffff') {
  try { return new THREE.Color(value || fallback); } catch { return new THREE.Color(fallback); }
}

function canvasTexture(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  painter(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function textBoard({ title, kicker, detail, primary, accent }) {
  const texture = canvasTexture(1024, 384, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#03080c');
    gradient.addColorStop(0.58, '#071016');
    gradient.addColorStop(1, color(primary).getStyle());
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 0; y < height; y += 8) context.fillRect(0, y, width, 2);
    context.strokeStyle = accent;
    context.lineWidth = 10;
    context.strokeRect(12, 12, width - 24, height - 24);
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = accent;
    context.font = '900 38px Arial, sans-serif';
    context.fillText(kicker, 54, 72);
    context.fillStyle = '#f5fbff';
    context.font = '900 92px Arial, sans-serif';
    context.fillText(title, 52, 176);
    context.fillStyle = 'rgba(235,245,250,.78)';
    context.font = '700 31px Arial, sans-serif';
    const words = String(detail || '').toUpperCase().split(/\s+/);
    let line = '';
    let y = 274;
    for (const word of words) {
      const next = `${line} ${word}`.trim();
      if (context.measureText(next).width > width - 105) {
        context.fillText(line, 54, y);
        line = word;
        y += 42;
      } else line = next;
    }
    context.fillText(line, 54, y);
  });
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(25, 9.4), material);
  mesh.userData.ownedTexture = texture;
  return mesh;
}

function conceptBoard(team, primary) {
  if (!BRAND?.sceneSvg) return null;
  const svg = BRAND.sceneSvg(team);
  if (!svg) return null;
  const texture = new THREE.TextureLoader().load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: primary,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(19.2, 10.8), material);
  mesh.userData.ownedTexture = texture;
  return mesh;
}

function beam(group, dimensions, position, material, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function buildArchitecture(group, brand, team) {
  const primary = color(team.colors?.primary, '#5de7ff');
  const accent = color(team.colors?.accent, '#ffcf6e');
  const steel = new THREE.MeshStandardMaterial({ color: 0x101b22, roughness: 0.67, metalness: 0.42 });
  const structure = new THREE.MeshStandardMaterial({
    color: primary.clone().multiplyScalar(0.42),
    emissive: primary,
    emissiveIntensity: 0.1,
    roughness: 0.58,
    metalness: 0.24,
  });
  const glow = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, toneMapped: false });
  const scene = brand?.scene || 'megacity';

  for (const x of [-59, -29, 1, 31, 61]) {
    beam(group, [0.48, 20, 0.48], [x, 18, -44.8], steel);
    beam(group, [0.48, 20, 0.48], [x, 18, 44.8], steel);
  }

  if (scene === 'wetland' || scene === 'tropic' || scene === 'harbor') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 5; index += 1) {
        const x = -51 + index * 28;
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(23, 11), structure.clone());
        sail.material.side = THREE.DoubleSide;
        sail.material.transparent = true;
        sail.material.opacity = 0.76;
        sail.position.set(x, 28 + (index % 2) * 1.6, side * 44);
        sail.rotation.set(-0.12, 0, side * (index % 2 ? -0.08 : 0.08));
        group.add(sail);
      }
    }
  } else if (scene === 'forest' || scene === 'plains') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 18; index += 1) {
        const x = -61 + index * 7.3;
        const height = 12 + (index % 4) * 2.6;
        beam(group, [0.85, height, 0.85], [x, 19 + height / 2, side * 44.5], structure);
      }
      beam(group, [132, 0.6, 2.5], [5, 34, side * 44.5], steel);
    }
  } else if (scene === 'snowcity') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 7; index += 1) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(19.2, 0.45, 9.2),
          new THREE.MeshPhysicalMaterial({
            color: 0xe5f7ff,
            emissive: primary,
            emissiveIntensity: 0.06,
            transparent: true,
            opacity: 0.62,
            roughness: 0.18,
            metalness: 0.08,
          }),
        );
        panel.position.set(-52 + index * 19, 31 + Math.abs(index - 3) * 0.8, side * 42.5);
        panel.rotation.x = side * 0.15;
        group.add(panel);
      }
    }
  } else {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 8; index += 1) {
        const x = -55 + index * 17.2;
        beam(group, [1.2, 16 + (index % 3) * 4, 1.2], [x, 28, side * 44], structure);
        beam(group, [17.5, 0.34, 0.7], [x + 7.8, 35 + (index % 2) * 2, side * 44], glow, [0, 0, index % 2 ? 0.1 : -0.1]);
      }
    }
  }

  return { primary, accent, materials: [steel, structure, glow] };
}

function disposeObject(root) {
  root.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      material.map?.dispose?.();
      material.dispose?.();
    }
    object.userData?.ownedTexture?.dispose?.();
  });
}

export function createFootballVenueIdentity({ scene, teams }) {
  const group = new THREE.Group();
  group.name = 'spectator-football-venue-identity';
  scene.add(group);
  const home = teams[0];
  const away = teams[1];
  const brand = BRAND?.getTeam?.(home.id) || {
    venue: `${home.city} Stadium`, venueLine: 'A purpose-built Cyberliga collision field.', ritual: 'The home crowd rises together.', statement: home.name,
    scene: 'megacity', kitPattern: 'grid', mark: 'pulse',
  };
  const awayBrand = BRAND?.getTeam?.(away.id) || null;
  const { primary, accent } = buildArchitecture(group, brand, home);

  const venueBoard = textBoard({
    title: brand.venue,
    kicker: `${home.code} // HOME FIELD`,
    detail: brand.statement,
    primary: home.colors.primary,
    accent: home.colors.accent,
  });
  venueBoard.geometry.dispose();
  venueBoard.geometry = new THREE.PlaneGeometry(32, 5.2);
  venueBoard.position.set(5, 7.8, -35.1);
  group.add(venueBoard);
  const venueBoardBack = venueBoard.clone();
  venueBoardBack.material = venueBoard.material.clone();
  venueBoardBack.position.z = 35.1;
  venueBoardBack.rotation.y = Math.PI;
  group.add(venueBoardBack);

  // Field-level portals keep the authored architecture in the live sideline master,
  // not only in a high beauty shot that routine snaps never reveal.
  for (const side of [-1, 1]) {
    for (let index = 0; index < 9; index += 1) {
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: index % 3 ? primary.clone().multiplyScalar(0.52) : accent.clone().multiplyScalar(0.7),
        emissive: index % 3 ? primary : accent,
        emissiveIntensity: 0.13,
        roughness: 0.48,
        metalness: 0.28,
      });
      const x = -55 + index * 15;
      beam(group, [0.5, 7.4, 0.5], [x, 4.2, side * 34.25], frameMaterial);
      beam(group, [14.2, 0.38, 0.5], [x + 7, 7.8, side * 34.25], frameMaterial);
    }
  }

  const concept = conceptBoard(home, primary);
  if (concept) {
    concept.position.set(-69.5, 15, 0);
    concept.rotation.y = Math.PI / 2;
    group.add(concept);
  }

  const ribbons = [];
  for (const side of [-1, 1]) {
    for (let index = 0; index < 30; index += 1) {
      const isHome = index % 5 !== 0;
      const ribbonMaterial = new THREE.MeshBasicMaterial({
        color: isHome ? primary : color(away.colors.primary),
        transparent: true,
        opacity: 0.18,
        toneMapped: false,
      });
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.28, 0.16), ribbonMaterial);
      ribbon.position.set(-57.5 + index * 4.25, 9.4 + (index % 3) * 0.4, side * 34.55);
      group.add(ribbon);
      ribbons.push({ mesh: ribbon, index, side, base: 0.16 + (index % 4) * 0.015 });
    }
  }

  const portalLights = [];
  for (const x of [-64, 74]) {
    for (let index = 0; index < 8; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.32, toneMapped: false });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.4, 5.4), material);
      light.position.set(x, 6.5 + index * 1.65, (index % 2 ? -1 : 1) * 27.8);
      group.add(light);
      portalLights.push({ mesh: light, index });
    }
  }

  let time = 0;
  let ritualEnergy = 0;
  let lastPhase = '';
  function update(dt, context = {}) {
    time += Math.min(0.1, Math.max(0, dt || 0));
    const phase = context.phase || '';
    if (phase !== lastPhase) {
      if (phase === 'kick' || phase === 'punt' || phase === 'live') ritualEnergy = Math.max(ritualEnergy, 0.42);
      if (phase === 'dead' && context.crowdHeat > 0.55) ritualEnergy = 1;
      lastPhase = phase;
    }
    const leverage = context.down === 3 ? 0.28 : context.down === 4 ? 0.42 : 0;
    const redZone = context.ballSpot >= 80 ? 0.22 : 0;
    ritualEnergy = Math.max(ritualEnergy - dt * 0.16, clamp((context.crowdHeat || 0) + leverage + redZone, 0, 1));
    const pattern = brand.kitPattern || 'pulse';
    for (const item of ribbons) {
      let wave;
      if (pattern === 'grid' || pattern === 'pit') wave = ((Math.floor(time * 4) + item.index) % 6 < 2) ? 1 : 0.15;
      else if (pattern === 'growth' || pattern === 'crown') wave = clamp((time * 5) % 34 - item.index + 3, 0, 1);
      else if (pattern === 'rain') wave = Math.max(0, Math.sin(time * 8 + item.index * 0.72));
      else if (pattern === 'speed' || pattern === 'flight') wave = Math.exp(-Math.pow((((time * 9 + item.index) % 30) - 15) / 4, 2));
      else wave = 0.5 + 0.5 * Math.sin(time * 5.2 + item.index * 0.42 + item.side);
      item.mesh.material.opacity = item.base + ritualEnergy * (0.18 + wave * 0.62);
      item.mesh.scale.y = 1 + ritualEnergy * wave * 1.5;
    }
    for (const item of portalLights) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6.5 - item.index * 0.6);
      item.mesh.material.opacity = 0.22 + ritualEnergy * (0.25 + pulse * 0.5);
    }
  }

  function state() {
    return {
      venue: brand.venue,
      venueLine: brand.venueLine,
      ritual: brand.ritual,
      statement: brand.statement,
      scene: brand.scene,
      pattern: brand.kitPattern,
      mark: brand.mark,
      awayVenue: awayBrand?.venue || null,
      ritualEnergy: +ritualEnergy.toFixed(2),
    };
  }

  return {
    group,
    brand,
    update,
    state,
    dispose() { scene.remove(group); disposeObject(group); },
  };
}

export function footballClubEquipmentPalette(team) {
  const brand = BRAND?.getTeam?.(team.id) || null;
  return {
    primary: color(team.colors?.primary, '#355d7b'),
    accent: color(team.colors?.accent, '#f4cf75'),
    pattern: brand?.kitPattern || 'grid',
    mark: brand?.mark || 'pulse',
    venue: brand?.venue || `${team.city} Stadium`,
  };
}
