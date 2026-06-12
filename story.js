// ============================================================================
// CYBERLIGA STORY ENGINE — persistent careers, form, rivalries, narratives
// The IP layer. Zero dependencies on match internals: the host pushes events
// through the API and pulls HTML/ticker lines back out.
// Storage: localStorage 'cyberliga_story' (versioned, defensively parsed).
// ============================================================================

const STORE_KEY = 'cyberliga_story';
const STORE_VERSION = 1;

// Canonical league data (mirrors index.html — names/numbers are fixed IP).
const TEAM_COLORS = {
  'NEON FC': '#00e5ff',
  'VOLT UTD': '#ff2d78',
  'GRID ROYALS': '#ffc24d',
  'ASTRA NOVA': '#8a5cff',
};
// Roster order matches FORMATION slots: GK, DEF, DEF, MID, MID, FWD, FWD.
const ROLE_BY_SLOT = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD', 'FWD'];
const ROSTERS = {
  'NEON FC':     [{ n: 'OKAFOR-9', num: 1 }, { n: 'VEKTOR', num: 4 }, { n: 'HALCYON', num: 5 }, { n: 'SYNTH', num: 8 }, { n: 'AXIOM', num: 6 }, { n: 'RAZOR', num: 9 }, { n: 'PRISM', num: 11 }],
  'VOLT UTD':    [{ n: 'TESLA JR', num: 1 }, { n: 'CIPHER', num: 2 }, { n: 'ONYX', num: 5 }, { n: 'GLITCH', num: 7 }, { n: 'BLITZ', num: 8 }, { n: 'NOVA', num: 10 }, { n: 'PULSE', num: 14 }],
  'GRID ROYALS': [{ n: 'KILOWATT', num: 1 }, { n: 'MAINFRAME', num: 3 }, { n: 'TURBINE', num: 4 }, { n: 'DYNAMO', num: 7 }, { n: 'CIRCUIT', num: 10 }, { n: 'VANTA', num: 9 }, { n: 'HELIX', num: 11 }],
  'ASTRA NOVA':  [{ n: 'ORBIT', num: 1 }, { n: 'QUASAR', num: 2 }, { n: 'ZENITH', num: 6 }, { n: 'NEBULA', num: 8 }, { n: 'COMET', num: 10 }, { n: 'STARFALL', num: 9 }, { n: 'LUMEN', num: 7 }],
};

// ~12 persistent personality traits, seeded from the player's name hash.
const TRAITS = [
  'ICE COLD FINISHER', 'AGENT OF CHAOS', 'THE WALL', 'GLASS CANNON',
  'DARK ARTS SPECIALIST', 'ENGINE', 'LUXURY PLAYER', 'CAPTAIN MATERIAL',
  'BIG GAME HUNTER', 'SILENT ASSASSIN', 'CROWD FAVOURITE', 'WILD CARD',
];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function traitFor(name) { return TRAITS[hashStr(name) % TRAITS.length]; }

function blankPlayer() {
  return {
    apps: 0, goals: 0, saves: 0, duels: 0, jukes: 0,
    yellows: 0, reds: 0, shots: 0, cleanSlides: 0,
    recent: [], // goal involvement per match, last 5
  };
}
function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

function loadState() {
  try {
    const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORE_KEY) : null;
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.v === STORE_VERSION && s.players && s.h2h && s.rivalries && s.teams) return s;
    }
  } catch (e) { /* corrupted storage: start a fresh universe */ }
  return { v: STORE_VERSION, players: {}, h2h: {}, rivalries: {}, teams: {} };
}

