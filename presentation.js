// presentation.js — CYBERLIGA broadcast tiers, sim-synced event queue, in-game feed.
//
// The old sliding lower-third cards are GONE. Every broadcast moment now belongs to
// one of three tiers:
//
//   TIER 1 OVERLAY  — GOAL, PENALTY, RED CARD, FULL TIME. Full-screen moments the
//                     HOST renders (goal flash, big cards, penalty banner). This
//                     module only sequences them through the sim-synced queue and
//                     hands them back from drain() in `overlays`.
//   TIER 2 FEED     — yellow cards, big saves, skills/jukes, near misses, on-the-spot
//                     rulings, MOTM. Compact one-line items in the vertical feed
//                     (rendered HERE, newest on top, max 4, auto-fade ~8s).
//   TIER 3 TICKER   — routine commentary (fouls, free kicks, corners, throw-ins,
//                     pressure). drain() returns the due lines in `ticker`; the host
//                     feeds its bottom marquee (commentate).
//
// SYNC CONTRACT (the "feed reads ahead of the play" fix):
//   post(ev) enqueues with ev.simTime — seconds on the HOST's monotonic sim clock
//   (index.html's `simT`). For outcomes decided before they are visible (a GK save
//   resolved at dive commit), the host stamps simTime = simT + timeToVisualEvent.
//   drain(renderedSimTime, mode) is called ONCE PER RENDERED FRAME (i.e. only when
//   tick() is about to composer.render(), NOT on hidden-tab catch-up ticks):
//     - nothing emerges while mode === 'replay'; held items are credited the held
//       time so a replay never stales them — they release right after,
//     - only items with simTime <= renderedSimTime emerge,
//     - at most ONE tier-2 feed item materializes per call, so a catch-up burst
//       cascades one item per render instead of dumping five at once,
//     - items that out-age their freshness budget (in sim seconds) are dropped
//       silently — the feed captions the play on screen, never old news.
//
// BACKWARD COMPAT (page boots before the integrator rewires call sites):
//   showEvent({kind,title,subtitle,color}) still works — tier-1/2 kinds materialize
//   immediately as feed items (no lower-third), tier-3 kinds are dropped here since
//   the host already tickers them. lines.* keeps all old keys and signatures.
//   clear() still flushes everything at match boundaries.

const STYLE_ID = 'cyberliga-feed-style';

export const TIERS = { OVERLAY: 1, FEED: 2, TICKER: 3 };

const TIER_BY_KIND = {
  // tier 1 — host-rendered full-screen moments
  goal: 1, penalty: 1, red: 1, fulltime: 1,
  // tier 2 — compact feed items
  yellow: 2, save: 2, skill: 2, juke: 2, nearmiss: 2, ruling: 2, sub: 2, motm: 2, context: 2,
  // tier 3 — ticker-only routine commentary
  foul: 3, freekick: 3, corner: 3, throwin: 3, pressure: 3, kickoff: 3, info: 3,
};
export function tierOf(kind) { return TIER_BY_KIND[kind] || 3; }

// freshness budget per tier in SIM seconds (replay holds are credited back, so a
// 7s replay never kills the queue behind it)
const SLACK_TIER = { 1: Infinity, 2: 8, 3: 14 };
// per-kind overrides — a skill caption from 6 seconds ago is ancient history
const SLACK_KIND = { skill: 5, juke: 6, nearmiss: 6 };

const CHIP = {
  goal: 'GOAL', penalty: 'PEN', red: 'RED', fulltime: 'FT',
  yellow: 'YC', save: 'SAVE', skill: 'SKILL', juke: 'JUKE', nearmiss: 'CLOSE',
  ruling: 'REF', sub: 'SUB', motm: 'MOTM', context: 'STAT',
  foul: 'FOUL', freekick: 'FK', corner: 'CRN', throwin: 'THROW', info: 'INFO',
};

