(function bootstrapCyberligaBrand(root) {
  'use strict';

  var LEAGUES = {
    soccer: {
      code: 'SCL', name: 'THE COMMON GROUND', short: 'COMMON GROUND',
      hero: 'assets/world/league-heroes/soccer.jpg', accent: '#f05b67', arena: 'index.html',
      thesis: 'Eight cities. One uninterrupted field. Football built from local rituals and played on a shared global clock.',
      architecture: 'Civic bowls, transit plazas and terraces that make the city part of the match.',
      broadcast: 'Continuous pressure · four channels · no dead air'
    },
    'american-football': {
      code: 'AMF', name: 'THE SUNDAY ANIMAL', short: 'SUNDAY ANIMAL',
      hero: 'assets/world/league-heroes/american-football.jpg', accent: '#e67b2f', arena: 'football.html',
      thesis: 'A collision league of authored systems, regional obsessions and one full-field consequence on every snap.',
      architecture: 'Industrial cathedrals with long sightlines, heavy roofs and entrances that shake the structure.',
      broadcast: 'Route geometry · consequence · four live fields'
    },
    basketball: {
      code: 'HPS', name: 'THE HIGH ROOM', short: 'HIGH ROOM',
      hero: 'assets/world/league-heroes/basketball.jpg', accent: '#e98555', arena: 'hoops.html',
      thesis: 'The vertical league: eight dense cities, compressed courts and possessions that turn into weather.',
      architecture: 'Arenas stacked into neighborhoods, towers and transit halls instead of isolated parking lots.',
      broadcast: 'Violent transitions · high leverage · four courts'
    },
    hockey: {
      code: 'ICE', name: 'THE COLD ARGUMENT', short: 'COLD ARGUMENT',
      hero: 'assets/world/league-heroes/hockey.jpg', accent: '#69d1dc', arena: 'hockey.html',
      thesis: 'Cold-city hockey where material, weather and crowd acoustics turn every home rink into a different problem.',
      architecture: 'Timber, basalt, glass and ice shaped by climate rather than copied from a universal arena plan.',
      broadcast: 'Compressed space · sudden death · four rinks'
    },
    baseball: {
      code: 'BSB', name: 'THE LONG AFTERNOON', short: 'LONG AFTERNOON',
      hero: 'assets/world/league-heroes/baseball.jpg', accent: '#e3aa52', arena: 'baseball.html',
      thesis: 'Eight ballparks built for patience, civic memory and the instant when an entire city follows one white ball.',
      architecture: 'Open parks shaped by coastlines, workshops, mountains, trees and the streets beyond the wall.',
      broadcast: 'One pitch at a time · long memory · four diamonds'
    }
  };

  // id, venue, venue description, crowd ritual, identity line, mark, scene, kit pattern
  var TEAM_ROWS = [
    ['tokyo-paper-cranes','THE FOLD','A pleated translucent roof opens like two paper wings above a rail-linked bowl.','At walkout, every section raises one angular white wing; the whole stadium folds in sequence.','Precision becomes weightless.','fold','megacity','fold'],
    ['osaka-lanterns','LANTERN YARD','Stacked warm-light terraces turn a compact neighborhood ground into a vertical festival.','A rolling amber blackout travels stand to stand before the first touch.','Draw them close. Leave in a flash.','lantern','megacity','lantern'],
    ['berlin-bramble','THE THICKET','A black-steel rail-yard fortress wrapped in living thorn screens and standing terraces.','The south wall stays dark until tackles trigger thin green lines through the terrace.','Nothing clean gets through.','thorn','industrial','bramble'],
    ['london-chalk-horses','THE CUT','A sunken white-concrete ground scored with hand-drawn lines and a severe slate roof.','Supporters redraw one enormous horse across the end stand before every derby.','Leave a mark. Hold the line.','horse','oldstone','chalk'],
    ['sao-paulo-mango-teeth','THE BITE','A steep vertical concrete bowl with a serrated canopy and streets visible through every corner.','Jagged yellow flags snap in percussion-led waves after each recovery.','Sweet color. Hard edge.','bite','megacity','serrated'],
    ['valparaiso-salt-kites','THE UPDRAFT','A cliff-tier stadium hung between funicular lines, harbor cable and Pacific sky.','Long cyan ribbons rise from the lowest terrace to the roof as the team advances.','Use the wind. Never fight it.','kite','harbor','tension'],
    ['lagos-river-drums','THE CURRENT','A waterside ground of copper screens, shaded decks and lagoon-facing supporter walls.','Concentric light pulses move outward from the home end, authored to local match rhythm.','Change the pace of the whole room.','pulse','harbor','pulse'],
    ['marrakech-sun-carpets','THE LOOM','A mineral-red arena beneath a vast cobalt lattice that throws moving shade across the pitch.','The roof and crowd weave one saffron geometric signal from eight independent sections.','Space is something you weave.','weave','desert','weave'],

    ['new-york-brownstones','THE BLOCK','A compressed brick arena inserted between towers, stoops and elevated service walks.','Window grids illuminate floor by floor until the entire block flashes on the opening score.','Own the steps. Own the room.','stoop','megacity','steps'],
    ['toronto-lake-effect','THE FRONT','A low glass arena whose outer skin disappears into controlled frost and lake mist.','The bowl vanishes into whiteout before the home five emerge through one blue line.','Visibility is a privilege.','squall','snowcity','drift'],
    ['manila-monsoons','THE DOWNPOUR','A deep-canopy arena with open humid concourses and rain channels lit beneath the roof.','Ribbon rain falls from the rafters; a single thunder clap cues the defensive stand.','Pressure arrives all at once.','monsoon','tropic','rain'],
    ['melbourne-velvet-ants','THE COLONY','A black laneway arena with crimson fabric walls and tightly stacked corner decks.','Sections swarm on cue, tiny blocks of red light converging at center court.','Small gaps. Massive consequence.','ant','megacity','swarm'],
    ['dakar-baobabs','THE CANOPY','Branching structural columns hold a broad solar roof over a warm, open-sided court.','Gold light grows from the lower bowl upward like a canopy filling out after rain.','Root first. Reach everywhere.','baobab','coastal','branch'],
    ['medellin-condors','ALTURA ARENA','A steep valley-facing bowl whose roofline opens toward the city lights and mountain walls.','One amethyst ribbon circles higher each possession, then dives on the break.','Circle. Read. Descend.','condor','mountain','spiral'],
    ['belgrade-beehive','HIVE HALL','A brutalist hexagonal arena beside the river, dense with amber glass and raw concrete.','Each section hums alone until the shot clock drops under five and the room becomes one note.','Every angle has help.','hive','oldstone','hex'],
    ['istanbul-teacups','THE STRAIT','Two opposing waterfront stands are joined above the court by copper-lit bridge decks.','The ends answer each other across the floor before meeting in one center-court roar.','Cross the space before it closes.','crossing','harbor','cross'],

    ['montreal-sugar-maples','CABANE 21','A timber-and-ice arena with lacquer-red ribs and a winter market wrapped around the concourse.','Goal light crystallizes outward from the net until the entire roof becomes a red leaf.','Make the cold feel close.','maple','snowcity','crystal'],
    ['reykjavik-lava-loons','THE RIFT','A black basalt rink heated by geothermal galleries and cut with glacial blue seams.','Steam shutters open after each hit; orange fracture light races under the stands.','Stillness breaks without warning.','basalt','volcanic','fracture'],
    ['stockholm-wool-wolves','PACKHOUSE','A Baltic arena under a woven grey roof, quiet outside and acoustically dense within.','Scarves create a moving wolf silhouette that closes around center ice.','Soft surface. Pack pressure.','wolf','snowcity','woven'],
    ['helsinki-birch-knots','THE RING','Pale birch hoops circle the rink and overlap into a warm geometric ceiling.','Four supporter arcs rotate in opposite directions, then lock together at puck drop.','Tight turns hold.','knot','snowcity','rings'],
    ['sapporo-snow-lanterns','SNOWLIGHT DOME','A white arena of oiled-paper light boxes floating above deep-blue ice terraces.','Warm lanterns descend through artificial snowfall before the opening faceoff.','Warm light. Cold finish.','snowlantern','snowcity','snow'],
    ['anchorage-tundra-drums','THE SOUND','A low horizon rink on the inlet, wrapped by ochre acoustic panels and aurora glass.','Low-frequency light beats travel beneath the seats without borrowing a generic cultural motif.','Hear the pressure before it arrives.','horizon','arctic','horizon'],
    ['prague-river-golems','THE KILN','A vaulted clay-and-stone arena reached through one monumental river gate.','The entrance opens in three heavy movements; brass light reveals the team one line at a time.','Built heavy. Released fast.','golem','oldstone','block'],
    ['tromso-whale-choir','THE CHORUS','An acoustic harbor rink beneath an aurora roof shaped by one long rising curve.','The crowd holds a low harmonic under live play and lifts it only when the puck enters the zone.','Move as one long note.','whale','arctic','wave'],

    ['mexico-city-alebrijes','EL TALLER','A vast workshop ballpark of carved dark stone, bright inlays and an open mountain horizon.','Eight commissioned creature patterns wake around the park, one after every scoring play.','No single shape tells the whole story.','alebrije','mountain','mosaic'],
    ['havana-sugar-kings','EL CENTRAL','A sun-faded colonnaded park where cane-green steel meets warm Caribbean stone.','A short original brass-and-clave scoring phrase brings the grandstand to its feet.','Patience, then the snap.','cane','coastal','cane'],
    ['seoul-moon-jars','MOON JAR PARK','A quiet porcelain-white park under an indigo ceramic roof beside the river.','The stadium begins in calm white and fractures into seal red when a rally starts.','Hold the form until it breaks.','jar','megacity','porcelain'],
    ['kyoto-lucky-cats','BELL PARK','An intimate vermilion-and-timber park framed by a restrained modern garden.','One elegant beckoning motion travels across the grandstand after consecutive hits.','Invite the pitch you want.','cat','oldstone','bell'],
    ['santo-domingo-coco-bats','EL PALMAR','A deep-canopy night park with cacao walls, palm shade and a low open outfield.','Wing shadows sweep the warning track as the home closer enters.','The night belongs to the patient.','bat','tropic','wing'],
    ['san-juan-coquis','LA LLUVIA','A rainforest-green park under a rain-sheltering roof that keeps the night air visible.','An original two-note chorus answers every strike without imitating a literal animal call.','Small signal. Whole city.','coqui','tropic','seam'],
    ['cape-town-jackals','CAPE GATE','A wind-shaped ochre park whose open wall frames mountain, harbor and moving cloud.','A long-eared light silhouette races the outfield wall on extra-base hits.','Track everything. Waste nothing.','jackal','coastal','speed'],
    ['auckland-kauri','KAURI FIELD','A timber-canopy ballpark built around monumental columns and slow amber light.','The canopy gains one glowing ring each inning until the ninth fills the roof.','Grow into the game.','kauri','forest','rings'],

    ['new-orleans-bayou-kings','THE CROWN','A cypress-green basin stadium with deep purple galleries and weathered brass edges.','A locally authored brass procession carries the team from the concourse to the field.','Make ceremony hit hard.','cypress','wetland','crown'],
    ['atlanta-peaches','THE PIT','A severe black-steel stadium cut by one luminous peach seam around the lower bowl.','The seam closes into a hard center-line pulse as the defense takes the field.','Soft name. Hard downhill.','pit','megacity','pit'],
    ['chicago-stockyards','THE YARDS','A rail-and-gantry stadium of oxide steel, packing-house cream and broad industrial glass.','Gate lights slam shut section by section on third down, honoring labor without slaughter imagery.','Work the edge. Close the gate.','gate','industrial','grid'],
    ['minneapolis-snow-geese','NORTH FLIGHT','An enclosed white stadium beneath moving feather-like roof panels and lake-blue light.','The roof panels align into a migrating formation before the opening kick.','Formation makes distance.','goose','snowcity','flight'],
    ['dallas-prairie-hounds','THE RUN','A long, low sienna stadium with horizon-wide boards and exposed wheat-toned structure.','Every breakaway accelerates a light hound around the full perimeter.','See daylight. Take all of it.','hound','plains','speed'],
    ['oakland-redwoods','THE GROVE','A monumental field enclosed by vertical redwood-toned columns and stacked green terraces.','Supporter levels illuminate upward like a canopy after every defensive stop.','Stand tall. Close together.','redwood','forest','growth'],
    ['seattle-rain-dogs','RAINHOUSE','A translucent-roof stadium where controlled runoff becomes part of the night presentation.','Brass light races each visible rain channel while the crowd holds a deep blue field.','Weather is home field.','raindog','wetland','rain'],
    ['honolulu-wave-riders','THE BREAK','An open-air Pacific stadium beneath a flowing sail roof, designed without generic tiki language.','A double wave crosses both sidelines, built with Hawaiʻi-based art direction.','Read the break. Commit.','wave','tropic','wave']
  ];

  var TEAMS = {};
  var DISPLAY = {
    'sao-paulo-mango-teeth': {displayCity:'São Paulo',displayName:'SÃO PAULO MANGO TEETH'},
    'valparaiso-salt-kites': {displayCity:'Valparaíso',displayName:'VALPARAÍSO SALT KITES'},
    'medellin-condors': {displayCity:'Medellín',displayName:'MEDELLÍN CONDORS'},
    'montreal-sugar-maples': {displayCity:'Montréal',displayName:'MONTRÉAL SUGAR MAPLES'},
    'reykjavik-lava-loons': {displayCity:'Reykjavík',displayName:'REYKJAVÍK LAVA LOONS'},
    'tromso-whale-choir': {displayCity:'Tromsø',displayName:'TROMSØ WHALE CHOIR'},
    'san-juan-coquis': {displayName:'SAN JUAN COQUÍS'}
  };
  TEAM_ROWS.forEach(function (row, index) {
    TEAMS[row[0]] = {
      id: row[0], venue: row[1], venueLine: row[2], ritual: row[3], statement: row[4],
      mark: row[5], scene: row[6], kitPattern: row[7], order: index
    };
    if (DISPLAY[row[0]]) Object.assign(TEAMS[row[0]], DISPLAY[row[0]]);
  });

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
    });
  }

  function hash(value) {
    var text = String(value || '');
    var result = 2166136261 >>> 0;
    for (var index = 0; index < text.length; index += 1) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function markMarkup(mark, stroke, fill) {
    var s = esc(stroke), f = esc(fill);
    var common = 'stroke="' + s + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"';
    var marks = {
      fold:'<path ' + common + ' d="M18 66 48 20l8 31 28-22-18 47-24-15Z"/><path d="m48 20 8 31-14 10" fill="' + f + '"/>',
      lantern:'<rect x="28" y="24" width="44" height="52" rx="10" ' + common + '/><path ' + common + ' d="M38 16h24M37 84h26M32 46h36"/><circle cx="50" cy="56" r="8" fill="' + f + '"/>',
      thorn:'<circle cx="50" cy="50" r="25" ' + common + '/><path ' + common + ' d="m25 39-12-8m18 1-2-14m42 14 11-9m-7 17 13 3m-57 25-9 10m49-10 10 9"/>',
      horse:'<path ' + common + ' d="M20 73c18-4 28-17 30-38l14-13 16 8-10 11 8 11-16 18-25-4Z"/><circle cx="65" cy="35" r="3" fill="' + f + '"/>',
      bite:'<path ' + common + ' d="M19 51c0-20 13-33 32-33 20 0 33 13 33 33S70 83 51 83 19 71 19 51Z"/><circle cx="81" cy="35" r="9" fill="#080a0d"/><path ' + common + ' d="m32 68 36-34M34 36l34 32"/>',
      kite:'<path ' + common + ' d="m50 15 31 35-31 29-31-29Z"/><path ' + common + ' d="M50 15v64m0 0c-11 5 11 8 0 14"/><circle cx="50" cy="50" r="6" fill="' + f + '"/>',
      pulse:'<path ' + common + ' d="M13 51h16l8-19 12 38 11-29 8 10h19"/><circle cx="50" cy="50" r="34" stroke="' + s + '" stroke-width="2" fill="none" opacity=".35"/>',
      weave:'<path ' + common + ' d="M20 27h60v46H20zM20 43h60M20 59h60M36 27v46M52 27v46M68 27v46"/><path d="M20 43h60M36 27v46" stroke="' + f + '" stroke-width="7" opacity=".8"/>',
      stoop:'<path ' + common + ' d="M18 75h64V26H51v13H39v13H28v12H18"/><path ' + common + ' d="M55 75V49h17v26"/>',
      squall:'<path ' + common + ' d="M17 41c8-17 27-23 45-15 10 4 17 13 20 24-9-6-19-7-29-2-12 6-23 4-36-7Zm12 20-7 13m26-13-7 17m28-17-8 14"/>',
      monsoon:'<path ' + common + ' d="M17 42c20-22 47-22 66 0-14-4-25 0-33 11-8-11-19-15-33-11Zm33 11v28M27 66h46"/>',
      ant:'<circle cx="50" cy="34" r="10" ' + common + '/><ellipse cx="50" cy="56" rx="13" ry="17" ' + common + '/><ellipse cx="50" cy="78" rx="17" ry="10" ' + common + '/><path ' + common + ' d="M40 48 24 36m36 12 16-12M37 61 20 62m43-1 17 1M36 75 22 86m42-11 14 11"/>',
      baobab:'<path ' + common + ' d="M46 83V51L27 35m22 18 3-38m-3 38 22-26M34 28l-9-11m44 10 8-13M23 36l-8 1m56-10 12 4M37 83h28"/>',
      condor:'<path ' + common + ' d="M13 54c17-25 30-29 37-8 7-21 20-17 37 8-18-5-28 1-37 23-9-22-19-28-37-23Z"/><circle cx="50" cy="44" r="5" fill="' + f + '"/>',
      hive:'<path ' + common + ' d="m50 17 25 14v38L50 83 25 69V31Z"/><path ' + common + ' d="m25 31 25 15 25-15M50 46v37"/><circle cx="50" cy="46" r="7" fill="' + f + '"/>',
      crossing:'<path ' + common + ' d="M14 68c15-36 31-36 36 0 5-36 21-36 36 0M14 35h72"/><circle cx="50" cy="35" r="6" fill="' + f + '"/>',
      maple:'<path ' + common + ' d="m50 13 8 17 13-8-3 18 16 4-14 12 8 15-21-5-7 21-7-21-21 5 8-15-14-12 16-4-3-18 13 8Z"/>',
      basalt:'<path ' + common + ' d="m20 69 9-36 19-16 12 23 21 8-14 31-24-9Z"/><path ' + common + ' d="m29 33 22 19 9-12m-9 12 16 27"/>',
      wolf:'<path ' + common + ' d="m22 25 22 12 6-19 7 19 21-12-5 39-23 20-23-20Z"/><path ' + common + ' d="m37 54 13 9 13-9M43 47h1m12 0h1"/>',
      knot:'<path ' + common + ' d="M50 20c25 0 25 30 0 30S25 80 50 80s25-30 0-30-25-30 0-30Z"/>',
      snowlantern:'<rect x="28" y="24" width="44" height="52" rx="7" ' + common + '/><path ' + common + ' d="M50 32v36M34 50h32m-28-12 24 24m0-24L38 62"/>',
      horizon:'<path ' + common + ' d="M14 58h72M22 58c6-25 17-37 28-37s22 12 28 37M26 70h48"/><circle cx="50" cy="58" r="6" fill="' + f + '"/>',
      golem:'<path ' + common + ' d="M30 25h40v20h10v36H20V45h10Zm9 9h3m16 0h3M36 58h28"/><rect x="43" y="64" width="14" height="17" fill="' + f + '"/>',
      whale:'<path ' + common + ' d="M15 55c14-22 37-27 61-13l11-10-2 22 2 18-12-11C47 74 28 70 15 55Z"/><circle cx="62" cy="46" r="3" fill="' + f + '"/>',
      alebrije:'<path ' + common + ' d="m18 64 12-36 19 13 15-21 18 26-11 32-25-7Z"/><path ' + common + ' d="M30 28 46 71m3-30 22 37M18 64l64-18"/>',
      cane:'<path ' + common + ' d="M32 80V29m18 51V19m18 61V33M24 35l8-10 8 10m2-10 8-10 8 10m2 14 8-10 8 10"/><path d="M26 68h48" stroke="' + f + '" stroke-width="7"/>',
      jar:'<path ' + common + ' d="M38 20h24m-20 0c2 10-15 20-15 39 0 18 10 25 23 25s23-7 23-25c0-19-17-29-15-39"/><path ' + common + ' d="M33 55h34"/>',
      cat:'<path ' + common + ' d="m28 33 10-14 12 10 13-10 9 15v30c0 13-10 20-22 20s-22-7-22-20Z"/><path ' + common + ' d="M39 49h1m20 0h1M42 64c6 5 10 5 16 0"/><circle cx="50" cy="58" r="4" fill="' + f + '"/>',
      bat:'<path ' + common + ' d="M14 34c14 0 24 7 36 22 12-15 22-22 36-22-2 15-7 29-20 42l-16-9-16 9C21 63 16 49 14 34Z"/><path ' + common + ' d="m43 43 7-17 7 17"/>',
      coqui:'<path ' + common + ' d="M27 58c0-17 10-29 23-29s23 12 23 29c0 15-10 25-23 25S27 73 27 58Zm-3-5-11-12m63 12 11-12M33 76 20 86m47-10 13 10"/><circle cx="41" cy="49" r="4" fill="' + f + '"/><circle cx="59" cy="49" r="4" fill="' + f + '"/>',
      jackal:'<path ' + common + ' d="m26 19 18 17 6-15 7 15 17-17-5 46-19 20-19-20Z"/><path ' + common + ' d="M38 55h1m22 0h1M43 68h14"/>',
      kauri:'<path ' + common + ' d="M50 15c18 12 27 30 23 53-3 15-12 18-23 18S30 83 27 68c-4-23 5-41 23-53Z"/><path ' + common + ' d="M50 30v56m0-42c-9 1-14 5-18 10m18 4c9 1 14 5 18 10"/>',
      cypress:'<path ' + common + ' d="M50 15c16 17 22 32 15 44h13L65 82H35L22 59h13c-7-12-1-27 15-44Z"/><path ' + common + ' d="M50 26v56"/>',
      pit:'<path ' + common + ' d="M18 50c0-22 14-34 32-34s32 12 32 34-14 34-32 34-32-12-32-34Z"/><path ' + common + ' d="M34 21c4 17 4 41 0 58m32-58c-4 17-4 41 0 58"/><circle cx="50" cy="50" r="8" fill="' + f + '"/>',
      gate:'<path ' + common + ' d="M19 80V28h62v52M30 80V42h40v38M40 80V55h20v25"/><path d="M19 28h62" stroke="' + f + '" stroke-width="8"/>',
      goose:'<path ' + common + ' d="M17 63c17-29 33-34 47-18 4-17 10-25 19-30-4 16-3 29 4 40-13 3-22 11-28 26-9-17-22-23-42-18Z"/>',
      hound:'<path ' + common + ' d="M14 59h18l14-22 13 8 12-5 15 9-12 8 3 17-13-10-18 8-15-5-17 8 8-16Z"/><circle cx="70" cy="48" r="3" fill="' + f + '"/>',
      redwood:'<path ' + common + ' d="M50 13 30 40h12L25 66h17L32 84h36L58 66h17L58 40h12Z"/><path ' + common + ' d="M50 31v53"/>',
      raindog:'<path ' + common + ' d="m29 27 14 10 7-15 8 15 13-10 2 36-23 21-23-21Z"/><path ' + common + ' d="M18 21 12 34m69-13 6 13M17 69 9 82m72-13 8 13"/>',
      wave:'<path ' + common + ' d="M11 60c13-27 25-27 39 0 14-27 26-27 39 0M11 74c13-15 25-15 39 0 14-15 26-15 39 0"/>'
    };
    return marks[mark] || marks.pulse;
  }

  function framePath(index) {
    var frames = [
      '<circle cx="50" cy="50" r="45"/>',
      '<path d="M50 5 90 25v50L50 95 10 75V25Z"/>',
      '<path d="M15 11h70l9 20-8 51-36 13-36-13-8-51Z"/>',
      '<path d="M50 5 95 50 50 95 5 50Z"/>'
    ];
    return frames[index % frames.length];
  }

  function crestSvg(team, options) {
    options = options || {};
    var brand = TEAMS[team.id] || {mark:'pulse'};
    var primary = options.primary || team.colors.primary;
    var secondary = options.secondary || team.colors.secondary;
    var accent = options.accent || team.colors.accent;
    var frame = framePath(hash(team.id) % 4);
    return '<svg class="brand-crest" viewBox="0 0 100 100" role="img" aria-label="' + esc(team.name) + ' crest" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="cg-' + esc(team.id) + '" x1="0" y1="0" x2="1" y2="1"><stop stop-color="' + esc(primary) + '"/><stop offset="1" stop-color="' + esc(accent) + '"/></linearGradient></defs>' +
      '<g fill="#07090b" stroke="url(#cg-' + esc(team.id) + ')" stroke-width="3">' + frame + '</g>' +
      '<g transform="translate(14 12) scale(.72)">' + markMarkup(brand.mark, secondary, accent) + '</g>' +
      '<rect x="28" y="79" width="44" height="13" rx="6.5" fill="#07090b" stroke="' + esc(primary) + '" stroke-width="1.5"/>' +
      '<text x="50" y="88.5" text-anchor="middle" fill="' + esc(secondary) + '" font-family="Arial,Helvetica,sans-serif" font-size="8.5" font-weight="900" letter-spacing="1.2">' + esc(team.code) + '</text></svg>';
  }

  function kitColors(team, variant) {
    if (variant === 'away') return {base:team.colors.secondary, trim:team.colors.primary, flash:team.colors.accent, ink:'#07090b'};
    if (variant === 'night') return {base:'#090b0e', trim:team.colors.primary, flash:team.colors.accent, ink:team.colors.secondary};
    return {base:team.colors.primary, trim:team.colors.secondary, flash:team.colors.accent, ink:'#07090b'};
  }

  function kitForm(sportId) {
    if (sportId === 'basketball') return {
      path:'M106 40 128 24h64l22 16 25 69-33 12-16-38v234H130V83l-16 38-33-12Z',
      trim:'M127 25c3 29 63 29 66 0M130 83c-11-6-19-20-24-43m84 43c11-6 19-20 24-43M130 294h60'
    };
    if (sportId === 'hockey') return {
      path:'M86 44 124 24h72l38 20 76 74-45 61-31-29v167H86V150l-31 29-45-61Z',
      trim:'M123 25c3 31 71 31 74 0M86 150l-47-45m195 45 47-45M88 294h144'
    };
    if (sportId === 'american-football') return {
      path:'M73 55 121 25h78l48 30 66 45-37 72-39-22v167H83V150l-39 22-37-72Z',
      trim:'M120 26c3 31 77 31 80 0M83 150l-52-38m206 38 52-38M85 294h150M61 64h198'
    };
    if (sportId === 'baseball') return {
      path:'M84 45 124 25h72l40 20 64 39-34 80-32-17v170H86V147l-32 17-34-80Z',
      trim:'M123 26c2 31 72 31 74 0M160 44v273M86 147l-45-26m193 26 45-26M88 294h144'
    };
    return {
      path:'M84 45 124 25h72l40 20 64 39-34 80-32-17v170H86V147l-32 17-34-80Z',
      trim:'M123 26c2 31 72 31 74 0M86 147l-45-26m193 26 45-26M88 294h144'
    };
  }

  function kitPattern(pattern, color) {
    var c = esc(color);
    var patterns = {
      fold:'<path d="m52 90 108 64-83 96m192-160-109 64 84 96" stroke="' + c + '" stroke-width="13" fill="none" opacity=".55"/>',
      lantern:'<path d="M85 82v190m150-190v190M55 138h210M55 220h210" stroke="' + c + '" stroke-width="7" opacity=".42"/>',
      bramble:'<path d="M30 260c70-18 54-130 130-92s58-74 130-93" stroke="' + c + '" stroke-width="12" fill="none" opacity=".55"/>',
      chalk:'<path d="M38 118h244M38 150h168M38 182h220" stroke="' + c + '" stroke-width="5" stroke-dasharray="22 12" opacity=".45"/>',
      serrated:'<path d="M26 248 64 96l24 26 24-30 24 31 24-32 25 32 24-30 24 30 25-28 37 153" fill="' + c + '" opacity=".38"/>',
      tension:'<path d="m40 245 120-160 120 160M65 245l95-120 95 120" stroke="' + c + '" stroke-width="6" fill="none" opacity=".5"/>',
      pulse:'<path d="M26 188h62l20-60 35 111 31-87 20 36h100" stroke="' + c + '" stroke-width="12" fill="none" opacity=".56"/>',
      weave:'<path d="M40 105h240M40 145h240M40 185h240M40 225h240M85 74v204M135 74v204M185 74v204M235 74v204" stroke="' + c + '" stroke-width="5" opacity=".42"/>',
      steps:'<path d="M42 230h48v-35h48v-35h48v-35h48V90h46" stroke="' + c + '" stroke-width="12" fill="none" opacity=".52"/>',
      drift:'<path d="M27 152c56-34 95 30 142 0s84-4 124 20M29 203c55-33 92 28 139 0s84-4 123 20" stroke="' + c + '" stroke-width="9" fill="none" opacity=".42"/>',
      rain:'<path d="m68 84-31 81m82-81-31 81m82-81-31 81m82-81-31 81m82-81-31 81" stroke="' + c + '" stroke-width="10" opacity=".48"/>',
      swarm:'<g fill="' + c + '" opacity=".58">' + Array.from({length:24},function(_,i){return '<circle cx="'+(48+(i*47)%220)+'" cy="'+(92+(i*31)%154)+'" r="'+(3+(i%4))+'"/>';}).join('') + '</g>',
      branch:'<path d="M160 276V120m0 54-74-68m74 78 76-78m-76 36-48-67m48 71 48-75" stroke="' + c + '" stroke-width="12" fill="none" opacity=".45"/>',
      spiral:'<path d="M160 190c-55-55 70-104 92-24 24 85-100 126-169 55" stroke="' + c + '" stroke-width="12" fill="none" opacity=".5"/>',
      hex:'<path d="m160 75 48 28v55l-48 28-48-28v-55Zm-48 83-48 28v55l48 28 48-28v-55Zm96 0 48 28v55l-48 28-48-28v-55Z" stroke="' + c + '" stroke-width="6" fill="none" opacity=".48"/>',
      cross:'<path d="M35 235c50-170 100-170 125 0 25-170 75-170 125 0M38 112h244" stroke="' + c + '" stroke-width="10" fill="none" opacity=".48"/>',
      crystal:'<path d="m160 68 42 72-42 72-42-72Zm-84 61 42 72-42 72-42-72Zm168 0 42 72-42 72-42-72Z" stroke="' + c + '" stroke-width="7" fill="none" opacity=".45"/>',
      fracture:'<path d="m64 70 61 68-31 28 72 94m90-181-61 79 28 25-62 77" stroke="' + c + '" stroke-width="10" fill="none" opacity=".55"/>',
      woven:'<path d="M20 112c65 55 96 55 140 0s75-55 140 0M20 176c65 55 96 55 140 0s75-55 140 0M20 240c65 55 96 55 140 0s75-55 140 0" stroke="' + c + '" stroke-width="8" fill="none" opacity=".42"/>',
      rings:'<circle cx="160" cy="170" r="36" stroke="' + c + '" stroke-width="8" fill="none" opacity=".55"/><circle cx="160" cy="170" r="78" stroke="' + c + '" stroke-width="8" fill="none" opacity=".4"/><circle cx="160" cy="170" r="120" stroke="' + c + '" stroke-width="8" fill="none" opacity=".25"/>',
      snow:'<path d="M160 70v195M78 118l164 99M242 118 78 217m82-96-24-20m24 20 24-20m-24 112-24 20m24-20 24 20" stroke="' + c + '" stroke-width="8" opacity=".48"/>',
      horizon:'<path d="M22 192h276M60 192c20-95 60-120 100-120s80 25 100 120" stroke="' + c + '" stroke-width="10" fill="none" opacity=".45"/>',
      block:'<path d="M55 85h65v58H55zm145 0h65v58h-65zM91 173h138v74H91z" fill="' + c + '" opacity=".38"/>',
      wave:'<path d="M22 148c45-75 91-75 138 0 47-75 93-75 138 0M22 218c45-55 91-55 138 0 47-55 93-55 138 0" stroke="' + c + '" stroke-width="12" fill="none" opacity=".45"/>',
      mosaic:'<path d="m38 248 38-138 55 35 44-79 49 71 61-26 15 137Z" stroke="' + c + '" stroke-width="7" fill="none" opacity=".52"/>',
      cane:'<path d="M80 70v205m80-205v205m80-205v205M48 108l32-30 32 30m16 0 32-30 32 30m16 0 32-30 32 30" stroke="' + c + '" stroke-width="10" fill="none" opacity=".45"/>',
      porcelain:'<path d="M82 80c22 28-26 52-26 113 0 58 44 77 104 77s104-19 104-77c0-61-48-85-26-113" stroke="' + c + '" stroke-width="9" fill="none" opacity=".44"/>',
      bell:'<path d="M92 230h136l-20-34V130c0-30-20-52-48-52s-48 22-48 52v66Zm48 0c0 26 40 26 40 0" stroke="' + c + '" stroke-width="10" fill="none" opacity=".48"/>',
      wing:'<path d="M21 103c54 0 100 35 139 105 39-70 85-105 139-105-18 83-65 134-139 154C86 237 39 186 21 103Z" stroke="' + c + '" stroke-width="10" fill="none" opacity=".43"/>',
      seam:'<path d="M52 65c-18 50-18 160 0 210m216-210c18 50 18 160 0 210M46 105l22 8m-25 32 22 7m-22 33 22 7m-19 32 22 8m186-127 22-8m-19 48 22-7m-22 40 22-7m-25 47 22-8" stroke="' + c + '" stroke-width="7" fill="none" opacity=".47"/>',
      speed:'<path d="M34 112h180m-180 42h225M34 196h160m-160 42h208" stroke="' + c + '" stroke-width="11" opacity=".48"/>',
      crown:'<path d="m47 225 20-122 61 57 32-89 32 89 61-57 20 122Z" fill="' + c + '" opacity=".4"/>',
      pit:'<ellipse cx="160" cy="170" rx="112" ry="82" stroke="' + c + '" stroke-width="16" fill="none" opacity=".44"/><ellipse cx="160" cy="170" rx="52" ry="110" stroke="' + c + '" stroke-width="9" fill="none" opacity=".35"/>',
      grid:'<path d="M45 75h230v200H45zM45 115h230M45 155h230M45 195h230M45 235h230M90 75v200m47-200v200m46-200v200m47-200v200" stroke="' + c + '" stroke-width="5" opacity=".38"/>',
      flight:'<path d="M30 226c59-109 108-129 130-56 22-73 71-53 130 56-64-22-108-8-130 42-22-50-66-64-130-42Z" fill="' + c + '" opacity=".42"/>',
      growth:'<path d="M160 275V74m0 30-75 68m75-42 75 68m-75-45-47-72m47 45 47-72" stroke="' + c + '" stroke-width="13" fill="none" opacity=".44"/>'
    };
    return patterns[pattern] || patterns.pulse;
  }

  function kitSvg(team, variant) {
    var brand = TEAMS[team.id] || {kitPattern:'pulse'};
    var colors = kitColors(team, variant);
    var form = kitForm(team.sportId);
    var clipId = 'kit-' + esc(team.id) + '-' + esc(variant || 'home');
    return '<svg class="brand-kit" viewBox="0 0 320 360" role="img" aria-label="' + esc(team.name) + ' ' + esc(variant || 'home') + ' uniform" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><clipPath id="' + clipId + '"><path d="' + form.path + '"/></clipPath><linearGradient id="shade-' + clipId + '" x1="0" x2="1"><stop stop-color="#000" stop-opacity=".2"/><stop offset=".5" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>' +
      '<path d="' + form.path + '" fill="' + esc(colors.base) + '" stroke="' + esc(colors.trim) + '" stroke-width="5"/>' +
      '<g clip-path="url(#' + clipId + ')">' + kitPattern(brand.kitPattern, colors.flash) + '<rect width="320" height="360" fill="url(#shade-' + clipId + ')"/></g>' +
      '<path d="' + form.trim + '" fill="none" stroke="' + esc(colors.trim) + '" stroke-width="8"/>' +
      '<g transform="translate(112 86) scale(.22)">' + markMarkup(brand.mark, colors.trim, colors.flash) + '</g>' +
      '<text x="196" y="143" text-anchor="middle" fill="' + esc(colors.ink) + '" font-family="Arial,Helvetica,sans-serif" font-size="42" font-weight="900" opacity=".88">' + esc(String((hash(team.id) % 90) + 10)) + '</text>' +
      '<text x="160" y="340" text-anchor="middle" fill="' + esc(colors.trim) + '" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="900" letter-spacing="3">' + esc(team.code) + '</text></svg>';
  }

  function skyline(seed, scene, primary, accent) {
    var out = '';
    for (var index = 0; index < 19; index += 1) {
      var value = hash(seed + '|' + index);
      var width = 18 + value % 28;
      var height = 45 + (value >>> 7) % (scene === 'megacity' ? 175 : 105);
      var x = index * 36 - 12;
      var y = 270 - height;
      out += '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="2" fill="#0b1118" stroke="' + primary + '" stroke-opacity=".18"/>';
      out += '<path d="M' + (x + 6) + ' ' + (y + 15) + 'h' + Math.max(5,width-12) + '" stroke="' + accent + '" stroke-width="2" stroke-dasharray="3 5" opacity=".45"/>';
    }
    return out;
  }

  function environment(scene, primary, accent) {
    if (scene === 'mountain' || scene === 'volcanic') return '<path d="M0 232 90 130l58 55 84-104 94 125 69-58 91 84 71-68 83 68v90H0Z" fill="#0a0f15" stroke="' + primary + '" stroke-opacity=".25"/><path d="m232 81 22 62-44-37Z" fill="' + accent + '" opacity=".18"/>';
    if (scene === 'harbor' || scene === 'coastal' || scene === 'wetland' || scene === 'arctic') return '<path d="M0 246c75-18 121 21 190 0s112-21 185 0 142 15 265-6v120H0Z" fill="#07131a"/><path d="M0 268c85-16 123 18 194 0s112-19 185 0 142 14 261-5" stroke="' + primary + '" stroke-width="3" fill="none" opacity=".45"/>';
    if (scene === 'desert' || scene === 'plains') return '<path d="M0 235c89-62 158-26 229 5 91 40 166-63 250-15 48 27 97 37 161 8v127H0Z" fill="#13100e" stroke="' + accent + '" stroke-opacity=".28"/>';
    if (scene === 'forest') return '<path d="M0 272h640v88H0Z" fill="#07110d"/>' + Array.from({length:22},function(_,i){var x=i*31;var h=38+(i%6)*12;return '<path d="m'+x+' 278 '+(x+13)+' '+(278-h)+' '+(x+26)+' 278Z" fill="#0b1a14" stroke="' + primary + '" stroke-opacity=".22"/>';}).join('');
    if (scene === 'snowcity') return '<path d="M0 275c90-34 171-13 248 4 105 23 182-52 392-4v85H0Z" fill="#dfe9ea" opacity=".12"/>';
    if (scene === 'tropic') return '<path d="M0 278h640v82H0Z" fill="#08140f"/><path d="M70 282v-76m0 18-30-22m30 20 35-27m-35 46-38-6m38-2 42-8M564 282v-90m0 22-34-25m34 22 39-30m-39 51-41-8m41 3 48-10" stroke="' + primary + '" stroke-width="7" opacity=".35"/>';
    return '<path d="M0 278h640v82H0Z" fill="#0b0d10"/>';
  }

  function stadiumShape(sportId, primary, accent) {
    if (sportId === 'basketball') return '<path d="M180 169h280l42 41-22 103H160l-22-103Z" fill="#090c10" stroke="' + primary + '" stroke-width="5"/><ellipse cx="320" cy="223" rx="128" ry="50" fill="#040608" stroke="' + accent + '" stroke-width="4"/><rect x="275" y="203" width="90" height="43" fill="' + accent + '" opacity=".22"/>';
    if (sportId === 'hockey') return '<path d="M125 270c16-103 81-153 195-153s179 50 195 153Z" fill="#090d12" stroke="' + primary + '" stroke-width="5"/><ellipse cx="320" cy="245" rx="152" ry="47" fill="#d8eef2" fill-opacity=".16" stroke="' + accent + '" stroke-width="4"/>';
    if (sportId === 'baseball') return '<path d="M115 295c0-123 76-178 205-178s205 55 205 178l-83-52c-27-37-68-55-122-55s-95 18-122 55Z" fill="#090d0d" stroke="' + primary + '" stroke-width="5"/><path d="m320 202 73 72-73 52-73-52Z" fill="' + accent + '" opacity=".25"/>';
    if (sportId === 'american-football') return '<path d="M105 168h430l38 45-42 99H109l-42-99Z" fill="#090b0d" stroke="' + primary + '" stroke-width="5"/><rect x="176" y="211" width="288" height="79" rx="5" fill="' + accent + '" opacity=".2" stroke="' + accent + '" stroke-width="3"/>';
    return '<ellipse cx="320" cy="234" rx="227" ry="113" fill="#090c0d" stroke="' + primary + '" stroke-width="5"/><ellipse cx="320" cy="232" rx="159" ry="69" fill="' + accent + '" opacity=".18" stroke="' + accent + '" stroke-width="4"/><rect x="232" y="201" width="176" height="62" rx="4" fill="#173322" stroke="' + accent + '" stroke-width="2"/>';
  }

  function sceneSvg(team) {
    var brand = TEAMS[team.id] || {scene:'megacity',venue:'HOME'};
    var primary = esc(team.colors.primary), accent = esc(team.colors.accent);
    var sport = LEAGUES[team.sportId] || LEAGUES.soccer;
    return '<svg class="brand-scene" viewBox="0 0 640 360" role="img" aria-label="Concept view of ' + esc(brand.venue) + ' in ' + esc(team.city) + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="sky-' + esc(team.id) + '" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#05070b"/><stop offset=".7" stop-color="' + primary + '" stop-opacity=".14"/><stop offset="1" stop-color="#06090c"/></linearGradient><radialGradient id="glow-' + esc(team.id) + '"><stop stop-color="' + accent + '" stop-opacity=".55"/><stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="640" height="360" fill="url(#sky-' + esc(team.id) + ')"/><circle cx="505" cy="74" r="130" fill="url(#glow-' + esc(team.id) + ')" opacity=".55"/>' +
      skyline(team.id, brand.scene, primary, accent) + environment(brand.scene, primary, accent) + stadiumShape(team.sportId, primary, accent) +
      '<path d="M0 319h640" stroke="' + primary + '" stroke-width="2" opacity=".6"/><g fill="' + accent + '" opacity=".72">' + Array.from({length:28},function(_,i){return '<circle cx="'+(120+(i*29)%410)+'" cy="'+(250+(i*17)%58)+'" r="2"/>';}).join('') + '</g>' +
      '<text x="28" y="41" fill="' + primary + '" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="900" letter-spacing="3">' + esc(sport.code) + ' / ' + esc(team.code) + '</text>' +
      '<text x="28" y="331" fill="#f3f1e9" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="900" letter-spacing="1">' + esc(brand.venue) + '</text></svg>';
  }

  function getPublicSports(content) {
    var allowed = ['soccer','american-football','basketball','hockey','baseball'];
    return allowed.map(function (id) { return content.getSport(id); }).filter(Boolean);
  }

  root.CyberligaBrand = Object.freeze({
    leagues: LEAGUES,
    teams: TEAMS,
    getLeague: function (sportId) { return LEAGUES[sportId] || null; },
    getTeam: function (teamId) { return TEAMS[teamId] || null; },
    displayName: function (team) { var item = team && TEAMS[team.id]; return item && item.displayName || team && team.name || ''; },
    displayCity: function (team) { var item = team && TEAMS[team.id]; return item && item.displayCity || team && team.city || ''; },
    getPublicSports: getPublicSports,
    crestSvg: crestSvg,
    kitSvg: kitSvg,
    sceneSvg: sceneSvg,
    hash: hash
  });
})(typeof window !== 'undefined' ? window : globalThis);
