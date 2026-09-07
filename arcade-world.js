import { athleteSprite } from './arcade-broadcast.js';

const C = window.CYBERLIGA_CONTENT;
const INK = '#101e31', PAPER = '#f4f4ed', BLUE = '#2b4ef0', ACID = '#d8fd63';

function entityFor(team, athlete, side = 0) {
  return { id:athlete.id, name:athlete.name, number:athlete.number, team:side, portrait:true,
    role:athlete.role, action:'idle', progress:0, colors:team.colors,
    profile:window.CyberligaCharacters?.get?.(athlete.id) || athlete };
}

/** Static portraits use the exact broadcast sprite and canonical athlete ID. */
export function drawArcadePortrait(canvas, { team, athlete, side = 0, sportId = team?.sportId, backdrop = false }) {
  if (!canvas || !team || !athlete) return;
  canvas.width = 160; canvas.height = 168;
  canvas.dataset.athleteId = athlete.id;
  canvas.dataset.renderer = 'authored-pixel-canvas';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;ctx.clearRect(0,0,160,168);
  if (backdrop) {
    ctx.fillStyle = PAPER;ctx.fillRect(0,0,160,168);
    ctx.fillStyle = '#e8e9e1';ctx.fillRect(8,118,144,36);
    ctx.fillStyle = ACID;ctx.fillRect(14,18,44,10);
  }
  ctx.fillStyle = '#101e3124';ctx.fillRect(34,148,92,8);
  ctx.drawImage(athleteSprite(entityFor(team,athlete,side),sportId,0),16,0,128,168);
}

export function drawArcadeLineup(canvas, team, { side = 0, count = 5 } = {}) {
  if (!canvas || !team) return;
  canvas.width = 520; canvas.height = 280;canvas.dataset.renderer = 'authored-pixel-canvas';
  const ctx = canvas.getContext('2d');ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = BLUE;ctx.fillRect(0,0,520,280);ctx.fillStyle = '#3458f4';
  for (let x=-280;x<620;x+=70) {
    ctx.beginPath();ctx.moveTo(x,280);ctx.lineTo(x+260,0);ctx.lineTo(x+266,0);ctx.lineTo(x+6,280);ctx.fill();
  }
  ctx.strokeStyle = '#8fafff';ctx.lineWidth = 2;
  ctx.beginPath();ctx.ellipse(260,258,190,46,0,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle = ACID;ctx.fillRect(20,20,12,12);
  ctx.fillStyle = PAPER;ctx.font='bold 11px monospace';ctx.fillText(`${team.code} / THE ROSTER`,42,30);
  const athletes = team.athletes.slice(0,count),middle = (athletes.length-1)/2;
  const spread = Math.min(88,380/Math.max(1,athletes.length-1));
  const ordered = athletes.map((athlete,index)=>({athlete,index})).sort((a,b)=>Math.abs(b.index-middle)-Math.abs(a.index-middle));
  for (const {athlete,index} of ordered) {
    const distance=Math.abs(index-middle),scale=distance<.6?4:3;
    const w=32*scale,h=42*scale,x=260+(index-middle)*spread-w/2,y=258-h-distance*12;
    ctx.fillStyle='#101e3144';ctx.fillRect(x+8,y+h-3,w-16,7);
    ctx.drawImage(athleteSprite(entityFor(team,athlete,side),team.sportId,0),Math.round(x),Math.round(y),w,h);
  }
  ctx.fillStyle=INK;ctx.fillRect(366,224,134,36);
  ctx.fillStyle=ACID;ctx.font='bold 12px monospace';ctx.fillText(`${team.athletes.length} ATHLETES`,380,247);
}

export function paintArcadePortraits(root = document) {
  root.querySelectorAll('canvas[data-arcade-athlete]').forEach(canvas => {
    const team = C?.getTeam(canvas.dataset.teamId,canvas.dataset.sport);
    const athlete = team && C.getAthlete(team.id,canvas.dataset.arcadeAthlete);
    drawArcadePortrait(canvas,{team,athlete,side:Number(canvas.dataset.side)||0,backdrop:canvas.dataset.backdrop==='true'});
  });
  root.querySelectorAll('canvas[data-arcade-team]').forEach(canvas => {
    const team = C?.getTeam(canvas.dataset.arcadeTeam,canvas.dataset.sport);
    drawArcadeLineup(canvas,team,{side:Number(canvas.dataset.side)||0,count:Number(canvas.dataset.count)||5});
  });
}