const CSS = `
/* fallback anchor used only when the host never calls attach(el) — top-right is the
   one HUD corner free of scoreboard/momentum (top-center), pills (top/bottom-left),
   replay tag (top-left), watermark (bottom-right) and ticker (bottom) */
#clfeed-fallback {
  position: absolute; top: 64px; right: 18px; z-index: 5;
}
.clfeed {
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  pointer-events: none; font-family: 'Rajdhani', sans-serif;
}
.clfeed-item {
  --clf-accent: #00e5ff;
  display: flex; align-items: center; gap: 8px;
  max-width: 340px; max-height: 44px; overflow: hidden;
  padding: 5px 10px 5px 8px;
  background: linear-gradient(90deg, rgba(8,12,28,.6), rgba(4,6,16,.92));
  border: 1px solid rgba(0,229,255,.16);
  border-right: 3px solid var(--clf-accent);
  border-radius: 6px;
  backdrop-filter: blur(5px);
  opacity: 0; transform: translateX(18px);
  transition: opacity .28s ease, transform .32s cubic-bezier(.2,1.2,.3,1);
}
.clfeed-item.in { opacity: 1; transform: translateX(0); }
.clfeed-item.out {
  opacity: 0; transform: translateX(12px);
  max-height: 0; padding-top: 0; padding-bottom: 0; margin-top: -6px; /* swallow flex gap */
  transition: opacity .3s ease, transform .3s ease,
              max-height .35s ease .05s, padding .35s ease .05s, margin .35s ease .05s;
}
.clfeed-chip {
  flex: 0 0 auto;
  font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 8px;
  letter-spacing: 1.5px; padding: 3px 6px; border-radius: 4px;
  color: var(--clf-accent); border: 1px solid var(--clf-accent);
  background: rgba(0,0,0,.25); text-shadow: 0 0 6px var(--clf-accent);
}
.clfeed-chip.solid {
  color: #10131f; background: var(--clf-chip, #ffe14d); border-color: var(--clf-chip, #ffe14d);
  text-shadow: none; box-shadow: 0 0 10px var(--clf-chip, #ffe14d);
}
.clfeed-min {
  flex: 0 0 auto;
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 9px;
  letter-spacing: 1px; color: rgba(140,170,200,.9);
}
.clfeed-txt {
  font-weight: 700; font-size: 13px; letter-spacing: 1px; color: #eaf7ff;
  text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.clfeed-item.major { border-right-width: 4px; box-shadow: 0 0 18px -6px var(--clf-accent); }
.clfeed-item.major .clfeed-txt {
  font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 1.5px;
}
`;

