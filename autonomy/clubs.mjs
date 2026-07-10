// CYBERLIGA's canonical city layer.
// Cities are the only geographic competition unit: no countries, national teams,
// conferences, or college programs participate in scheduling or standings.

const ROLE_ORDER = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
const NUMBERS = [1, 3, 5, 6, 8, 9, 11];
const NAME_A = [
  'AXIOM', 'BLITZ', 'CIPHER', 'COMET', 'DELTA', 'DYNAMO', 'ECHO', 'FLUX',
  'GLITCH', 'HALO', 'HELIX', 'ION', 'KAIRO', 'LUMEN', 'MATRIX', 'NEBULA',
  'NOVA', 'ONYX', 'ORBIT', 'PRISM', 'PULSE', 'QUASAR', 'RAZOR', 'RELAY',
  'RIFT', 'SOLAR', 'SPECTRA', 'SYNTH', 'TESLA', 'TITAN', 'VANTA', 'VEKTOR',
  'VOLT', 'ZENITH', 'ZERO', 'ZEPHYR',
];
const NAME_B = ['-2', '-7', '-9', '-X', ' JR', ' PRIME', ' ARC', ' ONE'];

function hash(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function generatedRoster(clubId) {
  const h = hash(clubId);
  return ROLE_ORDER.map((role, i) => ({
    id: `${clubId}-p${i + 1}`,
    name: NAME_A[(h + i * 11) % NAME_A.length] + NAME_B[(h >>> (i % 16)) % NAME_B.length],
    number: NUMBERS[i],
    role,
    pace: 54 + ((h >>> (i % 20)) % 43),
    control: 52 + ((h >>> ((i + 5) % 20)) % 45),
    finishing: role === 'FWD' ? 70 + ((h >>> ((i + 9) % 20)) % 27) : 40 + ((h >>> ((i + 9) % 20)) % 43),
    defending: role === 'DEF' || role === 'GK' ? 70 + ((h >>> ((i + 13) % 20)) % 27) : 38 + ((h >>> ((i + 13) % 20)) % 43),
  }));
}

function canonicalRoster(clubId, names) {
  return ROLE_ORDER.map((role, i) => ({
    id: `${clubId}-p${i + 1}`,
    name: names[i], number: NUMBERS[i], role,
    pace: role === 'FWD' ? 86 - i : role === 'GK' ? 58 : 72 + (i % 4) * 3,
    control: role === 'MID' || role === 'FWD' ? 84 - (i % 3) * 2 : 69 + i,
    finishing: role === 'FWD' ? 88 - (i % 2) * 4 : 48 + i * 3,
    defending: role === 'DEF' || role === 'GK' ? 86 - (i % 2) * 3 : 46 + i * 2,
  }));
}

const CITY_DEFS = [
  ['neon-fc', 'Tokyo', 35.6762, 139.6503, 'NEON FC', 'NFC', '#00e5ff', 'Tokyo’s original autonomous football signal.'],
  ['volt-utd', 'Berlin', 52.5200, 13.4050, 'VOLT UTD', 'VLT', '#ff2d78', 'Vertical pressure and hard-edged nights under permanent floodlights.'],
  ['grid-royals', 'London', 51.5074, -0.1278, 'GRID ROYALS', 'GRD', '#ffc24d', 'The old capital’s patient and merciless machine dynasty.'],
  ['astra-nova', 'São Paulo', -23.5505, -46.6333, 'ASTRA NOVA', 'AST', '#8a5cff', 'Street-born movement and impossible attacking angles.'],
  ['empire-circuit', 'New York', 40.7128, -74.0060, 'EMPIRE CIRCUIT', 'NYC', '#d8ff3e', 'Five boroughs wired into one unforgiving counterattack.'],
  ['solar-eleven', 'Los Angeles', 34.0522, -118.2437, 'SOLAR ELEVEN', 'LAX', '#ff7a45', 'Speed, spectacle, and late winners on the western grid.'],
  ['altitude-club', 'Mexico City', 19.4326, -99.1332, 'ALTITUDE CLUB', 'CDM', '#38e28f', 'A suffocating press built for the highest nights.'],
  ['northstar-union', 'Toronto', 43.6532, -79.3832, 'NORTHSTAR UNION', 'TOR', '#f1f5ff', 'Cold structure and clean transitions through the winter.'],
  ['plata-athletic', 'Buenos Aires', -34.6037, -58.3816, 'PLATA ATHLETIC', 'BUE', '#76cfff', 'Every touch is contested and every home match feels personal.'],
  ['guanabara-fc', 'Rio de Janeiro', -22.9068, -43.1729, 'GUANABARA FC', 'RIO', '#4dff89', 'Fluid rotations with the bay-side grandstand at full voice.'],
  ['sol-real', 'Madrid', 40.4168, -3.7038, 'SOL REAL', 'MAD', '#fff09a', 'White-hot possession with absolute control of the center.'],
  ['barcelona-wave', 'Barcelona', 41.3874, 2.1686, 'BARCELONA WAVE', 'BCN', '#ff4d9d', 'Passing triangles that rupture without warning.'],
  ['isartor-fc', 'Munich', 48.1351, 11.5820, 'ISARTOR FC', 'MUC', '#6aa8ff', 'The league’s most disciplined out-of-possession machine.'],
  ['foundry-city', 'Manchester', 53.4808, -2.2426, 'FOUNDRY CITY', 'MAN', '#ff6a4a', 'Rain, iron, and direct football hammered into shape.'],
  ['lumiere-sc', 'Paris', 48.8566, 2.3522, 'LUMIÈRE SC', 'PAR', '#c8a2ff', 'Elegant patterns turning into controlled final-third chaos.'],
  ['lagos-current', 'Lagos', 6.5244, 3.3792, 'LAGOS CURRENT', 'LOS', '#3effb5', 'The fastest transition side in the city league.'],
  ['meridian-fc', 'Cairo', 30.0444, 31.2357, 'MERIDIAN FC', 'CAI', '#ffcf62', 'One interception becomes eighty meters of danger.'],
  ['bosphorus-utd', 'Istanbul', 41.0082, 28.9784, 'BOSPHORUS UTD', 'IST', '#ff5353', 'Two roaring home ends and no neutral territory.'],
  ['rift-valley-fc', 'Nairobi', -1.2921, 36.8219, 'RIFT VALLEY FC', 'NBO', '#6dff66', 'Endless running power behind the highest defensive line.'],
  ['highveld-fc', 'Johannesburg', -26.2041, 28.0473, 'HIGHVELD FC', 'JHB', '#ffd447', 'Vertical football that becomes a track meet after the hour.'],
  ['monsoon-city', 'Mumbai', 19.0760, 72.8777, 'MONSOON CITY', 'BOM', '#ff8a38', 'Compact combinations moving at wet-season tempo.'],
  ['seoul-kinetics', 'Seoul', 37.5665, 126.9780, 'SEOUL KINETICS', 'SEL', '#69a7ff', 'Synchronized pressure executed at machine speed.'],
  ['straits-athletic', 'Singapore', 1.3521, 103.8198, 'STRAITS ATHLETIC', 'SIN', '#ff6658', 'The smallest market running the densest football operation.'],
  ['harbour-eleven', 'Sydney', -33.8688, 151.2093, 'HARBOUR ELEVEN', 'SYD', '#5de7ff', 'A fearless club attacking as if the ocean were closing in.'],
];

const CANONICAL_NAMES = {
  'neon-fc': ['OKAFOR-9', 'VEKTOR', 'HALCYON', 'SYNTH', 'AXIOM', 'RAZOR', 'PRISM'],
  'volt-utd': ['TESLA JR', 'CIPHER', 'ONYX', 'GLITCH', 'BLITZ', 'NOVA', 'PULSE'],
  'grid-royals': ['KILOWATT', 'MAINFRAME', 'TURBINE', 'DYNAMO', 'CIRCUIT', 'VANTA', 'HELIX'],
  'astra-nova': ['ORBIT', 'QUASAR', 'ZENITH', 'NEBULA', 'COMET', 'STARFALL', 'LUMEN'],
};

export const CLUBS = Object.freeze(CITY_DEFS.map(([id, city, lat, lon, name, code, color, story], index) => Object.freeze({
  id, city, lat, lon, name, code, color, story,
  seedRating: 78 - Math.floor(index / 4) + (hash(id) % 8),
  rating: 78 - Math.floor(index / 4) + (hash(id) % 8),
  roster: Object.freeze(CANONICAL_NAMES[id] ? canonicalRoster(id, CANONICAL_NAMES[id]) : generatedRoster(id)),
})));

export const CLUB_BY_ID = new Map(CLUBS.map(club => [club.id, club]));
