(function (global) {
  'use strict';

  // CYBERLIGA's editorial source of truth. The compact rows below are expanded
  // into asset-ready teams and featured casts at load time. Nothing here needs
  // network access, so a seed always creates the same season and story beats.
  var VERSION = '1.1.0';

  function hash(value) {
    var text = String(value == null ? '' : value);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededRandom(seed) {
    var state = typeof seed === 'number' ? seed >>> 0 : hash(seed);
    return function () {
      state |= 0;
      state = state + 0x6D2B79F5 | 0;
      var t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function stableStringify(value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
  }

  function shuffled(list, seed) {
    var out = list.slice();
    var random = seededRandom(seed);
    for (var i = out.length - 1; i > 0; i -= 1) {
      var j = Math.floor(random() * (i + 1));
      var hold = out[i];
      out[i] = out[j];
      out[j] = hold;
    }
    return out;
  }

  var FORMS = [
    'low wheel body, tiny crown head, long braking heels',
    'tall ribbon torso, pebble feet, wind-bent neck',
    'broad pear body, postage-stamp head, paddle hands',
    'stacked-dumpling body, short stilts, one high shoulder',
    'teardrop torso, spoon feet, trailing scarf-neck',
    'wide bell body, pin legs, enormous soft forearms',
    'bean body pitched forward, wedge feet, upright thumb head',
    'three-lobed torso, spring ankles, crescent head',
    'long loaf body, low-set head, pendulum arms',
    'inverted pear body, needle legs, flat cap head',
    'round boulder body, off-center head, one long reach',
    'thin reed body, sail-like shoulders, heavy block feet',
    'squat cork body, coiled legs, broad shovel head',
    'arched tube torso, mitten hands, hoof-shaped feet',
    'soft square body, tiny hips, fan-shaped hands',
    'bowling-pin body, bent knees, forward lantern head',
    'double-sphere body, rope arms, flat skipping feet',
    'lean crescent body, oversized calves, seed-sized head',
    'short barrel torso, telescoping neck, wide planted toes',
    'kite-shaped body, knotted elbows, single fin crest',
    'drooping gourd body, quick stick legs, shelf-like brow',
    'flat oval torso, rolling shoulders, pointed dancer feet',
    'towering candle body, soft hammer hands, puddle feet',
    'compact heart body, no visible neck, long elastic shins'
  ];

  var TEMPERAMENTS = [
    'patient until the room blinks',
    'joyfully confrontational',
    'ceremonial and unhurried',
    'restless, curious, impossible to shame',
    'silent except after the decisive play',
    'generous with teammates, cruel to open space',
    'superstitious and theatrically precise',
    'calm in chaos, chaotic in calm',
    'plays every possession like a dare',
    'smiles at pressure and hoards grudges',
    'soft-spoken with volcanic timing',
    'treats the crowd as a seventh teammate'
  ];

  // Team row: id, name, code, city, region, primary, secondary, accent,
  // motif, tactile texture, motion language, rivalry id, cast names.
  var SPORT_BLUEPRINTS = [
    {
      id: 'soccer', name: 'Soccer', league: 'THE COMMON GROUND', code: 'SC',
      unit: 'goals', close: 1, blowout: 3,
      roles: [
        ['Keeper', 'door-closing oracle', 'swallows the angle'],
        ['Back', 'patient boundary keeper', 'turns clearances into passes'],
        ['Engine', 'tireless tempo thief', 'changes pace without warning'],
        ['Winger', 'touchline escape artist', 'bends the field at full tilt'],
        ['Striker', 'one-touch omen', 'arrives one beat before the ball'],
        ['Wildcard', 'shape-breaking mischief maker', 'invents the move nobody drilled']
      ],
      teams: [
        ['tokyo-paper-cranes','TOKYO PAPER CRANES','TPC','Tokyo','Kanto','#F34F68','#FFF1D6','#20314A','folded wing','creased washi and soft foam','sharp pivots followed by weightless glides','osaka-lanterns','Kite|Mochi|Sumi|Nori|Taffy|Crimp'],
        ['osaka-lanterns','OSAKA LANTERNS','OSL','Osaka','Kansai','#FF8A30','#261B38','#FFE36D','swinging lantern','rice paper over warm cork','pendulum feints and sudden little hops','tokyo-paper-cranes','Glim|Beni|Ponzu|Wick|Maru|Yuzu'],
        ['berlin-bramble','BERLIN BRAMBLE CLUB','BBC','Berlin','Brandenburg','#6E9B45','#171C18','#E6C85C','thorn loop','mossy felt and braided twine','snagging tackles and low coiled runs','london-chalk-horses','Burr|Marta Moss|Knuckle|Sloe|Tangle|Pip Root'],
        ['london-chalk-horses','LONDON CHALK HORSES','LCH','London','Thames','#ECE7DA','#263A51','#E75542','chalk horse','powdered canvas and pale suede','prancing stops and heavy diagonal charges','berlin-bramble','Dobbin|Scuff|Mallow|Nell Chalk|Hob|Rattle'],
        ['sao-paulo-mango-teeth','SAO PAULO MANGO TEETH','SMT','Sao Paulo','Paulista','#FFB21A','#1A6B51','#F45136','bitten mango','dimpled peel rubber and cotton pulp','juicy shoulder drops and elastic bursts','valparaiso-salt-kites','Caroço|Luma|Bite|Zaza|Pingo|Fatia'],
        ['valparaiso-salt-kites','VALPARAISO SALT KITES','VSK','Valparaiso','Pacific Cliffs','#72C8D5','#332F4C','#F7D98A','harbor kite','salt-crusted linen and sailcloth','cliff-edge turns and long floating diagonals','sao-paulo-mango-teeth','Brisa|Nudo|Tiza|Palo|Cometa|Salina'],
        ['lagos-river-drums','LAGOS RIVER DRUMS','LRD','Lagos','Lagoon','#D85D2C','#173B35','#F5C85A','talking drum','polished hide, raffia and soft wood','syncopated surges with stomping recoveries','marrakech-sun-carpets','Koko|Bata|Ripple|Sade|Gourd|Melo'],
        ['marrakech-sun-carpets','MARRAKECH SUN CARPETS','MSC','Marrakech','Atlas Gate','#C94132','#244C66','#F2B84B','flying carpet','thick woven wool and tasselled felt','low skims, spinning checks and tassel flicks','lagos-river-drums','Zellij|Mina|Tuft|Saffron|Riad|Knot']
      ]
    },
    {
      id: 'basketball', name: 'Basketball', league: 'THE HIGH ROOM', code: 'BB',
      unit: 'points', close: 3, blowout: 16,
      roles: [
        ['Rim Keeper', 'paint-dwelling weather system', 'makes the rim feel smaller'],
        ['Point', 'pocket-sized floor cartographer', 'draws passing lanes in midair'],
        ['Wing', 'two-way hinge', 'turns defense into a head start'],
        ['Shooter', 'distance ritualist', 'releases before doubt arrives'],
        ['Cutter', 'back-door ghost', 'vanishes behind watching shoulders'],
        ['Sixth Spark', 'bench-born momentum thief', 'changes the temperature in one trip']
      ],
      teams: [
        ['new-york-brownstones','NEW YORK BROWNSTONES','NYB','New York','Five Boroughs','#A64B35','#E8D5B4','#24364A','stoop lion','brick-textured foam and worn leather','stair-step crossovers and squared landings','toronto-lake-effect','Stoopy|Lintel|Rook Moss|Marnie|Brownie|Fire Escape'],
        ['toronto-lake-effect','TORONTO LAKE EFFECT','TLE','Toronto','Great Lakes','#A7DDE8','#243D66','#F8F2DE','snow squall','quilted nylon and frosted fleece','drifting screens and sudden whiteout runs','new-york-brownstones','Flurry|Parka|Melt|Toque|Skate Lace|Blue Hour'],
        ['manila-monsoons','MANILA MONSOONS','MNL','Manila','Luzon','#236B73','#F5C84C','#E94D45','rain fan','wet-look silk and sponge rubber','sweeping rotations and thunderclap finishes','melbourne-velvet-ants','Ambon|Kulog|Payong|Merienda|Habagat|Tsinelas'],
        ['melbourne-velvet-ants','MELBOURNE VELVET ANTS','MVA','Melbourne','Victoria','#B92F57','#131A2B','#E8A84D','velvet ant','brushed velvet and ribbed rubber','tiny busy cuts ending in oversized leaps','manila-monsoons','Velma Ant|Biscuit|Nip|Redback|Crumb|Stitch'],
        ['dakar-baobabs','DAKAR BAOBABS','DKB','Dakar','Cap-Vert','#8A623D','#2E5538','#FFCF52','baobab crown','bark cork and waxed cotton','rooted post play with canopy-wide passing','medellin-condors','Trunk|Sira|Keur|Pod|Ndeye|Canopy'],
        ['medellin-condors','MEDELLIN CONDORS','MEC','Medellin','Aburra Valley','#6F4FA1','#F3B93F','#D8543D','condor spiral','feathered felt and coffee-sack weave','circling patience into steep downhill attacks','dakar-baobabs','Pluma|Tinto|Páramo|Alba|Nido|Cumbre'],
        ['belgrade-beehive','BELGRADE BEEHIVE','BGH','Belgrade','Danube','#F1B832','#24202B','#EDE7D2','honeycomb','tufted wool and amber resin','swarming help defense and hexagonal spacing','istanbul-teacups','Meda|Buzzko|Comb|Zora|Wax|Dronja'],
        ['istanbul-teacups','ISTANBUL TEACUPS','ITC','Istanbul','Bosphorus','#3D8E82','#F0E1C2','#C54839','spinning teacup','glazed clay, terry cloth and copper thread','saucer spins and steaming downhill drives','belgrade-beehive','Ince|Lokum|Fincan|Mint|Steam|Tulp']
      ]
    },
    {
      id: 'hockey', name: 'Hockey', league: 'THE COLD ARGUMENT', code: 'HK',
      unit: 'goals', close: 1, blowout: 4,
      roles: [
        ['Goaltender', 'crease-filling soft fortress', 'folds into impossible gaps'],
        ['Stay-home', 'blue-line doorstop', 'wins collisions without hurrying'],
        ['Rover', 'edgework pickpocket', 'steals a lane and keeps skating'],
        ['Center', 'faceoff locksmith', 'opens the middle on command'],
        ['Sniper', 'quiet corner hunter', 'finds postage stamps behind the keeper'],
        ['Pest', 'smiling momentum splinter', 'turns irritation into possession']
      ],
      teams: [
        ['montreal-sugar-maples','MONTREAL SUGAR MAPLES','MSM','Montreal','Quebec','#C9463D','#F4E6C2','#513C2E','maple candy','boiled-sugar gloss and wool batting','sticky board work and slow-syrup dekes','reykjavik-lava-loons','Sucre|Bonbon Jean|Taffeta|Maple Moe|Crackle|Tin Roof'],
        ['reykjavik-lava-loons','REYKJAVIK LAVA LOONS','RLL','Reykjavik','Faxafloi','#E95B34','#1E2933','#A7E3DF','lava loon','black pumice foam and slick felt feathers','glacial glides interrupted by volcanic cuts','montreal-sugar-maples','Lopi|Puffin Adjacent|Hekla|Mossbeak|Ember Egg|Skerry'],
        ['stockholm-wool-wolves','STOCKHOLM WOOL WOLVES','SWW','Stockholm','Baltic Archipelago','#8E98A8','#243144','#F4C65A','wool wolf','dense grey fleece and birch runners','pack rotations with long silent strides','helsinki-birch-knots','Varg Yarn|Tuva|Snarl|Mitten|Grey Bun|Loom'],
        ['helsinki-birch-knots','HELSINKI BIRCH KNOTS','HBK','Helsinki','Uusimaa','#E7DDC7','#2E6654','#E35C42','birch knot','peeled bark, linen and pale cork','tight ring turns and springy root checks','stockholm-wool-wolves','Koivu|Paju|Knot Kalle|Sisu Soft|Rind|Tuohi'],
        ['sapporo-snow-lanterns','SAPPORO SNOW LANTERNS','SSL','Sapporo','Hokkaido','#F6F4E8','#447DA2','#EF5A62','snow lantern','packed-cotton snow and oiled paper','floating entries with hard little snowplow stops','anchorage-tundra-drums','Yuki Wick|Miso|Powder Bun|Kumo|Glowcap|Nabe'],
        ['anchorage-tundra-drums','ANCHORAGE TUNDRA DRUMS','ATD','Anchorage','Cook Inlet','#356C7D','#D78A3A','#E6E1C5','tundra drum','seal-soft faux hide and driftwood','deep-beat forechecks and wide horizon carries','sapporo-snow-lanterns','Kodiak Kip|Drift|Muktuk|Low Sun|Thump|Spruce'],
        ['prague-river-golems','PRAGUE RIVER GOLEMS','PRG','Prague','Bohemia','#9A765A','#315E6A','#E6B95B','clay golem','river clay, burlap and wax cord','heavy statuesque holds followed by sluice-fast rushes','tromso-whale-choir','Mudla|Vltava Vince|Kiln|Knotek|Silt|Golemka'],
        ['tromso-whale-choir','TROMSO WHALE CHOIR','TWC','Tromso','Arctic Norway','#315A89','#D7EEF0','#F06C58','singing whale','quilted blubber-soft fabric and rope','long curving routes that crest in unison','prague-river-golems','Humm|Baleen Bea|Low Note|Spout|Minke|Chorus']
      ]
    },
    {
      id: 'baseball', name: 'Baseball', league: 'THE LONG AFTERNOON', code: 'BS',
      unit: 'runs', close: 1, blowout: 6,
      roles: [
        ['Ace', 'mound-side illusionist', 'changes speed without changing intent'],
        ['Catcher', 'masked pitch translator', 'frames the edge like a tiny painting'],
        ['Shortstop', 'infield hinge', 'makes bad hops look rehearsed'],
        ['Slugger', 'one-swing weather event', 'leaves dents in the evening'],
        ['Center Field', 'horizon shepherd', 'runs where the ball will remember landing'],
        ['Closer', 'ninth-inning undertaker', 'makes three outs feel prewritten']
      ],
      teams: [
        ['mexico-city-alebrijes','MEXICO CITY ALEBRIJES','MXA','Mexico City','Valley of Mexico','#E84B3C','#315B88','#F2C84B','painted alebrije','carved copal wood and matte paint','many-animal stances and zigzag baserunning','havana-sugar-kings','Coyote Pez|Lucha Moth|Jaguar Spoon|Trompo|Ala Azul|Chispa'],
        ['havana-sugar-kings','HAVANA SUGAR KINGS','HSK','Havana','Caribbean','#E8E1C1','#4B7C68','#C34B3E','sugar crown','raw cane fiber and sun-faded cotton','lazy-looking swings with hard caramel snaps','mexico-city-alebrijes','Caña|Reyito|Guayaba|Dulce Leo|Melao|Coco Crispin'],
        ['seoul-moon-jars','SEOUL MOON JARS','SMJ','Seoul','Han River','#F4EFE3','#244C63','#C74B45','moon jar','chalky porcelain and indigo cloth','still set positions breaking into clean arcs','kyoto-lucky-cats','Dokka|Bori|Jar Min|Dal|Mugun|Sori'],
        ['kyoto-lucky-cats','KYOTO LUCKY CATS','KLC','Kyoto','Kansai Hills','#E65745','#F1C84E','#315E57','beckoning cat','plush felt and crackled ceramic','pawing timing rituals and soft-foot steals','seoul-moon-jars','Maneki Mio|Koban|Tama Two|Nekoji|Bell|Calico'],
        ['santo-domingo-coco-bats','SANTO DOMINGO COCO BATS','SCB','Santo Domingo','Quisqueya','#5B342C','#7CBF8A','#F1C55E','coconut bat','coconut husk and palm-weave cloth','shell-hard contact and canopy-sweeping throws','san-juan-coquis','Coco Loco|Palma|Batey|Husk|Mamey|Quenepa'],
        ['san-juan-coquis','SAN JUAN COQUIS','SJC','San Juan','Puerto Rico','#63B48D','#243950','#F4D14D','singing coqui','damp velvet and leaf-veined rubber','tiny crouches exploding into musical hops','santo-domingo-coco-bats','Coqui Quique|Yunque|Rana Ray|Bruma|Noche|Plena'],
        ['cape-town-jackals','CAPE TOWN JACKALS','CTJ','Cape Town','Western Cape','#C18445','#253B39','#E8DDC7','dune jackal','sand-brushed suede and wiry fringe','sidewind leads and long-eared tracking turns','auckland-kauri','Fennec Finn|Karoo|Dune|Rooibos|Kelp|Noon Ear'],
        ['auckland-kauri','AUCKLAND KAURI','AKK','Auckland','Hauraki','#3F7352','#CF9C4A','#E9E2C8','kauri cone','resin-gloss cork and fern felt','root-stable swings and high-frond catches','cape-town-jackals','Kauri Kiri|Cone|Tui|Amber Gum|Ponga|Rimu']
      ]
    },
    {
      id: 'combat', name: 'Combat', league: 'THE HANDMADE UNDERCARD', code: 'CB',
      unit: 'rounds', close: 1, blowout: 3,
      roles: [
        ['Heavy', 'pressure-bearing bell ringer', 'moves the ropes with every step'],
        ['Technician', 'angle-counting craftsperson', 'wins inches until they become a round'],
        ['Counter', 'patient trap spring', 'answers the punch that has not landed'],
        ['Swarmer', 'pocket-sized bad weather', 'throws in bunches and exits laughing'],
        ['Grappler', 'soft-bodied knot maker', 'turns balance into a temporary rumor'],
        ['Showboat', 'crowd-powered daredevil', 'makes danger look like choreography']
      ],
      teams: [
        ['accra-brass-bell','ACCRA BRASS BELL','ABB','Accra','Gold Coast','#B98332','#243A36','#E8D4A8','market bell','hammered brass cloth and braided rope','ringing shoulder rolls and measured forward steps','bangkok-banana-leaf','Auntie Gong|Kofi Clang|Little Alloy|Market Moon|Dented Dan|Echo Ama'],
        ['bangkok-banana-leaf','BANGKOK BANANA LEAF','BBL','Bangkok','Chao Phraya','#73A64C','#F0D45D','#5B3C35','folded leaf','waxed leaf fabric and kapok stuffing','swaying slips and whipping green counters','accra-brass-bell','Kluai|Mae Mop|Fold|Sticky Rice|Fan Noi|Cicada'],
        ['tbilisi-clay-knuckles','TBILISI CLAY KNUCKLES','TCK','Tbilisi','Caucasus','#A75D43','#E6CBA8','#3D5660','clay fist','red earthen clay and rough wool','sculpted guards that crack into looping attacks','las-vegas-dust-devils','Kvevri|Nino Kiln|Thumbprint|Soot|Clay Davit|Apricot Pit'],
        ['las-vegas-dust-devils','LAS VEGAS DUST DEVILS','LVD','Las Vegas','Mojave','#C97A3D','#4C315F','#F2D15B','dust spiral','powdered suede and casino felt','mirage feints and spinning rope escapes','tbilisi-clay-knuckles','Croupier Cactus|Velvet Dust|Six-Shoe|Mirage Midge|Tumbleweed Ted|Lucky Grit'],
        ['tunis-sand-loom','TUNIS SAND LOOM','TSL','Tunis','Mediterranean Gate','#D9A650','#245B66','#F0E2C6','desert loom','woven wool and fine sand flock','shuttle-step entries and tapestry-tight guards','cebu-shell-guard','Weft|Indigo Ines|Shuttle|Dune Thread|Selma Selvage|Fringe'],
        ['cebu-shell-guard','CEBU SHELL GUARD','CSG','Cebu','Visayas','#E5B67A','#276F73','#F05C52','spiral shell','pearl foam and abaca weave','spiral covers opening into tide-fast combinations','tunis-sand-loom','Kabibe|Pearl Punch|Hablon|Tide Tita|Nautilus Noy|Reef'],
        ['lima-condor-gym','LIMA CONDOR GYM','LCG','Lima','Pacific Peru','#6E4B7E','#D29C45','#E7DED0','condor glove','alpaca felt and feathered canvas','high guard circles and sudden mountain drops','liverpool-ropeworks','Pico|Alpaca Jack|Niebla|Quipu|Huaca|Ala'],
        ['liverpool-ropeworks','LIVERPOOL ROPEWORKS','LRW','Liverpool','Mersey','#8C4A3F','#E0C99D','#2D5064','dockside knot','tarred rope, sailcloth and padded felt','tugging clinches and rolling dockhand hooks','lima-condor-gym','Bosun Bun|Mersey Mags|Hitch|Tally Rope|Dock Pudding|Splice']
      ]
    },
    {
      id: 'american-football', name: 'American Football', league: 'THE SUNDAY ANIMAL', code: 'AF',
      unit: 'points', close: 3, blowout: 21,
      roles: [
        ['Quarterback', 'pocket-side weather reader', 'throws receivers open', 'holds the ball one heartbeat too long when the first read wins', 12],
        ['Running Back', 'gap-sized escape artist', 'gets small before getting gone', 'hunts the cutback even when the clean yards are outside', 28],
        ['Receiver', 'sideline acrobat', 'catches the part nobody can reach', 'fights press coverage with emotion instead of patience', 11],
        ['Tight End', 'route-running front porch', 'blocks like a wall and turns like a gate', 'telegraphs the seam when the matchup looks too inviting', 87],
        ['Linebacker', 'middle-field thunderhead', 'arrives with the play call still echoing', 'bites hard on play action after consecutive run fits', 54],
        ['Safety', 'deep-field rumor collector', 'erases the ending of a long throw', 'trusts that closing range enough to gamble underneath', 24],
        ['Z Receiver', 'motion-started space thief', 'turns free releases into vertical panic', 'drifts into traffic when the scramble drill loses shape', 18],
        ['Slot Receiver', 'middle-field seam unpicker', 'wins the option route after the defender commits', 'turns upfield before fully securing routine catches', 83],
        ['Left Tackle', 'blind-side lighthouse', 'runs speed rushers past the pocket', 'oversets against pure speed and exposes the inside lane', 77],
        ['Left Guard', 'short-pulling road grader', 'lands the first square block in space', 'lunges when a lighter tackle gives ground on purpose', 68],
        ['Center', 'protection-setting hinge', 'identifies pressure and keeps the pocket speaking one language', 'calls late checks loudly enough for the defense to hear', 55],
        ['Right Guard', 'down-blocking pile mover', 'turns double teams into second-level angles', 'chases linebackers beyond the leverage of the play', 66],
        ['Right Tackle', 'edge-setting gatepost', 'seals the backside before the runner makes the cut', 'plays too tall when tired and gives away the chest', 72],
        ['Left Defensive End', 'long-arm edge setter', 'compresses the run lane without surrendering contain', 'runs past quick-set throws while hunting the sack', 91],
        ['Defensive Tackle', 'three-technique seam splitter', 'crosses a guard face before the block can settle', 'loses get-off after long drives without a rotation', 97],
        ['Nose Tackle', 'double-team gravity well', 'anchors both A gaps and keeps the linebackers clean', 'stays anchored when the play has already escaped outside', 93],
        ['Right Defensive End', 'backside pursuit engine', 'closes the bootleg before it becomes daylight', 'squeezes too hard and loses contain to fast option looks', 99],
        ['Weakside Linebacker', 'flow-chasing cleanup artist', 'runs through the open window before the blocker arrives', 'overruns jet motion and opens the cutback behind it', 51],
        ['Strongside Linebacker', 'tight-end side traffic cop', 'sets a hard edge and carries the first crosser', 'gets stiff in space against two-way option routes', 58],
        ['Left Cornerback', 'boundary-route pickpocket', 'squeezes fades into the paint and steals late throws', 'peeks into the backfield when the receiver stacks vertically', 21],
        ['Right Cornerback', 'field-side mirror', 'stays square through the receiver\'s second move', 'grabs cloth when recovery speed is finally tested', 31],
        ['Strong Safety', 'alley-filling collision poet', 'turns the extra run gap into a dead end', 'arrives so hot that patient runners can redirect underneath', 27]
      ],
      teams: [
        ['new-orleans-bayou-kings','NEW ORLEANS BAYOU KINGS','NOB','New Orleans','Gulf Delta','#4E7A52','#4C315B','#D3A946','cypress crown','moss fringe, velvet and swamp-soft rubber','slow bayou misdirection breaking into brass-band bursts','atlanta-peaches','Gumbo Gene|Moss Boss|Beignet|King Roux|Parish|Second Line|Brass Bayou|Cypress Slim|Levee Lou|Canal Cake|Banjo Boudreaux|Mardi Grip|Porchlight|Mudbug Max|Tuba June|Gator Bell|Lagniappe Lou|Sazerac Sid|Fleur Fats|Crawdad Clay|Creole Moon|Delta Deke'],
        ['atlanta-peaches','ATLANTA PEACHES','ATL','Atlanta','Piedmont','#F29A7B','#3E6147','#F7D4A6','split peach','peach-fuzz flock and quilted cotton','soft starts with pit-hard downhill finishes','new-orleans-bayou-kings','Pit Boss Penny|Fuzz|Cobbler|Peach Tree Pete|Stone|Juice Box|Sweet Tea|Pecan Pat|I-285 Ike|Peachtree Pip|Georgia Clay|Cicada Cal|Porch Swing|Red Top|Waffle House Walt|Magnolia Max|Pollen Count|Dogwood Dan|Traffic Jam|Golden Ray|Chattahoochee Chuck|Midtown Mel'],
        ['chicago-stockyards','CHICAGO STOCKYARDS','CHI','Chicago','Lake Michigan','#8B4B3E','#D8C4A1','#2D3A4E','gate and hoof','heavy canvas, rope seam and worn hide','square pulls and meat-hook pursuit angles','minneapolis-snow-geese','Gatehouse Gus|Yardbird|Cleaver Cleo|Lake Beef|Apron|Whistle|Stockpot Stu|L-Train Len|Brawler Bridge|Packinghouse Pat|Cold Front Carl|Union Jackknife|Iron El|Southside Smoke|Loop Lou|Rivet Rita|Canaryville Cal|Lake Effect Leo|Rail Spike|Backlot Buck|Halsted Hank|Windburn'],
        ['minneapolis-snow-geese','MINNEAPOLIS SNOW GEESE','MSP','Minneapolis','North Star','#E8F0EC','#587FA2','#E5B843','snow goose','down quilt and waxed webbed rubber','waddling formations that erupt into honking flight','chicago-stockyards','Honker Hank|Downy|Webfoot Wes|Grey Wing|Loaf|Migration Mike|Sleet Pete|Hotdish Hal|Skyway Sam|North Loop Nils|Ice House Ike|Flannel Fran|Lake Chip|Walleye Walt|Mill City Milo|Frostbite Fritz|Loon Call|Boundary Bill|Powder Keg|Twin Current|Cabin Cal|Whiteout'],
        ['dallas-prairie-hounds','DALLAS PRAIRIE HOUNDS','DPH','Dallas','North Texas','#B86A3D','#E6C17B','#344D61','prairie hound','sun-baked suede and bandana cotton','low tracking starts and wide dust-kicking routes','oakland-redwoods','Hush Puppy|Bandana Bill|Long Grass|Tumble|Sundog|Bluebonnet|Mesquite Mack|Spur Line|Cattle Guard Cal|Dust Devil Dee|Brazos Buck|Bootheel Bob|Oilcan Ollie|Prairie Jack|Red Dirt Ray|Fencepost Finn|Rattler Rex|Armadillo Art|Sunset Spur|Sagebrush Sam|Trinity Tex|Blue Norther'],
        ['oakland-redwoods','OAKLAND REDWOODS','OAK','Oakland','East Bay','#315F45','#A34D3D','#E6C784','redwood ring','bark cork and fog-damp felt','towering pass sets and root-deep tackling bases','dallas-prairie-hounds','Ring Count|Fog Fern|Big Burl|Acorn Alice|Canopy Cal|Root|Fogbank Frank|Sequoia Slim|Bay Bridge Burl|Mossback Mae|Town Root|Jack London Jay|Temescal Twig|Lake Merritt Lou|Barkley|Needle Ned|Portside Pine|Canyon Cone|Redwood Rita|East Bay Ember|Grove Ghost|Stump Speech'],
        ['seattle-rain-dogs','SEATTLE RAIN DOGS','SEA','Seattle','Puget Sound','#3E6D82','#202E3C','#D5B84A','rain dog','slick corduroy and sponge-padded wool','puddle cuts and shake-dry change of direction','honolulu-wave-riders','Drizzle Dog|Parka Pete|Puddle|Salmon Run|Grey Sky|Shake|Coffee Cloud|Rainier Ray|Ferry Finn|Capitol Drip|Needle Nate|Cascade Cal|Sockeye Sid|Moss Machine|Sounder Sam|Pike Place Pip|Evergreen Ed|Umbrella Uma|Gutter Gus|Puget Pete|Cloudbreak|Thunder Pup'],
        ['honolulu-wave-riders','HONOLULU WAVE RIDERS','HNL','Honolulu','Oahu','#2B9A9B','#F2B84A','#E85D4A','breaking wave','towel terry, cork and flower-soft felt','rolling option waves and longboard-balanced catches','seattle-rain-dogs','Foam|Aloha Al|Reef Runner|Mango Board|Lei Line|Big Set|Pipeline Pono|Kona Kai|Trade Wind Tui|Waikiki Walt|Volcano Vance|Palm Shade|Shaka Sam|Makai Mike|Taro Tide|Lava Lei|North Shore Nalu|Coconut Cal|Rainbow Reef|Puka Pete|Island Time|Sunset Sefa']
      ]
    }
  ];

  function makeAthletes(team, roles, teamIndex) {
    var names = team.castNames;
    var usedFootballNumbers = [];
    return roles.map(function (role, athleteIndex) {
      var formIndex = (hash(team.id) + athleteIndex * 5 + teamIndex * 3) % FORMS.length;
      var moodIndex = (hash(names[athleteIndex]) + athleteIndex + teamIndex) % TEMPERAMENTS.length;
      var legacyNumber = ((hash(team.id + '|' + athleteIndex) % 89) + 1);
      var athleteNumber = legacyNumber;
      if (team.sportId === 'american-football') {
        athleteNumber = athleteIndex < 6 ? legacyNumber : role[4];
        while (usedFootballNumbers.indexOf(athleteNumber) >= 0) {
          athleteNumber = athleteNumber === 99 ? 1 : athleteNumber + 1;
        }
        usedFootballNumbers.push(athleteNumber);
      }
      var athlete = {
        id: team.id + '-a' + (athleteIndex + 1),
        name: names[athleteIndex],
        number: athleteNumber,
        role: role[0],
        archetype: role[1],
        temperament: TEMPERAMENTS[moodIndex],
        silhouette: FORMS[formIndex] + '; ' + team.texture + '; ' + team.motif + ' detail',
        signature: role[2]
      };
      if (role[3]) athlete.flaw = role[3];
      return athlete;
    });
  }

  function expandTeam(row, sport, teamIndex) {
    var team = {
      id: row[0], sportId: sport.id, name: row[1], code: row[2],
      city: row[3], region: row[4],
      colors: { primary: row[5], secondary: row[6], accent: row[7] },
      motif: row[8], texture: row[9], motion: row[10],
      rivalryId: row[11], rivalry: '', castNames: row[12].split('|'), athletes: []
    };
    team.athletes = makeAthletes(team, sport.roles, teamIndex);
    return team;
  }

  var sports = SPORT_BLUEPRINTS.map(function (blueprint) {
    var sport = {
      id: blueprint.id,
      name: blueprint.name,
      league: blueprint.league,
      code: blueprint.code,
      unit: blueprint.unit,
      close: blueprint.close,
      blowout: blueprint.blowout,
      teams: []
    };
    sport.teams = blueprint.teams.map(function (row, index) {
      return expandTeam(row, { id: sport.id, roles: blueprint.roles }, index);
    });
    sport.teams.forEach(function (team) {
      var rival = sport.teams.filter(function (candidate) { return candidate.id === team.rivalryId; })[0];
      team.rivalry = rival ? team.name + ' vs ' + rival.name : '';
      delete team.castNames;
    });
    return sport;
  });

  var SPORT_ALIASES = {
    football: 'soccer', footy: 'soccer', hoops: 'basketball', ice: 'hockey',
    diamond: 'baseball', fight: 'combat', fighting: 'combat',
    gridiron: 'american-football', americanfootball: 'american-football', nfl: 'american-football'
  };

  function getSport(sportId) {
    var key = String(sportId || '').toLowerCase().replace(/\s+/g, '-');
    key = SPORT_ALIASES[key] || key;
    return sports.filter(function (sport) { return sport.id === key; })[0] || null;
  }

  function getTeams(sportId) {
    var sport = getSport(sportId);
    return sport ? sport.teams.slice() : [];
  }

  function getTeam(teamId, sportId) {
    if (!teamId) return null;
    var key = String(typeof teamId === 'object' ? (teamId.id || teamId.name || teamId.code || '') : teamId).toLowerCase();
    var pool = sportId ? getTeams(sportId) : sports.reduce(function (all, sport) { return all.concat(sport.teams); }, []);
    return pool.filter(function (team) {
      return team.id.toLowerCase() === key || team.name.toLowerCase() === key || team.code.toLowerCase() === key;
    })[0] || null;
  }

  function getAthlete(teamId, athleteId) {
    var team = getTeam(teamId);
    if (!team || athleteId == null) return null;
    var key = String(typeof athleteId === 'object' ? (athleteId.id || athleteId.name || '') : athleteId).toLowerCase();
    return team.athletes.filter(function (athlete) {
      return athlete.id.toLowerCase() === key || athlete.name.toLowerCase() === key || String(athlete.number) === key;
    })[0] || null;
  }

  function createSeason(sportId, seed) {
    var sport = getSport(sportId);
    if (!sport) return null;
    var seasonSeed = String(seed == null ? 'season-one' : seed);
    var order = shuffled(sport.teams.map(function (team) { return team.id; }), sport.id + '|' + seasonSeed);
    var fixed = order[0];
    var rotating = order.slice(1);
    var firstLeg = [];
    for (var roundIndex = 0; roundIndex < order.length - 1; roundIndex += 1) {
      var roundOrder = [fixed].concat(rotating);
      var matches = [];
      for (var matchIndex = 0; matchIndex < order.length / 2; matchIndex += 1) {
        var left = roundOrder[matchIndex];
        var right = roundOrder[roundOrder.length - 1 - matchIndex];
        var flip = (roundIndex + matchIndex) % 2 === 1;
        var homeId = flip ? right : left;
        var awayId = flip ? left : right;
        var home = getTeam(homeId, sport.id);
        matches.push({
          id: sport.code + '-' + hash(seasonSeed).toString(36) + '-R' + (roundIndex + 1) + 'M' + (matchIndex + 1),
          round: roundIndex + 1,
          homeId: homeId,
          awayId: awayId,
          rivalry: home.rivalryId === awayId,
          seed: hash(sport.id + '|' + seasonSeed + '|' + roundIndex + '|' + homeId + '|' + awayId)
        });
      }
      firstLeg.push({ number: roundIndex + 1, matches: matches });
      rotating.unshift(rotating.pop());
    }
    var returnLeg = firstLeg.map(function (round, index) {
      var number = firstLeg.length + index + 1;
      return {
        number: number,
        matches: round.matches.map(function (match, matchIndex) {
          return {
            id: sport.code + '-' + hash(seasonSeed).toString(36) + '-R' + number + 'M' + (matchIndex + 1),
            round: number,
            homeId: match.awayId,
            awayId: match.homeId,
            rivalry: match.rivalry,
            seed: hash(sport.id + '|' + seasonSeed + '|' + number + '|' + match.awayId + '|' + match.homeId)
          };
        })
      };
    });
    return {
      id: sport.id + '-' + hash(seasonSeed).toString(36),
      sportId: sport.id,
      seed: seasonSeed,
      rounds: firstLeg.concat(returnLeg)
    };
  }

  function getMarqueeMatchup(sportId, seed, round) {
    var season = createSeason(sportId, seed);
    if (!season) return null;
    var roundIndex = Math.abs(Number(round || 1) - 1) % season.rounds.length;
    var fixtures = season.rounds[roundIndex].matches;
    var random = seededRandom(season.id + '|marquee|' + roundIndex);
    var ranked = fixtures.map(function (match) {
      return { match: match, score: (match.rivalry ? 10 : 0) + random() };
    }).sort(function (a, b) { return b.score - a.score; });
    var chosen = ranked[0].match;
    return {
      id: chosen.id,
      round: chosen.round,
      seed: chosen.seed,
      rivalry: chosen.rivalry,
      reason: chosen.rivalry ? 'old rivalry, new chapter' : 'two contrasting shapes collide',
      homeId: chosen.homeId,
      awayId: chosen.awayId,
      home: getTeam(chosen.homeId, season.sportId),
      away: getTeam(chosen.awayId, season.sportId)
    };
  }

  function matchScore(match, side) {
    var direct = match[side + 'Score'];
    if (direct != null && !isNaN(Number(direct))) return Number(direct);
    if (Array.isArray(match.score)) return Number(match.score[side === 'home' ? 0 : 1]) || 0;
    if (match.score && match.score[side] != null) return Number(match.score[side]) || 0;
    return 0;
  }

  function eventLabels(events) {
    return (Array.isArray(events) ? events : []).map(function (event) {
      if (typeof event === 'string') return event.toLowerCase();
      return String(event.type || event.kind || event.label || '').toLowerCase();
    }).filter(Boolean);
  }

  function normalizeMatch(matchData) {
    var match = matchData || {};
    var sport = getSport(match.sportId || match.sport || (match.home && match.home.sportId));
    if (!sport) return null;
    var home = getTeam(match.homeId || match.home, sport.id);
    var away = getTeam(match.awayId || match.away, sport.id);
    if (!home || !away || home.id === away.id) return null;
    var homeScore = matchScore(match, 'home');
    var awayScore = matchScore(match, 'away');
    var winner = homeScore === awayScore ? null : (homeScore > awayScore ? home : away);
    var loser = winner ? (winner.id === home.id ? away : home) : null;
    var declaredWinner = getTeam(match.winnerId || match.winner, sport.id);
    if (declaredWinner && (declaredWinner.id === home.id || declaredWinner.id === away.id)) {
      winner = declaredWinner;
      loser = winner.id === home.id ? away : home;
    }
    var events = eventLabels(match.events);
    var rivalry = home.rivalryId === away.id || away.rivalryId === home.id;
    return {
      raw: match,
      sport: sport,
      home: home,
      away: away,
      homeScore: homeScore,
      awayScore: awayScore,
      winner: winner,
      loser: loser,
      rivalry: rivalry,
      events: events,
      round: Number(match.round || match.matchday || 1)
    };
  }

  function chooseHero(context, random) {
    var rawHero = context.raw.hero || context.raw.mvp || context.raw.athlete;
    var clubs = [context.home, context.away];
    for (var i = 0; i < clubs.length; i += 1) {
      var found = getAthlete(clubs[i].id, rawHero);
      if (found) return found;
    }
    var club = context.winner || clubs[Math.floor(random() * clubs.length)];
    return club.athletes[Math.floor(random() * club.athletes.length)];
  }

  function getHeadlines(matchData, count, seed) {
    var context = normalizeMatch(matchData);
    if (!context) return [];
    var wanted = Math.max(1, Math.min(8, Number(count || 3)));
    var storySeed = String(seed == null ? 'wire' : seed) + '|' + stableStringify(matchData || {});
    var random = seededRandom(storySeed);
    var hero = chooseHero(context, random);
    var score = context.home.code + ' ' + context.homeScore + '-' + context.awayScore + ' ' + context.away.code;
    var diff = Math.abs(context.homeScore - context.awayScore);
    var winner = context.winner;
    var loser = context.loser;
    var lines = [];

    if (!winner) {
      lines.push(context.home.name + ' AND ' + context.away.name + ' LEAVE THE ARGUMENT UNFINISHED');
      lines.push(score + ': NOBODY GETS THE LAST WORD');
    } else {
      lines.push(hero.name.toUpperCase() + ' GIVES ' + winner.city.toUpperCase() + ' A NEW FOLK HERO');
      lines.push(winner.name + ' TAKE THE NIGHT, ' + score);
      lines.push(winner.name + ' TURN ' + winner.motif.toUpperCase() + ' INTO A WINNING LANGUAGE');
      lines.push(hero.name.toUpperCase() + ' MAKES "' + hero.signature.toUpperCase() + '" THE PLAY EVERYONE REWINDS');
      if (diff <= context.sport.close) lines.push(hero.name.toUpperCase() + ' FINDS THE LAST INCH AGAINST ' + loser.name);
      if (diff >= context.sport.blowout) lines.push(winner.name + ' MAKE A LANDSLIDE OUT OF ' + loser.name);
    }
    if (context.rivalry) lines.push('THE OLD FEUD GETS A NEW SCAR: ' + score);
    if (context.events.indexOf('comeback') >= 0) lines.push('THE COMEBACK STARTED WHEN EVERYONE ELSE LOOKED AWAY');
    if (context.events.indexOf('overtime') >= 0 || context.events.indexOf('extra-time') >= 0) lines.push('FREE SPORT WAS A TERRIBLE IDEA FOR EVERYONE\'S HEART RATE');
    if (context.events.indexOf('upset') >= 0) lines.push('THE TABLE LIED; THE FIELD DID NOT');
    if (context.events.indexOf('record') >= 0) lines.push('A RECORD BECOMES FOLKLORE BEFORE THE CROWD SITS DOWN');
    if (context.events.indexOf('debut') >= 0) lines.push('ONE DEBUT, ONE NIGHT, ONE NAME NOBODY FORGETS');
    if (context.events.indexOf('knockout') >= 0) lines.push('THE BELL ARRIVED ONE SECOND TOO LATE');

    lines.push(context.home.athletes.length + ' STRANGE SHAPES, ONE SHARED GRUDGE, ZERO QUIET MOMENTS');
    lines.push(context.home.city.toUpperCase() + ' TO ' + context.away.city.toUpperCase() + ': THE STORY TRAVELS FASTER THAN THE SCORE');
    return shuffled(lines.filter(function (line, index, all) { return all.indexOf(line) === index; }), storySeed + '|headlines').slice(0, wanted);
  }

  function getStoryline(matchData, seed) {
    var context = normalizeMatch(matchData);
    if (!context) return null;
    var storySeed = String(seed == null ? 'story' : seed) + '|' + stableStringify(matchData || {});
    var random = seededRandom(storySeed);
    var hero = chooseHero(context, random);
    var headlines = getHeadlines(matchData, 3, storySeed);
    var hooks = context.rivalry ? [
      'They know every trick and hate the ones they invented together.',
      'The cities disagree about when this feud began; both insist they are ahead.',
      'Every meeting adds one object to a traveling cabinet of grudges.'
    ] : [
      'Two completely different bodies are trying to solve the same patch of space.',
      'The score matters. The shape of the winning moment matters more.',
      'A new matchup becomes a myth if the right impossible play happens.'
    ];
    return {
      id: 'story-' + hash(storySeed).toString(36),
      title: headlines[0],
      deck: headlines[1] || headlines[0],
      hook: hooks[Math.floor(random() * hooks.length)],
      chapter: 'Round ' + context.round + ': ' + context.home.city + ' / ' + context.away.city,
      stakes: context.rivalry ? 'RIVALRY' : 'CROSS-REGION COLLISION',
      featuredAthleteId: hero.id,
      featuredAthlete: hero,
      teams: [context.home.id, context.away.id],
      hashtags: ['#Cyberliga', '#' + context.sport.name.replace(/\s+/g, ''), '#' + hero.name.replace(/[^A-Za-z0-9]/g, '')]
    };
  }

  function createStoryArcs(sportId, seed) {
    var sport = getSport(sportId);
    if (!sport) return [];
    var arcSeed = String(seed == null ? 'season-one' : seed);
    return sport.teams.map(function (team) {
      var random = seededRandom(sport.id + '|' + arcSeed + '|' + team.id);
      var featured = team.athletes[Math.floor(random() * team.athletes.length)];
      var rival = getTeam(team.rivalryId, sport.id);
      var pressures = [
        'prove the motion language works under pressure',
        'turn a local ritual into a global celebration',
        'survive the season without sanding off their weirdest edge',
        'make the rivalry about the present instead of the archive',
        'carry a beloved misfit through their first starring season'
      ];
      return {
        id: 'arc-' + hash(arcSeed + '|' + team.id).toString(36),
        teamId: team.id,
        title: featured.name.toUpperCase() + ' AND THE ' + team.motif.toUpperCase(),
        pressure: pressures[Math.floor(random() * pressures.length)],
        featuredAthleteId: featured.id,
        rivalId: rival ? rival.id : null,
        visualHook: featured.silhouette,
        chapter: 1
      };
    });
  }

  var metrics = sports.reduce(function (totals, sport) {
    totals.sports += 1;
    totals.teams += sport.teams.length;
    totals.athletes += sport.teams.reduce(function (sum, team) { return sum + team.athletes.length; }, 0);
    return totals;
  }, { sports: 0, teams: 0, athletes: 0 });

  global.CYBERLIGA_CONTENT = {
    version: VERSION,
    sports: sports,
    metrics: metrics,
    hash: hash,
    seededRandom: seededRandom,
    getSport: getSport,
    getTeams: getTeams,
    getTeam: getTeam,
    getAthlete: getAthlete,
    createSeason: createSeason,
    getMarqueeMatchup: getMarqueeMatchup,
    getHeadlines: getHeadlines,
    getStoryline: getStoryline,
    createStoryArcs: createStoryArcs
  };
})(window);