export function createPresentation(opts = {}) {
  // Copy variation is presentation-only and must never consume the match RNG.
  const rng = opts.rng || Math.random;
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  // inject style once
  if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ============ FEED UI (tier 2 renderer) ============
  const FEED_MAX = 4;       // last 3-4 events visible, newest on top
  const FEED_TTL = 8000;    // ms before an item fades itself out
  let listEl = null;        // element items are prepended into
  const live = [];          // newest first: { el, dead, ttlTimer }

  /** Host hands us its container div (positioned by index.html CSS); we build all
   *  item DOM inside it. Until then a self-mounted fallback keeps the page working. */
  function attach(el) {
    if (!el || el === listEl) return;
    el.classList.add('clfeed');
    if (listEl) {
      while (listEl.firstChild) el.appendChild(listEl.firstChild);
      if (listEl.id === 'clfeed-fallback') listEl.remove();
    }
    listEl = el;
  }

  function ensureList() {
    if (listEl) return listEl;
    const hud = document.getElementById('hud') || document.body;
    let el = document.getElementById('clfeed-fallback');
    if (!el) {
      el = document.createElement('div');
      el.id = 'clfeed-fallback';
      hud.appendChild(el);
    }
    el.classList.add('clfeed');
    listEl = el;
    return listEl;
  }

  function fadeOut(rec) {
    const i = live.indexOf(rec);
    if (i >= 0) live.splice(i, 1);
    if (rec.dead) return;
    rec.dead = true;
    clearTimeout(rec.ttlTimer);
    rec.el.classList.remove('in');
    rec.el.classList.add('out');
    setTimeout(() => rec.el.remove(), 500);
  }

  function materialize(ev) {
    const list = ensureList();
    const item = document.createElement('div');
    item.className = 'clfeed-item' + (ev.tier === TIERS.OVERLAY ? ' major' : '');
    item.style.setProperty('--clf-accent', ev.color || '#00e5ff');

    const chip = document.createElement('span');
    chip.className = 'clfeed-chip';
    chip.textContent = CHIP[ev.kind] || String(ev.kind).toUpperCase().slice(0, 5);
    if (ev.kind === 'yellow' || ev.kind === 'red') {
      chip.classList.add('solid');
      chip.style.setProperty('--clf-chip', ev.kind === 'yellow' ? '#ffe14d' : '#ff3b30');
    }
    item.appendChild(chip);

    if (ev.clock) {
      const m = document.createElement('span');
      m.className = 'clfeed-min';
      m.textContent = ev.clock;
      item.appendChild(m);
    }

    const tx = document.createElement('span');
    tx.className = 'clfeed-txt';
    tx.textContent = ev.subtitle ? `${ev.title} · ${ev.subtitle}` : (ev.title || '');
    item.appendChild(tx);

    list.prepend(item);
    // slide in on the next frame so the transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => item.classList.add('in')));

    const rec = { el: item, dead: false, ttlTimer: 0 };
    rec.ttlTimer = setTimeout(() => fadeOut(rec), FEED_TTL);
    live.unshift(rec);
    while (live.length > FEED_MAX) fadeOut(live[live.length - 1]); // fadeOut splices immediately
  }

  // ============ SIM-SYNCED EVENT QUEUE ============
  const pending = [];
  let lastDrainT = null;

  /** Enqueue a broadcast event.
   *  ev = { kind, simTime, title, subtitle?, team?, color?, clock?, tier?, force? }
   *  simTime: host sim-clock seconds (index.html simT). Stamp it AT or AFTER the
   *  moment the event becomes VISIBLE on screen — e.g. a save resolved at dive
   *  commit gets simTime = simT + timeToBallArrival, never the decision instant. */
  function post(ev) {
    if (!ev || !ev.kind) return;
    const tier = ev.tier || tierOf(ev.kind);
    const e = {
      kind: ev.kind,
      tier,
      simTime: (typeof ev.simTime === 'number' && isFinite(ev.simTime)) ? ev.simTime : null,
      title: ev.title || '',
      subtitle: ev.subtitle || '',
      team: ev.team || '',
      color: ev.color || '',
      clock: ev.clock || '',
      force: !!ev.force,
      slack: SLACK_KIND[ev.kind] != null ? SLACK_KIND[ev.kind]
           : (SLACK_TIER[tier] != null ? SLACK_TIER[tier] : 12),
    };
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i];
      // a newer skill caption supersedes a queued one
      if (e.kind === 'skill' && q.kind === 'skill') { pending.splice(i, 1); continue; }
      // exact dupes collapse (the near-miss detector can re-fire on consecutive frames)
      if (q.kind === e.kind && q.title === e.title) return;
    }
    pending.push(e);
  }

  /** Release everything due at the rendered sim time. Call once per RENDERED frame.
   *  Returns { overlays: [tier1 events], feed: [tier2 events already rendered into
   *  the feed — at most one], ticker: [tier3 events for the host marquee] }. */
  function drain(renderedSimTime, mode) {
    const out = { overlays: [], feed: [], ticker: [] };
    const t = (typeof renderedSimTime === 'number' && isFinite(renderedSimTime)) ? renderedSimTime : 0;
    const step = lastDrainT == null ? 0 : Math.max(0, t - lastDrainT);
    lastDrainT = t;

    if (mode === 'replay') {
      // hold EVERYTHING through the replay; credit the held time back so the queue
      // releases — not expires — the moment live action resumes
      for (const e of pending) e.slack += step;
      return out;
    }

    let feedBudget = 1; // max ONE feed item per rendered frame — bursts cascade
    for (let i = 0; i < pending.length; i++) {
      const e = pending[i];
      if (e.simTime != null && e.simTime > t) continue; // not visible yet — hold
      const age = e.simTime == null ? 0 : t - e.simTime;
      if (age > e.slack) { pending.splice(i, 1); i--; continue; } // stale: drop silently
      if (e.tier === TIERS.FEED) {
        if (!feedBudget) continue;
        feedBudget--;
        pending.splice(i, 1); i--;
        materialize(e);
        out.feed.push(e);
      } else {
        pending.splice(i, 1); i--;
        (e.tier === TIERS.OVERLAY ? out.overlays : out.ticker).push(e);
      }
    }
    return out;
  }

  /** LEGACY entry point (pre-integration call sites). No sim clock available here,
   *  so tier-1/2 kinds materialize immediately as feed items — no lower-third cards,
   *  no drain needed. Tier-3 kinds are dropped: the host already tickers those. */
  function showEvent(ev) {
    if (!ev || !ev.kind) return;
    const tier = tierOf(ev.kind);
    if (tier === TIERS.TICKER) return;
    materialize({
      kind: ev.kind, tier,
      title: ev.title || '', subtitle: ev.subtitle || '',
      color: ev.color || '', clock: '',
    });
  }

  /** Flush the queue and the on-screen feed — call at match boundaries so nothing
   *  from the last fixture leaks into the next one. */
  function clear() {
    pending.length = 0;
    lastDrainT = null;
    for (const rec of live) { clearTimeout(rec.ttlTimer); rec.el.remove(); }
    live.length = 0;
  }

  // ============ COMMENTARY LINE BANKS ============
  // `lines`   — TIER 3 flavor for the ticker marquee (full sentences, drama).
  //             All pre-existing keys/signatures preserved.
  // `feedLines` — TIER 2 captions for the feed (short, punchy, ~40 chars max).
  // PHRASING RULE: no bank may claim an outcome the viewer hasn't seen yet — save
  // lines describe the stop, so they must only surface AT the visual save (the host
  // stamps simTime at ball arrival, not at the AI's dive-commit decision).
  const lines = {
    foul(victim, offender) {
      return pick([
        `${offender} SCYTHES DOWN ${victim}`,
        `${offender} CLATTERS INTO ${victim} — THAT'S NASTY`,
        `CYNICAL FROM ${offender}! ${victim} IS FLATTENED`,
        `${victim} HITS THE TURF — ${offender} WANTED THAT ONE`,
        `${offender} TAKES THE PLAYER, NOT THE BALL`,
        `WHISTLE GOES — ${offender} CHOPS ${victim} IN HALF`,
      ]);
    },
    yellow(player, reason) {
      return pick([
        `BOOKED: ${player} — ${reason}`,
        `${player} GOES IN THE BOOK — ${reason}`,
        `YELLOW FOR ${player}! ${reason}`,
        `THE REF FLASHES YELLOW AT ${player} — ${reason}`,
        `${player} PICKS UP A CAUTION — ${reason}`,
        `NO ARGUMENTS THERE — ${player} BOOKED FOR ${reason}`,
      ]);
    },
    red(player, reason) {
      return pick([
        `RED CARD! ${player} IS OFF — ${reason}`,
        `${player} SEES RED! ${reason}`,
        `OFF! OFF! OFF! ${player} — ${reason}`,
        `STRAIGHT RED FOR ${player} — ${reason}`,
        `${player} GETS HIS MARCHING ORDERS — ${reason}`,
        `DISGRACEFUL FROM ${player} — RED CARD, NO DEBATE`,
      ]);
    },
    secondYellow(player) {
      return pick([
        `SECOND YELLOW! ${player} IS WALKING`,
        `${player} BOOKED AGAIN — THAT'S A RED!`,
        `MADNESS FROM ${player} — TWO YELLOWS MAKE A RED`,
        `${player} HAD TO BE SMARTER — SECOND BOOKING, OFF HE GOES`,
        `YELLOW NUMBER TWO FOR ${player} — EARLY SHOWER`,
        `${player} SELF-DESTRUCTS — SECOND CAUTION AND GONE`,
      ]);
    },
    penalty(team) {
      return pick([
        `PENALTY TO ${team}! THE REF POINTS TO THE SPOT!`,
        `SPOT KICK! HUGE MOMENT FOR ${team}!`,
        `${team} HAVE A PENALTY — THE ARENA ERUPTS!`,
        `IT'S GIVEN! PENALTY, ${team}!`,
        `NO HESITATION — PENALTY FOR ${team}!`,
        `${team} FROM TWELVE YARDS — THIS IS MASSIVE!`,
      ]);
    },
    freekick(team) {
      return pick([
        `FREE KICK ${team} — DANGEROUS TERRITORY`,
        `${team} HAVE A SET PIECE — WALL'S FORMING`,
        `WHISTLE GOES — FREE KICK TO ${team}`,
        `${team} WIN A FREE KICK IN A SPICY SPOT`,
        `DEAD BALL FOR ${team} — KEEPER'S NOT HAPPY`,
        `${team} LINE ONE UP — THIS COULD BE TASTY`,
      ]);
    },
    skill(player, move) {
      const M = String(move || 'move').toUpperCase();
      return pick([
        `FILTHY ${M} FROM ${player}!`,
        `${player} BREAKS OUT THE ${M} — OUTRAGEOUS!`,
        `OH THAT'S DISRESPECTFUL — ${player} WITH THE ${M}!`,
        `${player} HITS THE ${M} AT FULL SPRINT!`,
        `SHOWTIME! ${player} GOES ${M}!`,
        `${player} DIALS UP A ${M} — PURE SAUCE!`,
      ]);
    },
    juked(victim, player) {
      return pick([
        `${victim} SENT FOR A HOT DOG BY ${player}!`,
        `${player} PUTS ${victim} ON SKATES!`,
        `ANKLES GONE! ${victim} IS ON THE TURF!`,
        `${player} TURNS ${victim} INSIDE OUT — HE'S DOWN!`,
        `${victim} NEEDS HIS GPS — ${player} VANISHED!`,
        `${player} LEAVES ${victim} IN ANOTHER POSTCODE!`,
      ]);
    },
    // ticker flavor for moments the host used to hardcode — issue these AT the
    // visual event (sync via post/drain), never at the AI decision
    saveCatch(keeper) {
      return pick([
        `${keeper} CLAIMS IT! WHAT HANDS`,
        `${keeper} GATHERS — CALM AS YOU LIKE`,
        `SHOT SWALLOWED WHOLE — ${keeper} SAYS NO`,
        `${keeper} PLUCKS IT OUT OF THE AIR`,
      ]);
    },
    saveParry(keeper) {
      return pick([
        `${keeper} FINGERTIPS IT AWAY! WHAT A SAVE`,
        `${keeper} AT FULL STRETCH — DENIED!`,
        `STRONG WRISTS FROM ${keeper} — BEATEN AWAY`,
        `${keeper} GETS A GLOVE TO IT — STILL ALIVE!`,
      ]);
    },
    nearMiss(player) {
      return pick([
        `${player} INCHES WIDE! SO CLOSE`,
        `${player} SHAVES THE PAINT — NOTHING DOING`,
        `OH ${player}! A COAT OF VARNISH AWAY`,
        `${player} LETS FLY — JUST PAST THE POST`,
      ]);
    },
  };

  const feedLines = {
    yellow(player, reason) {
      return pick([
        `${player} BOOKED — ${reason}`,
        `YELLOW: ${player}`,
        `${player} IN THE BOOK`,
      ]);
    },
    red(player) {
      return pick([
        `${player} SENT OFF`,
        `RED: ${player} WALKS`,
        `${player} IS OFF`,
      ]);
    },
    save(keeper, mode) {
      return mode === 'catch'
        ? pick([`${keeper} CLAIMS IT`, `${keeper} — SAFE HANDS`, `${keeper} HOLDS ON`])
        : pick([`${keeper} PALMS IT AWAY`, `BIG STOP — ${keeper}`, `${keeper} AT FULL STRETCH`]);
    },
    nearmiss(player) {
      return pick([`${player} INCHES WIDE`, `SO CLOSE — ${player}`, `${player} OFF TARGET, JUST`]);
    },
    skill(player, move) {
      const M = String(move || 'move').toUpperCase();
      return pick([`${player}: ${M}!`, `${M} BY ${player}`, `${player} WITH THE ${M}`]);
    },
    juked(victim, player) {
      return pick([`${player} LEAVES ${victim} BEHIND`, `${victim} TURNED INSIDE OUT`, `ANKLES GONE — ${victim}`]);
    },
    penalty(team) {
      return pick([`PENALTY — ${team}`, `${team} FROM THE SPOT`]);
    },
    ruling(text) { return text; },
    motm(name) { return `MAN OF THE MATCH — ${name}`; },
  };

  return { showEvent, clear, lines, feedLines, post, drain, attach, tierOf, TIERS };
}
