// presentation.js — broadcast-style event overlays + commentary line banks for CYBERLIGA.
// Lower-third event cards (cards, fouls, penalties, free kicks, skill moves) styled to match
// the existing HUD package in index.html (Orbitron/Rajdhani, navy panels, cyan neon).
// Usage:
//   import { createPresentation } from './presentation.js';
//   const pres = createPresentation();
//   pres.showEvent({ kind: 'yellow', title: pres.lines.yellow('GLITCH', 'A CYNICAL TRIP'), subtitle: 'VOLT UTD', color: '#ff2d78' });

const STYLE_ID = 'cyberliga-presentation-style';

const CSS = `
#presentation-layer {
  position: absolute;
  left: 18px;
  bottom: 92px;            /* above ticker (34px) + sound pill zone */
  pointer-events: none;
  font-family: 'Rajdhani', sans-serif;
  z-index: 5;
}
.pres-card {
  --pres-accent: #00e5ff;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 300px;
  max-width: 460px;
  padding: 10px 18px 10px 14px;
  background: linear-gradient(180deg, rgba(8,12,28,.94), rgba(4,6,16,.94));
  border: 1px solid rgba(0,229,255,.25);
  border-radius: 8px;
  box-shadow: 0 0 24px rgba(0,229,255,.16), inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(6px);
  transform: translateX(-120%);
  opacity: 0;
  transition: transform .25s cubic-bezier(.2,1.4,.3,1), opacity .25s ease;
}
.pres-card.in { transform: translateX(0); opacity: 1; }
.pres-card.out {
  transform: translateX(-120%);
  opacity: 0;
  transition: transform .25s cubic-bezier(.6,0,.8,.4), opacity .25s ease;
}
.pres-kicker {
  font-family: 'Orbitron', sans-serif;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 3px;
  color: #6fe3ff;
  margin-bottom: 2px;
}
.pres-title {
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1.5px;
  color: #fff;
  text-shadow: 0 0 10px var(--pres-accent);
  text-transform: uppercase;
  line-height: 1.25;
}
.pres-sub {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(220,245,255,.75);
  text-transform: uppercase;
  margin-top: 2px;
}
.pres-cardgfx {
  flex: 0 0 auto;
  width: 18px;
  height: 26px;
  border-radius: 3px;
  transform: rotate(-10deg);
}
.pres-cardgfx.yellow { background: #ffe14d; box-shadow: 0 0 14px rgba(255,225,77,.85), 0 0 30px rgba(255,225,77,.4); }
.pres-cardgfx.red    { background: #ff3b30; box-shadow: 0 0 14px rgba(255,59,48,.85), 0 0 30px rgba(255,59,48,.4); }
.pres-card.penalty {
  padding: 14px 22px 14px 18px;
  animation: pres-pen-pulse 1s ease-in-out infinite;
}
.pres-card.penalty .pres-title { font-size: 18px; letter-spacing: 2px; }
@keyframes pres-pen-pulse {
  0%, 100% { box-shadow: 0 0 24px rgba(0,229,255,.16), 0 0 0 0 var(--pres-accent), inset 0 1px 0 rgba(255,255,255,.06); }
  50%      { box-shadow: 0 0 40px rgba(0,229,255,.35), 0 0 18px -6px var(--pres-accent), inset 0 1px 0 rgba(255,255,255,.06); }
}
.pres-card.skill { min-width: 220px; padding: 7px 14px 7px 12px; }
.pres-card.skill .pres-title { font-size: 13px; }
`;

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const KICKERS = {
  yellow: 'YELLOW CARD',
  red: 'RED CARD',
  foul: 'FOUL',
  penalty: 'PENALTY',
  freekick: 'FREE KICK',
  skill: 'SKILL MOVE',
};

export function createPresentation() {
  // inject style once
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // container — into #hud if present, else body (defensive)
  const hud = document.getElementById('hud') || document.body;
  let layer = document.getElementById('presentation-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'presentation-layer';
    hud.appendChild(layer);
  }

  const queue = [];
  let showing = false;

  function renderCard({ kind, title, subtitle, color }) {
    const card = document.createElement('div');
    card.className = 'pres-card';
    if (kind === 'penalty') card.classList.add('penalty');
    if (kind === 'skill') card.classList.add('skill');
    const accent = color || '#00e5ff';
    card.style.setProperty('--pres-accent', accent);
    card.style.borderColor = accent;

    if (kind === 'yellow' || kind === 'red') {
      const gfx = document.createElement('div');
      gfx.className = 'pres-cardgfx ' + kind;
      card.appendChild(gfx);
    }

    const text = document.createElement('div');
    const kicker = document.createElement('div');
    kicker.className = 'pres-kicker';
    kicker.textContent = KICKERS[kind] || 'EVENT';
    kicker.style.color = accent;
    const titleEl = document.createElement('div');
    titleEl.className = 'pres-title';
    titleEl.textContent = title || '';
    text.appendChild(kicker);
    text.appendChild(titleEl);
    if (subtitle) {
      const sub = document.createElement('div');
      sub.className = 'pres-sub';
      sub.textContent = subtitle;
      text.appendChild(sub);
    }
    card.appendChild(text);
    return card;
  }

  function playNext() {
    const ev = queue.shift();
    if (!ev) { showing = false; return; }
    showing = true;
    const card = renderCard(ev);
    layer.appendChild(card);
    // slide in on next frame so the transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('in')));
    const hold = ev.kind === 'skill' ? 2000 : 3500;
    setTimeout(() => {
      card.classList.remove('in');
      card.classList.add('out');
      setTimeout(() => {
        card.remove();
        playNext();
      }, 300);
    }, hold);
  }

  function showEvent(ev) {
    if (!ev || !ev.kind) return;
    queue.push(ev);
    if (!showing) playNext();
  }

  // ============ COMMENTARY LINE BANKS ============
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
  };

  return { showEvent, lines };
}