export function createStoryEngine() {
  const S = loadState();
  let dirty = 0;
  let match = null; // current fixture tracking

  function save() {
    dirty = 0;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* quota / private mode */ }
  }
  function touch() { if (++dirty >= 10) save(); }

  function P(name) { return S.players[name] || (S.players[name] = blankPlayer()); }
  function T(name) { return S.teams[name] || (S.teams[name] = { w: 0, d: 0, l: 0, streakType: '', streakN: 0 }); }
  function H2H(a, b) {
    const k = pairKey(a, b);
    return S.h2h[k] || (S.h2h[k] = { wins: {}, draws: 0, last: [] }); // last: winner name or 'draw', newest last
  }
  function rivalryBump(a, b) {
    if (!a || !b || a === b) return;
    const k = pairKey(a, b);
    S.rivalries[k] = (S.rivalries[k] || 0) + 1;
  }

  // per-match scratch stats for MOTM + form
  function mP(name, team) {
    if (!match) return null;
    return match.players[name] || (match.players[name] = {
      team, goals: 0, saves: 0, duels: 0, jukes: 0, cleanSlides: 0, reds: 0,
    });
  }

  function form(name) {
    const r = P(name).recent;
    if (r.length < 2) return 'STEADY';
    const sum = r.reduce((a, x) => a + x, 0);
    if (sum >= 3 || (r.length >= 2 && r[r.length - 1] + r[r.length - 2] >= 2)) return 'HOT';
    if (r.length >= 3 && sum === 0) return 'COLD';
    return 'STEADY';
  }

  function teamOf(name) {
    for (const t in ROSTERS) if (ROSTERS[t].some(p => p.n === name)) return t;
    return null;
  }
  function rosterEntry(name) {
    for (const t in ROSTERS) {
      const i = ROSTERS[t].findIndex(p => p.n === name);
      if (i >= 0) return { team: t, num: ROSTERS[t][i].num, role: ROLE_BY_SLOT[i] };
    }
    return { team: null, num: 0, role: 'MID' };
  }

  function scoutNote(name, c) {
    const trait = traitFor(name);
    const { role } = rosterEntry(name);
    const gpa = c.apps ? (c.goals / c.apps) : 0;
    const bits = [];
    if (role === 'GK') {
      if (c.saves >= 10) bits.push(`${c.saves} CAREER SAVES — THE LAST LINE HOLDS`);
      else if (c.saves > 0) bits.push(`${c.saves} SAVES AND COUNTING`);
      else bits.push('UNTESTED GLOVES');
    } else if (gpa >= 1) bits.push(`AVERAGING ${gpa.toFixed(1)} GOALS A GAME`);
    else if (c.goals > 0) bits.push(`${c.goals} CAREER GOALS`);
    else if (c.duels >= 8) bits.push(`${c.duels} DUELS WON — LIVES FOR THE CONTACT`);
    else if (c.jukes >= 3) bits.push(`${c.jukes} DEFENDERS LEFT FOR DEAD`);
    else bits.push('STILL WRITING THE FIRST CHAPTER');
    if (c.reds > 0) bits.push(`${c.reds} RED${c.reds > 1 ? 'S' : ''} ON THE RECORD`);
    else if (c.yellows >= 3) bits.push(`${c.yellows} BOOKINGS — REFS KNOW THE NAME`);
    return `${trait} — ${bits.join('. ')}.`;
  }

  function ensureStyle() {
    if (typeof document === 'undefined' || document.getElementById('cl-story-style')) return;
    const st = document.createElement('style');
    st.id = 'cl-story-style';
    st.textContent = `
      .cls-panel { background: linear-gradient(180deg, rgba(8,12,28,.97), rgba(3,5,14,.97)); border:1px solid rgba(0,229,255,.3); border-radius:14px; padding:22px 26px; box-shadow:0 0 60px rgba(0,229,255,.18); min-width:380px; font-family:'Rajdhani',sans-serif; color:#cfeaff; }
      .cls-h { font-family:'Orbitron',sans-serif; font-weight:900; font-size:20px; letter-spacing:5px; margin-bottom:14px; text-shadow:0 0 14px currentColor; }
      .cls-row { display:flex; align-items:center; gap:14px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.08); }
      .cls-row:last-child { border-bottom:none; }
      .cls-ava { flex:0 0 44px; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',sans-serif; font-weight:900; font-size:17px; color:#fff; background:rgba(255,255,255,.05); }
      .cls-name { font-weight:700; font-size:16px; letter-spacing:1px; color:#fff; }
      .cls-role { font-size:10px; letter-spacing:2px; color:#8fa3c8; }
      .cls-line { font-size:13px; color:#8fa3c8; letter-spacing:.5px; }
      .cls-note { font-size:12px; color:#cfeaff; opacity:.85; letter-spacing:.5px; }
      .cls-chip { font-family:'Orbitron',sans-serif; font-size:10px; letter-spacing:2px; font-weight:700; padding:2px 8px; border-radius:99px; border:1px solid currentColor; }
      .cls-dot { display:inline-block; width:8px; height:11px; border-radius:2px; margin-left:3px; vertical-align:middle; }
      .cls-wrap { display:flex; gap:24px; align-items:flex-start; justify-content:center; }
    `;
    document.head.appendChild(st);
  }

  return {
    startMatch(teamAName, teamBName, matchday) {
      match = { a: teamAName, b: teamBName, matchday, players: {} };
    },

    event(type, payload) {
      if (!payload) return;
      const p = payload;
      switch (type) {
        case 'goal': {
          if (!p.scorer) break; // own goal: no individual credit
          const c = P(p.scorer); c.goals++;
          const m = mP(p.scorer, p.team); if (m) m.goals++;
          break;
        }
        case 'card': {
          const c = P(p.player);
          if (p.color === 'red') { c.reds++; const m = mP(p.player, p.team); if (m) m.reds++; }
          else c.yellows++;
          break;
        }
        case 'save': {
          P(p.keeper).saves++;
          const m = mP(p.keeper, p.team); if (m) m.saves++;
          break;
        }
        case 'duel': {
          P(p.winner).duels++;
          const m = mP(p.winner, p.team); if (m) m.duels++;
          break;
        }
        case 'slide': {
          if (p.clean) {
            P(p.player).cleanSlides++;
            const m = mP(p.player, p.team); if (m) m.cleanSlides++;
          } else if (p.victim) {
            rivalryBump(p.player, p.victim);
          }
          break;
        }
        case 'juke': {
          P(p.player).jukes++;
          const m = mP(p.player, p.team); if (m) m.jukes++;
          rivalryBump(p.player, p.victim);
          break;
        }
        case 'shot': {
          P(p.player).shots++;
          break;
        }
      }
      touch();
    },

    endMatch(scoreA, scoreB) {
      if (!match) return { motm: null, recapLines: [] };
      const { a, b } = match;
      const winner = scoreA > scoreB ? a : scoreB > scoreA ? b : null;

      // appearances + rolling form for everyone on both rosters
      for (const t of [a, b]) {
        for (const r of (ROSTERS[t] || [])) {
          const c = P(r.n);
          c.apps++;
          const m = match.players[r.n];
          c.recent.push(m ? m.goals : 0);
          if (c.recent.length > 5) c.recent.shift();
        }
      }

      // team H2H + overall streaks
      const h = H2H(a, b);
      if (winner) h.wins[winner] = (h.wins[winner] || 0) + 1; else h.draws++;
      h.last.push(winner || 'draw');
      if (h.last.length > 10) h.last.shift();
      const recap = [];
      for (const t of [a, b]) {
        const tr = T(t);
        const res = winner === t ? 'W' : winner ? 'L' : 'D';
        if (res === 'W') tr.w++; else if (res === 'L') tr.l++; else tr.d++;
        const prev = { type: tr.streakType, n: tr.streakN };
        if (tr.streakType === res) tr.streakN++; else { tr.streakType = res; tr.streakN = 1; }
        if (res === 'W' && tr.streakN >= 3) recap.push(`${t} MAKE IT ${tr.streakN} WINS ON THE SPIN — WHO STOPS THEM?`);
        else if (res !== 'W' && prev.type === 'W' && prev.n >= 3) recap.push(`${t}'S ${prev.n}-MATCH WIN STREAK DIES HERE`);
      }

      // MOTM: weighted score across both squads
      let motm = null, best = -Infinity;
      for (const name in match.players) {
        const m = match.players[name];
        const score = m.goals * 4 + m.saves * 2.5 + m.duels * 0.5 + m.jukes * 1 + m.cleanSlides * 1 - m.reds * 5;
        if (score > best) { best = score; motm = { name, m }; }
      }
      let motmOut = null;
      if (motm && best > 0) {
        const m = motm.m;
        const parts = [];
        if (m.goals) parts.push(`${m.goals} GOAL${m.goals > 1 ? 'S' : ''}`);
        if (m.saves) parts.push(`${m.saves} SAVE${m.saves > 1 ? 'S' : ''}`);
        if (m.jukes) parts.push(`${m.jukes} JUKE${m.jukes > 1 ? 'S' : ''}`);
        if (m.duels) parts.push(`${m.duels} DUELS WON`);
        if (m.cleanSlides) parts.push(`${m.cleanSlides} CLEAN TACKLE${m.cleanSlides > 1 ? 'S' : ''}`);
        motmOut = { name: motm.name, team: m.team, line: parts.join(', ') || 'RAN THE SHOW' };
        recap.unshift(`MAN OF THE MATCH: ${motm.name} (${m.team}) — ${motmOut.line}`);
      }
      recap.unshift(winner
        ? `FULL TIME: ${winner} TAKE IT ${Math.max(scoreA, scoreB)}-${Math.min(scoreA, scoreB)} OVER ${winner === a ? b : a}`
        : `FULL TIME: ${a} ${scoreA}-${scoreB} ${b} — HONOURS EVEN`);

      match = null;
      save();
      return { motm: motmOut, recapLines: recap.slice(0, 3) };
    },

    prematchLines(teamAName, teamBName) {
      const lines = [];
      // 1) hot scorer
      for (const [t, opp] of [[teamAName, teamBName], [teamBName, teamAName]]) {
        for (const r of (ROSTERS[t] || [])) {
          const c = S.players[r.n];
          if (!c || c.recent.length < 2) continue;
          const last3 = c.recent.slice(-3);
          const g = last3.reduce((x, y) => x + y, 0);
          if (g >= 3) { lines.push(`${r.n} HAS ${g} GOALS IN HIS LAST ${last3.length} — ${opp} HAVE BEEN WARNED`); break; }
        }
        if (lines.length) break;
      }
      // 2) H2H drought
      const h = S.h2h[pairKey(teamAName, teamBName)];
      if (h && h.last.length >= 3) {
        for (const t of [teamAName, teamBName]) {
          let n = 0;
          for (let i = h.last.length - 1; i >= 0 && h.last[i] !== t; i--) n++;
          if (n >= 3 && n === h.last.length) { lines.push(`${t} HAVEN'T BEATEN ${t === teamAName ? teamBName : teamAName} IN ${n} MEETINGS`); break; }
          if (n >= 3) { lines.push(`${t} ARE WINLESS IN ${n} AGAINST ${t === teamAName ? teamBName : teamAName}`); break; }
        }
      }
      // 3) rivalry between players on opposite sides tonight
      let bestRiv = null;
      for (const k in S.rivalries) {
        const n = S.rivalries[k];
        if (n < 3) continue;
        const [p1, p2] = k.split('|');
        const t1 = teamOf(p1), t2 = teamOf(p2);
        const onShow = (t1 === teamAName && t2 === teamBName) || (t1 === teamBName && t2 === teamAName);
        if (onShow && (!bestRiv || n > bestRiv.n)) bestRiv = { p1, p2, n };
      }
      if (bestRiv) lines.push(`${bestRiv.p1} vs ${bestRiv.p2}: ${bestRiv.n} CLASHES AND COUNTING — THE FEUD RESUMES`);
      // 4) discipline watch
      if (lines.length < 3) {
        for (const t of [teamAName, teamBName]) {
          const risky = (ROSTERS[t] || []).map(r => ({ n: r.n, c: S.players[r.n] }))
            .filter(x => x.c && x.c.yellows >= 3).sort((x, y) => y.c.yellows - x.c.yellows)[0];
          if (risky) { lines.push(`${risky.n} CARRIES ${risky.c.yellows} BOOKINGS INTO THIS ONE — WALKING A TIGHTROPE`); break; }
        }
      }
      return lines.slice(0, 3);
    },

    setHeadshots(map) { this._headshots = map; }, // Map<'NAME|TEAM' or 'NAME', dataURL>
    profileHTML(teamName) {
      ensureStyle();
      const color = TEAM_COLORS[teamName] || '#7ef0ff';
      const roster = ROSTERS[teamName] || [];
      const rows = roster.map((r, i) => {
        const role = ROLE_BY_SLOT[i];
        const c = S.players[r.n] || blankPlayer();
        const f = form(r.n);
        const fCol = f === 'HOT' ? '#ff6b4d' : f === 'COLD' ? '#6f9aff' : '#8fa3c8';
        const careerLine = role === 'GK'
          ? `P${c.apps} · ${c.saves} SAVES`
          : role === 'DEF'
            ? `P${c.apps} · ${c.duels} DUELS · ${c.goals}G`
            : `P${c.apps} · ${c.goals}G · ${c.jukes} JUKES`;
        const dots =
          Array(Math.min(c.yellows, 5)).fill(`<span class="cls-dot" style="background:#ffe14d"></span>`).join('') +
          Array(Math.min(c.reds, 3)).fill(`<span class="cls-dot" style="background:#ff3b3b"></span>`).join('');
        const shot = this._headshots && (this._headshots.get(r.n + '|' + teamName) || this._headshots.get(r.n));
        const avaInner = shot
          ? `<img src="${shot}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`
          : r.num;
        return `<div class="cls-row">
          <div class="cls-ava" style="box-shadow:0 0 0 2px ${color}, 0 0 12px ${color}55;overflow:hidden">${avaInner}</div>
          <div style="flex:1;min-width:0">
            <div><span class="cls-name">${r.n}</span> <span class="cls-role">${role}</span>${dots}</div>
            <div class="cls-line">${careerLine}</div>
            <div class="cls-note">${scoutNote(r.n, c)}</div>
          </div>
          <span class="cls-chip" style="color:${fCol}">${f}</span>
        </div>`;
      }).join('');
      return `<div class="cls-panel"><div class="cls-h" style="color:${color}">${teamName}</div>${rows}</div>`;
    },

    leagueWrapHTML(teamAName, teamBName) {
      ensureStyle();
      const a = teamAName || (match && match.a) || 'NEON FC';
      const b = teamBName || (match && match.b) || 'VOLT UTD';
      return `<div class="cls-wrap">${this.profileHTML(a)}${this.profileHTML(b)}</div>`;
    },

    reset() {
      S.players = {}; S.h2h = {}; S.rivalries = {}; S.teams = {};
      match = null;
      save();
    },
  };
}
