// ============================================================================
// CYBERLIGA LEAGUE HUB — front door of the universe.
// Reads the exact localStorage the broadcast writes ('cyberliga' league state,
// 'cyberliga_story' careers/narratives). Zero fabricated history: every line on
// this page is derived from persisted data or the fixed fixture schedule.
// ============================================================================
(function () {
  'use strict';

  // ---------- canonical league data (mirrors index.html / story.js) ----------
  var TEAMS = [
    { name: 'NEON FC',     color: '#00e5ff', mono: 'N' },
    { name: 'VOLT UTD',    color: '#ff2d78', mono: 'V' },
    { name: 'GRID ROYALS', color: '#ffc24d', mono: 'G' },
    { name: 'ASTRA NOVA',  color: '#8a5cff', mono: 'A' },
  ];
  var FIXTURES = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
  var ROLE_BY_SLOT = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
  var ROSTERS = {
    'NEON FC':     [{ n: 'OKAFOR-9', num: 1 }, { n: 'VEKTOR', num: 4 }, { n: 'HALCYON', num: 5 }, { n: 'SYNTH', num: 8 }, { n: 'AXIOM', num: 6 }, { n: 'RAZOR', num: 9 }, { n: 'PRISM', num: 11 }],
    'VOLT UTD':    [{ n: 'TESLA JR', num: 1 }, { n: 'CIPHER', num: 2 }, { n: 'ONYX', num: 5 }, { n: 'GLITCH', num: 7 }, { n: 'BLITZ', num: 8 }, { n: 'NOVA', num: 10 }, { n: 'PULSE', num: 14 }],
    'GRID ROYALS': [{ n: 'KILOWATT', num: 1 }, { n: 'MAINFRAME', num: 3 }, { n: 'TURBINE', num: 4 }, { n: 'DYNAMO', num: 7 }, { n: 'CIRCUIT', num: 10 }, { n: 'VANTA', num: 9 }, { n: 'HELIX', num: 11 }],
    'ASTRA NOVA':  [{ n: 'ORBIT', num: 1 }, { n: 'QUASAR', num: 2 }, { n: 'ZENITH', num: 6 }, { n: 'NEBULA', num: 8 }, { n: 'COMET', num: 10 }, { n: 'STARFALL', num: 9 }, { n: 'LUMEN', num: 7 }],
  };
  // Persona blurbs from PORTRAITS.md — fixed IP, not stats.
  var PERSONAS = {
    'OKAFOR-9': 'Towering calm keeper. Scarred chrome jaw plate, captain’s aura.',
    'VEKTOR': 'Lean angular veteran. Short silver hair, analytical stare.',
    'HALCYON': 'Stocky tank with a friendly grin and a glowing circuit temple tattoo.',
    'SYNTH': 'Slim graceful playmaker. Heterochromatic eyes — one cyan LED.',
    'AXIOM': 'Compact muscular engine. Headband on, jaw set in concentration.',
    'RAZOR': 'Explosive cocky striker. Cyan-tipped mohawk, lightning scar.',
    'PRISM': 'Tall serene finisher, braided hair laced with fiber-optic strands.',
    'TESLA JR': 'Wiry acrobatic keeper. Wild grin, static-charged white spikes.',
    'CIPHER': 'Mysterious masked defender behind a sleek respirator. Hooded eyes.',
    'ONYX': 'Massive immovable wall. Shaved head, stone-like skin plating.',
    'GLITCH': 'Twitchy trickster. Holographic flicker arm, mischievous smirk.',
    'BLITZ': 'Square-jawed box-to-box warrior with a taped boxer’s nose.',
    'NOVA': 'Radiant star. Supernova eyes, magenta-streaked hair, magazine looks.',
    'PULSE': 'Baby-faced young phenom. LED braces, wide energetic eyes.',
    'KILOWATT': 'Grizzled veteran. Gray stubble and one gold prosthetic eye.',
    'MAINFRAME': 'Cerebral organizer. AR glasses and a professor’s calm.',
    'TURBINE': 'Barrel-chested powerhouse, dreadlocks tied back with gold rings.',
    'DYNAMO': 'Relentless lean runner. Sweatband, hollow determined eyes.',
    'CIRCUIT': 'Regal playmaker. Gold-leaf face paint, chin permanently raised.',
    'VANTA': 'Matte-black shadow — only the glowing amber eyes are visible.',
    'HELIX': 'Corkscrew-agile winger. Double-helix shaved hair, playful wink.',
    'ORBIT': 'Serene spacey keeper. Constellation tattoos on a shaved head.',
    'QUASAR': 'Volatile enforcer. Perpetual scowl, cracked unrepaired visor.',
    'ZENITH': 'Tall noble defender. Silver-white swept-back aristocratic hair.',
    'NEBULA': 'Dreamy creative. Purple galaxy-cloud hair, distant gaze.',
    'COMET': 'Blazing-fast veteran. Motion-blur hair and a speed squint.',
    'STARFALL': 'Dramatic showman. Cape-like collar, starburst pupil implants.',
    'LUMEN': 'Bioluminescent youngster. Glowing freckles, hopeful smile.',
  };

  // Whitelists: anything in storage that isn't part of this fixed universe is
  // ignored. This is both the honesty rule and the XSS firewall — every string
  // we ever inject via innerHTML resolves to one of these canonical constants.
  var TEAM_SET = {};
  TEAMS.forEach(function (t) { TEAM_SET[t.name] = true; });
  var PLAYER_SET = {};
  Object.keys(ROSTERS).forEach(function (t) {
    ROSTERS[t].forEach(function (p) { PLAYER_SET[p.n] = true; });
  });

  // ---------- storage (defensive: corrupted/tampered JSON = fresh universe) ----------
  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch (e) { return null; }
  }
  // Counters must come out of storage as safe non-negative integers — never
  // strings (innerHTML sink) and never NaN/Infinity (loop bombs).
  function int(x) {
    x = Math.floor(+x);
    return isFinite(x) && x > 0 ? x : 0;
  }
  function isObj(x) { return !!x && typeof x === 'object'; }
  function loadLeague() {
    var raw = loadJSON('cyberliga');
    if (!isObj(raw)) raw = {};
    var rt = isObj(raw.table) ? raw.table : {};
    var l = { fixture: int(raw.fixture), table: {} };
    TEAMS.forEach(function (t) {
      var r = isObj(rt[t.name]) ? rt[t.name] : {};
      l.table[t.name] = {
        p: int(r.p), w: int(r.w), d: int(r.d), l: int(r.l),
        gf: int(r.gf), ga: int(r.ga), pts: int(r.pts),
      };
    });
    return l;
  }
  function loadStory() {
    var raw = loadJSON('cyberliga_story');
    var s = { v: 1, players: {}, h2h: {}, rivalries: {}, teams: {} };
    if (!isObj(raw) || raw.v !== 1) return s;

    var rp = isObj(raw.players) ? raw.players : {};
    Object.keys(rp).forEach(function (n) {
      if (!PLAYER_SET[n] || !isObj(rp[n])) return;
      var c = rp[n];
      s.players[n] = {
        apps: int(c.apps), goals: int(c.goals), saves: int(c.saves),
        yellows: int(c.yellows), reds: int(c.reds),
        recent: Array.isArray(c.recent) ? c.recent.slice(-5).map(int) : [],
      };
    });

    var rh = isObj(raw.h2h) ? raw.h2h : {};
    Object.keys(rh).forEach(function (k) {
      var t = k.split('|');
      if (t.length !== 2 || !TEAM_SET[t[0]] || !TEAM_SET[t[1]] || !isObj(rh[k])) return;
      var h = rh[k];
      var wins = {};
      t.forEach(function (name) {
        if (isObj(h.wins) && h.wins[name]) wins[name] = int(h.wins[name]);
      });
      s.h2h[k] = {
        wins: wins,
        draws: int(h.draws),
        last: Array.isArray(h.last)
          ? h.last.filter(function (x) { return x === 'draw' || TEAM_SET[x] === true; })
          : [],
      };
    });

    var rr = isObj(raw.rivalries) ? raw.rivalries : {};
    Object.keys(rr).forEach(function (k) {
      var p = k.split('|');
      if (p.length === 2 && PLAYER_SET[p[0]] && PLAYER_SET[p[1]]) s.rivalries[k] = int(rr[k]);
    });

    var rt = isObj(raw.teams) ? raw.teams : {};
    TEAMS.forEach(function (t) {
      var x = rt[t.name];
      if (!isObj(x)) return;
      s.teams[t.name] = {
        streakType: (x.streakType === 'W' || x.streakType === 'D' || x.streakType === 'L') ? x.streakType : '',
        streakN: int(x.streakN),
      };
    });
    return s;
  }
  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  function teamByName(name) {
    for (var i = 0; i < TEAMS.length; i++) if (TEAMS[i].name === name) return TEAMS[i];
    return TEAMS[0];
  }
  function formOf(career) {
    var r = (career && career.recent) || [];
    if (r.length < 2) return 'STEADY';
    var sum = r.reduce(function (a, x) { return a + x; }, 0);
    if (sum >= 3 || r[r.length - 1] + r[r.length - 2] >= 2) return 'HOT';
    if (r.length >= 3 && sum === 0) return 'COLD';
    return 'STEADY';
  }

  var league = loadLeague();
  var story = loadStory();

  // ---------- crests: monochrome team-color stroke on transparent ----------
  function crestSVG(team) {
    var c = team.color;
    var letter = '<text x="32" y="40.5" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="21" fill="' + c + '">' + team.mono + '</text>';
    if (team.name === 'NEON FC') {
      // hex shield + circuit traces
      return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<polygon points="32,3 58,17 58,47 32,61 6,47 6,17" fill="none" stroke="' + c + '" stroke-width="2"/>' +
        '<polygon points="32,10 52,21 52,43 32,54 12,43 12,21" fill="none" stroke="' + c + '" stroke-width="1" opacity=".5"/>' +
        '<path d="M12 30 H20 M44 30 H52 M32 54 V47" stroke="' + c + '" stroke-width="1.4" opacity=".7"/>' +
        '<circle cx="20" cy="30" r="1.8" fill="' + c + '"/><circle cx="44" cy="30" r="1.8" fill="' + c + '"/>' +
        letter + '</svg>';
    }
    if (team.name === 'VOLT UTD') {
      // angular pennant + lightning bolt
      return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<polygon points="10,6 54,6 54,34 32,60 10,34" fill="none" stroke="' + c + '" stroke-width="2"/>' +
        '<polygon points="34,10 22,32 30,32 26,48 42,26 33,26 40,10" fill="none" stroke="' + c + '" stroke-width="1.4"/>' +
        '<text x="32" y="33" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="19" fill="' + c + '">' + team.mono + '</text>' +
        '</svg>';
    }
    if (team.name === 'GRID ROYALS') {
      // crowned shield over a grid
      return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<polygon points="14,4 20,11 26,4 32,11 38,4 44,11 50,4 50,14 14,14" fill="none" stroke="' + c + '" stroke-width="1.6"/>' +
        '<path d="M14 18 H50 V40 Q50 53 32 60 Q14 53 14 40 Z" fill="none" stroke="' + c + '" stroke-width="2"/>' +
        '<path d="M23 18 V56 M41 18 V56 M14 30 H50 M15 42 H49" stroke="' + c + '" stroke-width=".8" opacity=".4"/>' +
        '<text x="32" y="44" text-anchor="middle" font-family="Archivo, sans-serif" font-weight="800" font-size="20" fill="' + c + '">' + team.mono + '</text>' +
        '</svg>';
    }
    // ASTRA NOVA: orbit ring + four-point star
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="' + c + '" stroke-width="2"/>' +
      '<ellipse cx="32" cy="32" rx="29" ry="10" fill="none" stroke="' + c + '" stroke-width="1.2" opacity=".65" transform="rotate(-24 32 32)"/>' +
      '<polygon points="49,13 50.6,17.4 55,19 50.6,20.6 49,25 47.4,20.6 43,19 47.4,17.4" fill="' + c + '"/>' +
      letter + '</svg>';
  }
  function crestHTML(team, extra) {
    return '<span class="crest" ' + (extra || '') + '>' + crestSVG(team) + '</span>';
  }

  // ---------- player portrait silhouette (placeholder until PNGs land) ----------
  function silhouetteSVG(color) {
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<rect width="100" height="100" fill="transparent"/>' +
      '<circle cx="50" cy="38" r="15" fill="rgba(255,255,255,.06)" stroke="' + color + '" stroke-opacity=".3" stroke-width="1"/>' +
      '<path d="M18 102 Q18 70 50 70 Q82 70 82 102 Z" fill="rgba(255,255,255,.06)" stroke="' + color + '" stroke-opacity=".3" stroke-width="1"/>' +
      '<path d="M30 86 L36 78 M70 86 L64 78" stroke="' + color + '" stroke-opacity=".35" stroke-width="1.4"/>' +
      '</svg>';
  }

  // ---------- schedule math ----------
  // league.fixture = completed count; FIXTURES wraps forever, matchday = index+1.
  function fixtureAt(i) {
    var pair = FIXTURES[i % FIXTURES.length];
    return { matchday: i + 1, a: TEAMS[pair[0]], b: TEAMS[pair[1]] };
  }
  // Schedule math is closed-form: fixture m plays pair FIXTURES[m % 6] for the
  // floor(m / 6)-th time, so we never walk the whole history (a tampered huge
  // fixture count must not freeze the page).
  function pairMeetings(m) {
    var n = FIXTURES.length;
    return {
      idx: Math.floor(m / n), // 0-based meeting number of this fixture's pair
      total: Math.floor(league.fixture / n) + (league.fixture % n > m % n ? 1 : 0),
    };
  }
  // Reconstruct played outcomes from story h2h ledgers (winner/draw per meeting,
  // newest last, capped at 10). Match scores are not persisted by the sim, so
  // we show outcomes — never invented scorelines. Returns the last `count`
  // completed fixtures in chronological order.
  function playedResults(count) {
    var rows = [];
    for (var m = Math.max(0, league.fixture - count); m < league.fixture; m++) {
      var f = fixtureAt(m);
      var row = { matchday: f.matchday, a: f.a, b: f.b };
      var h = story.h2h[pairKey(f.a.name, f.b.name)];
      if (h && h.last.length) {
        var mt = pairMeetings(m);
        var li = mt.idx - (mt.total - h.last.length); // offset for the 10-cap
        if (li >= 0 && li < h.last.length) row.outcome = h.last[li]; // team name | 'draw'
      }
      rows.push(row);
    }
    return rows;
  }

  // ---------- tiny html helpers ----------
  function el(id) { return document.getElementById(id); }
  function teamSpan(team, dim) {
    return '<span class="tm' + (dim ? ' dim' : '') + '" style="color:' + team.color + '">' + team.name + '</span>';
  }

  // ============================ HERO BILLBOARD ============================
  function renderBillboard() {
    var next = fixtureAt(league.fixture);
    var bb = el('billboard');

    // honest series line from persisted h2h only
    var meta = '';
    var h = story.h2h[pairKey(next.a.name, next.b.name)];
    var wa = h && h.wins ? (h.wins[next.a.name] || 0) : 0;
    var wb = h && h.wins ? (h.wins[next.b.name] || 0) : 0;
    var dr = h ? (h.draws || 0) : 0;
    // times this pairing already appeared: it occupies slot fixture % 6, played
    // once per completed 6-fixture cycle
    var priorMeetings = Math.floor(league.fixture / FIXTURES.length);
    if (wa + wb + dr > 0) {
      meta = 'ALL-TIME SERIES &mdash; <b>' + next.a.name + ' ' + wa + '</b> &middot; ' + dr + ' DRAWN &middot; <b>' + wb + ' ' + next.b.name + '</b>';
    } else if (priorMeetings === 0) {
      meta = 'FIRST EVER MEETING &mdash; A RIVALRY IS BORN TONIGHT';
    } else {
      meta = 'SERIES RECORD UNAVAILABLE &mdash; THE ARCHIVE STARTS TONIGHT';
    }

    bb.innerHTML =
      '<div class="bb-kicker"><span>NEXT &mdash; FOOTBALL &middot; MATCHDAY ' + next.matchday + '</span><span>GRAND ARENA</span></div>' +
      '<div class="bb-body">' +
        '<div class="bb-teams">' +
          '<div class="bb-team">' + crestHTML(next.a) + '<span class="bb-name" style="color:' + next.a.color + '">' + next.a.name + '</span></div>' +
          '<div class="bb-team">' + crestHTML(next.b) + '<span class="bb-name" style="color:' + next.b.color + '">' + next.b.name + '</span></div>' +
        '</div>' +
        '<div class="bb-vs">VS</div>' +
      '</div>' +
      '<div class="bb-meta">' + meta + '</div>';
  }

  // ============================ STANDINGS ============================
  function sortedTable() {
    return TEAMS.map(function (t) { return { t: t, r: league.table[t.name] }; })
      .sort(function (x, y) {
        return y.r.pts - x.r.pts || (y.r.gf - y.r.ga) - (x.r.gf - x.r.ga) || y.r.gf - x.r.gf;
      });
  }
  function renderStandings() {
    var rows = sortedTable();
    var anyPlayed = rows.some(function (x) { return x.r.p > 0; });
    el('standings-sub').textContent = anyPlayed
      ? 'AFTER ' + league.fixture + ' COMPLETED FIXTURE' + (league.fixture === 1 ? '' : 'S')
      : 'SEASON 2077 · AWAITING FIRST KICKOFF';

    var html = '<thead><tr><th class="pos">#</th><th class="club">CLUB</th>' +
      '<th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>PTS</th></tr></thead><tbody>';
    rows.forEach(function (x, i) {
      var gd = x.r.gf - x.r.ga;
      var lead = i === 0 && anyPlayed;
      html += '<tr' + (lead ? ' class="lead"' : '') + '>' +
        '<td class="pos">' + (i + 1) + '</td>' +
        '<td class="club"><span class="clubcell">' + crestHTML(x.t) +
          '<span class="cname" style="color:' + x.t.color + '">' + x.t.name + '</span>' +
        '</span></td>' +
        '<td>' + x.r.p + '</td><td>' + x.r.w + '</td><td>' + x.r.d + '</td><td>' + x.r.l + '</td>' +
        '<td>' + x.r.gf + '</td><td>' + x.r.ga + '</td><td>' + (gd > 0 ? '+' + gd : gd) + '</td>' +
        '<td class="pts">' + x.r.pts + '</td></tr>';
    });
    el('league-table').innerHTML = html + '</tbody>';
  }

  // ============================ FIXTURES & RESULTS ============================
  function renderFixtures() {
    var played = playedResults(6).reverse(); // newest first
    var rHTML = '<div class="colhead">RESULTS</div>';
    if (!played.length) {
      rHTML += '<div class="fixempty">NO MATCHES PLAYED YET &mdash; THE OPENING WHISTLE IS LOADED.</div>';
    } else {
      played.forEach(function (r) {
        var chip;
        if (r.outcome === 'draw') chip = '<span class="res draw">DRAW</span>';
        else if (r.outcome) {
          var w = teamByName(r.outcome);
          chip = '<span class="res" style="color:' + w.color + '">' + w.name + ' WIN</span>';
        } else chip = '<span class="res arch">FT &middot; ARCHIVED</span>';
        rHTML += '<div class="fixrow"><span class="md">MD ' + r.matchday + '</span>' +
          '<span class="pair">' + teamSpan(r.a, r.outcome && r.outcome !== 'draw' && r.outcome !== r.a.name) +
          '<span class="x">vs</span>' + teamSpan(r.b, r.outcome && r.outcome !== 'draw' && r.outcome !== r.b.name) +
          '</span>' + chip + '</div>';
      });
    }
    el('results-panel').innerHTML = rHTML;

    var uHTML = '<div class="colhead">UPCOMING</div>';
    for (var k = 0; k < 4; k++) {
      var f = fixtureAt(league.fixture + k);
      uHTML += '<div class="fixrow"><span class="md">MD ' + f.matchday + '</span>' +
        '<span class="pair">' + teamSpan(f.a) + '<span class="x">vs</span>' + teamSpan(f.b) + '</span>' +
        (k === 0
          ? '<a class="watchlink" href="index.html">WATCH</a>'
          : '<span class="chip">QUEUED</span>') +
        '</div>';
    }
    el('upcoming-panel').innerHTML = uHTML;
  }

  // ============================ PLAYERS ============================
  function statCell(value, key, blank) {
    return '<div class="stat"><div class="v' + (blank ? ' blank' : '') + '">' + value + '</div><div class="k">' + key + '</div></div>';
  }
  function renderPlayers() {
    var host = el('rosters');
    var html = '';
    TEAMS.forEach(function (team) {
      var rec = league.table[team.name];
      var recLine = rec.p > 0
        ? 'P' + rec.p + ' &middot; ' + rec.w + 'W-' + rec.d + 'D-' + rec.l + 'L &middot; ' + rec.pts + ' PTS'
        : 'NO MATCHES LOGGED';
      html += '<section class="team-block" style="--c:' + team.color + '">' +
        '<div class="team-head">' + crestHTML(team) +
        '<span class="tname">' + team.name + '</span>' +
        '<span class="trec">' + recLine + '</span></div><div class="cards">';

      ROSTERS[team.name].forEach(function (p, slot) {
        var role = ROLE_BY_SLOT[slot];
        var c = story.players[p.n];
        var hasStats = !!(c && c.apps > 0);
        var f = hasStats ? formOf(c) : 'STEADY';
        var formChip = '';
        if (f === 'HOT') formChip = '<span class="chip formchip hot">HOT</span>';
        else if (f === 'COLD') formChip = '<span class="chip formchip cold">COLD</span>';

        var dash = '<span>&mdash;</span>';
        var stats = hasStats
          ? statCell(c.apps, 'APPS') +
            (role === 'GK' ? statCell(c.saves || 0, 'SAVES') : statCell(c.goals || 0, 'GOALS')) +
            statCell(
              ((c.yellows || 0) || (c.reds || 0))
                ? '<span class="y">' + (c.yellows || 0) + 'Y</span> <span class="r">' + (c.reds || 0) + 'R</span>'
                : '0', 'CARDS')
          : statCell(dash, 'APPS', true) +
            statCell(dash, role === 'GK' ? 'SAVES' : 'GOALS', true) +
            statCell(dash, 'CARDS', true);

        // portraits/<TEAM>_<NAME>.png — graceful fallback to the silhouette
        var src = 'portraits/' + encodeURIComponent(team.name + '_' + p.n + '.png');
        html += '<article class="pcard" style="--c:' + team.color + '">' +
          '<span class="pnum">' + p.num + '</span>' +
          '<div class="portrait">' +
            '<span class="silhouette">' + silhouetteSVG(team.color) + '</span>' +
            '<img src="' + src + '" alt="" loading="lazy" onerror="this.remove()">' +
            formChip +
          '</div>' +
          '<div class="pbody">' +
            '<div class="pname">' + p.n + '</div>' +
            '<div class="prole">' + role + '</div>' +
            '<p class="pblurb">' + (PERSONAS[p.n] || '') + '</p>' +
            '<div class="pstats">' + stats + '</div>' +
          '</div></article>';
      });
      html += '</div></section>';
    });
    host.innerHTML = html;
  }

  // ============================ STORYLINES ============================
  // Editorial lines derived ONLY from persisted state + the fixed schedule.
  function buildStorylines() {
    var lines = [];
    var next = fixtureAt(league.fixture);
    var rows = sortedTable();
    var anyPlayed = rows.some(function (x) { return x.r.p > 0; });

    if (!anyPlayed) {
      lines.push({ tag: 'SEASON ZERO', color: '#7ef0ff',
        text: 'The football division boots up. <b>MATCHDAY 1: ' + next.a.name + ' vs ' + next.b.name + '</b> opens Season 2077 — every stat this division will ever have starts at zero tonight.' });
      lines.push({ tag: 'THE FORMAT', color: '#8fa3c8',
        text: 'Four clubs. Twenty-eight footballers. An endless round-robin where the table never sleeps and <b>nobody gets relegated — only humiliated</b>.' });
      return lines;
    }

    // 1) table leader
    var lead = rows[0], second = rows[1];
    var gap = lead.r.pts - second.r.pts;
    lines.push({ tag: 'TITLE RACE', color: lead.t.color,
      text: '<b>' + lead.t.name + '</b> sit top on <b>' + lead.r.pts + ' pts</b>' +
        (gap > 0 ? ', ' + gap + ' clear of ' + second.t.name + '.' : ' — level on points with ' + second.t.name + ', separated only by goals.') });

    // 2) next-fixture angle: revenge or series dominance
    var h = story.h2h[pairKey(next.a.name, next.b.name)];
    if (h && Array.isArray(h.last) && h.last.length) {
      var lastRes = h.last[h.last.length - 1];
      if (lastRes !== 'draw') {
        var loser = lastRes === next.a.name ? next.b : next.a;
        var winner = teamByName(lastRes);
        lines.push({ tag: 'REVENGE NIGHT', color: loser.color,
          text: 'Matchday ' + next.matchday + ': <b>' + loser.name + '</b> seek revenge — <b>' + winner.name + '</b> took the last meeting.' });
      } else {
        lines.push({ tag: 'UNFINISHED BUSINESS', color: '#7ef0ff',
          text: 'Matchday ' + next.matchday + ': ' + next.a.name + ' and ' + next.b.name + ' meet again after their last clash ended <b>all square</b>.' });
      }
    } else {
      lines.push({ tag: 'NEW BLOOD', color: '#7ef0ff',
        text: 'Matchday ' + next.matchday + ': <b>' + next.a.name + '</b> and <b>' + next.b.name + '</b> cross paths for the first time. No history. No mercy.' });
    }

    // 3) team streaks
    TEAMS.forEach(function (t) {
      var tr = story.teams[t.name];
      if (!tr || !tr.streakN) return;
      if (tr.streakType === 'W' && tr.streakN >= 2) {
        lines.push({ tag: 'STREAK WATCH', color: t.color,
          text: '<b>' + t.name + '</b> have won <b>' + tr.streakN + ' straight</b>. Who pulls the plug?' });
      } else if (tr.streakType === 'L' && tr.streakN >= 2) {
        lines.push({ tag: 'CRISIS MODE', color: t.color,
          text: '<b>' + t.name + '</b> have lost <b>' + tr.streakN + ' in a row</b>. The dressing-room servers are overheating.' });
      }
    });

    // 4) golden striker race
    var scorers = Object.keys(story.players)
      .map(function (n) { return { n: n, g: story.players[n].goals || 0 }; })
      .filter(function (x) { return x.g > 0; })
      .sort(function (a, b) { return b.g - a.g; })
      .slice(0, 3);
    if (scorers.length) {
      lines.push({ tag: 'GOLDEN STRIKER', color: '#ffc24d',
        text: scorers.map(function (s, i) {
          return (i === 0 ? '<b>' : '') + s.n + ' ' + s.g + 'G' + (i === 0 ? '</b>' : '');
        }).join(' · ') + ' — the race for the golden striker is live.' });
    }

    // 5) hot form (max 2)
    var hotCount = 0;
    Object.keys(story.players).some(function (n) {
      var c = story.players[n];
      if (formOf(c) !== 'HOT' || hotCount >= 2) return hotCount >= 2;
      var recent = c.recent || [];
      var g = recent.reduce(function (a, x) { return a + x; }, 0);
      lines.push({ tag: 'FORM ALERT', color: '#ff6b4d',
        text: '<b>' + n + '</b> is burning — <b>' + g + ' goal' + (g === 1 ? '' : 's') + ' across his last ' + recent.length + '</b>. Defenders have filed a complaint.' });
      hotCount++;
      return false;
    });

    // 6) gloves
    var keepers = ['OKAFOR-9', 'TESLA JR', 'KILOWATT', 'ORBIT']
      .map(function (n) { return { n: n, s: (story.players[n] && story.players[n].saves) || 0 }; })
      .sort(function (a, b) { return b.s - a.s; });
    if (keepers[0].s > 0) {
      lines.push({ tag: 'THE WALL', color: '#7ef0ff',
        text: '<b>' + keepers[0].n + '</b> leads all keepers with <b>' + keepers[0].s + ' career saves</b>.' });
    }

    // 7) player feuds
    var bestRiv = null;
    Object.keys(story.rivalries || {}).forEach(function (k) {
      var n = story.rivalries[k];
      if (n >= 3 && (!bestRiv || n > bestRiv.n)) {
        var p = k.split('|');
        bestRiv = { a: p[0], b: p[1], n: n };
      }
    });
    if (bestRiv) {
      lines.push({ tag: 'FEUD', color: '#ff2d78',
        text: '<b>' + bestRiv.a + ' vs ' + bestRiv.b + '</b>: ' + bestRiv.n + ' on-pitch clashes and counting. This one is personal.' });
    }

    // 8) discipline watch
    var risky = Object.keys(story.players)
      .map(function (n) { return { n: n, y: story.players[n].yellows || 0, r: story.players[n].reds || 0 }; })
      .filter(function (x) { return x.y >= 3 || x.r >= 1; })
      .sort(function (a, b) { return (b.r * 3 + b.y) - (a.r * 3 + a.y); })[0];
    if (risky) {
      lines.push({ tag: 'DISCIPLINE', color: '#ffe14d',
        text: '<b>' + risky.n + '</b> walks the tightrope: ' + risky.y + ' booking' + (risky.y === 1 ? '' : 's') +
          (risky.r ? ' and <b>' + risky.r + ' red' + (risky.r === 1 ? '' : 's') + '</b>' : '') + ' on the record.' });
    }

    return lines.slice(0, 8);
  }
  function renderStorylines(lines) {
    el('storyfeed').innerHTML = lines.map(function (s) {
      return '<article class="story">' +
        '<div class="stag">' + s.tag + '</div><p class="stext">' + s.text + '</p></article>';
    }).join('');
  }
  function renderTicker(lines) {
    var plain = lines.map(function (s) {
      var d = document.createElement('div');
      d.innerHTML = s.text;
      return s.tag + ': ' + (d.textContent || '').toUpperCase();
    });
    var next = fixtureAt(league.fixture);
    plain.unshift('FOOTBALL — NEXT ON THE GRID — MATCHDAY ' + next.matchday + ': ' + next.a.name + ' vs ' + next.b.name);
    el('tickertext').textContent = plain.join('   —   ') + '   —   ';
  }

  // ============================ ARENA STRIP ============================
  function renderSports() {
    var host = el('sportsrail');
    var cards = [
      { name: 'FOOTBALL', href: 'index.html', live: true },
      { name: 'HOCKEY', href: 'hockey.html', pending: true, sub: 'EXHIBITION ERA' },
      { name: 'BASKETBALL', href: 'hoops.html', pending: true, sub: 'EXHIBITION ERA' },
      { name: 'BASEBALL', href: 'baseball.html', pending: true },
      { name: 'FIGHTING', href: 'fight.html', pending: true },
    ];
    host.innerHTML = cards.map(function (c) {
      return '<a class="sport-cell' + (c.live ? ' live' : '') + '" href="' + c.href + '"' +
        (c.pending ? ' data-pending="true" aria-disabled="true" tabindex="-1"' : '') + '>' +
        '<span class="sname">' + c.name + '</span>' +
        '<span class="sport-status">' +
          (c.live ? '<span class="live-dot"></span>LIVE NOW' : 'IN DEVELOPMENT') +
        '</span>' +
        (c.sub ? '<span class="sport-sub">' + c.sub + '</span>' : '') +
        '</a>';
    }).join('');

    // block navigation while pending
    host.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[data-pending]') : null;
      if (a) e.preventDefault();
    });

    // arenas come online tonight: probe for the files and unlock the doors
    if (location.protocol !== 'file:' && typeof fetch === 'function') {
      host.querySelectorAll('a[data-pending]').forEach(function (a) {
        try {
          fetch(a.getAttribute('href'), { method: 'HEAD' }).then(function (r) {
            if (r && r.ok) {
              a.removeAttribute('data-pending');
              a.removeAttribute('aria-disabled');
              a.removeAttribute('tabindex');
              a.classList.add('ready');
              a.querySelector('.sport-status').textContent = 'ENTER ARENA';
            }
          }).catch(function () { /* stays in development */ });
        } catch (e) { /* stays in development */ }
      });
    }
  }

  // ============================ BOOT ============================
  try {
    renderBillboard();
    renderStandings();
    renderFixtures();
    renderPlayers();
    var lines = buildStorylines();
    renderStorylines(lines);
    renderTicker(lines);
    renderSports();
  } catch (e) {
    // Never a broken broadcast: log it, keep whatever rendered.
    console.error('CYBERLIGA hub render error', e);
  }
})();
