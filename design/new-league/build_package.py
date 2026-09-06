from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'output/pdf/cyberliga-new-league-design.pdf'
ASSETS = ROOT / 'assets'
FONTS = Path('/Users/Test/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/standard_fonts')
pdfmetrics.registerFont(TTFont('Sans', str(FONTS / 'LiberationSans-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Bold', str(FONTS / 'LiberationSans-Bold.ttf')))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Bold', italic='Sans', boldItalic='Bold')
W, H = 1000, 750
INK = HexColor('#182725')
PAPER = HexColor('#F4F0E6')
CREAM = HexColor('#E5DDCD')
MUTED = HexColor('#63726C')
RUST = HexColor('#BD542F')
TEAL = HexColor('#126A67')
GOLD = HexColor('#D1AA55')
LIGHT = HexColor('#E5E8DF')
c = canvas.Canvas(str(OUT), pagesize=(W,H), pageCompression=1)
c.setTitle('Cyberliga - A new league | Design review 01')
c.setAuthor('Cyberliga / design study prepared with Codex')
c.setSubject('Original 3v3 league, cast, mobile broadcast and motion design concepts; not gameplay')
page_num = 0

def rect(x,y,w,h,fill,stroke=None,lw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    c.setLineWidth(lw)
    c.rect(x,y,w,h,fill=1,stroke=bool(stroke))

def line(x1,y1,x2,y2,color=CREAM,lw=1):
    c.setStrokeColor(color); c.setLineWidth(lw); c.line(x1,y1,x2,y2)

def text(s,x,y,size=14,font='Sans',color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawString(x,y,s)

def right(s,x,y,size=14,font='Sans',color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawRightString(x,y,s)

def para(s,x,top,w,size=15,color=INK,bold=False,leading=None,maxh=None):
    style=ParagraphStyle('p',fontName='Bold' if bold else 'Sans',fontSize=size,leading=leading or size*1.35,textColor=color,spaceAfter=0)
    p=Paragraph(s,style)
    pw,ph=p.wrap(w,1000)
    if maxh is not None and ph>maxh:
        raise ValueError(f'Text exceeds box ({ph}>{maxh}): {s[:70]}')
    p.drawOn(c,x,top-ph)
    return ph

def image(name,x,y,w,h):
    path=ASSETS/name
    if not path.exists(): raise FileNotFoundError(path)
    with Image.open(path) as im: iw,ih=im.size
    scale=min(w/iw,h/ih)
    dw,dh=iw*scale,ih*scale
    c.drawImage(str(path),x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto')

def begin(section,dark=False):
    global page_num
    page_num+=1
    rect(0,0,W,H,INK if dark else PAPER)
    color=PAPER if dark else INK
    text('CYBERLIGA',42,710,15,'Bold',color)
    text('/  DESIGN REVIEW 01',145,710,10,'Sans',GOLD if dark else MUTED)
    right(section.upper(),958,710,10,'Bold',color)
    line(42,693,958,693,MUTED if dark else CREAM)
    line(42,41,958,41,MUTED if dark else CREAM)
    text('CONCEPT STUDIES  /  SEPTEMBER 2026  /  NO APPLICATION CHANGES',42,24,8,'Sans',GOLD if dark else MUTED)
    right(f'{page_num:02d}',958,23,11,'Bold',color)

def end(): c.showPage()

def heading(title,sub=None,dark=False):
    text(title,42,647,36,'Bold',PAPER if dark else INK)
    if sub: para(sub,42,624,900,14,GOLD if dark else MUTED,maxh=50)

def pill(s,x,y,w,color=RUST):
    rect(x,y,w,23,color)
    text(s,x+9,y+7,9,'Bold',PAPER)

def arrow(x1,y1,x2,y2,color=INK,lw=2):
    line(x1,y1,x2,y2,color,lw)
    a=math.atan2(y2-y1,x2-x1)
    l=7
    line(x2,y2,x2-l*math.cos(a-.45),y2-l*math.sin(a-.45),color,lw)
    line(x2,y2,x2-l*math.cos(a+.45),y2-l*math.sin(a+.45),color,lw)

def clubmark(x,y,sz,color,kind):
    c.setStrokeColor(color); c.setLineWidth(sz*.07)
    if kind=='kiln':
        p=c.beginPath(); p.moveTo(x,y);p.lineTo(x,y+sz*.72);p.curveTo(x,y+sz*1.13,x+sz,y+sz*1.13,x+sz,y+sz*.72);p.lineTo(x+sz,y);p.close()
        c.drawPath(p,stroke=1,fill=0)
        line(x+sz*.25,y+sz*.18,x+sz*.75,y+sz*.18,color,sz*.07)
    else:
        line(x,y+sz*.75,x+sz*.65,y+sz*.75,color,sz*.17)
        line(x+sz*.35,y+sz*.25,x+sz,y+sz*.25,color,sz*.17)

def jersey(x,y,w,h,color,number,name,back=False):
    pts=[(.16,1),(.32,1),(.40,.90),(.60,.90),(.68,1),(.84,1),(.80,.80),(.88,.66),(.87,0),(.13,0),(.12,.66),(.20,.80)]
    p=c.beginPath()
    for i,(px,py) in enumerate(pts):
        (p.moveTo if i==0 else p.lineTo)(x+px*w,y+py*h)
    p.close();c.setFillColor(color);c.setStrokeColor(INK);c.setLineWidth(1.5);c.drawPath(p,fill=1,stroke=1)
    c.setFillColor(PAPER);c.setFont('Bold',w*.1)
    c.drawCentredString(x+w/2,y+h*.66,name)
    c.setFont('Bold',w*.34);c.drawCentredString(x+w/2,y+h*.30,number)
    line(x+w*.25,y+h*.10,x+w*.75,y+h*.10,PAPER,2)

def scorebug(x,y,w,h=52):
    rect(x,y,w,h,INK)
    rect(x,y,5,h,RUST);rect(x+w-5,y,5,h,TEAL)
    text('PIT',x+14,y+29,12,'Bold',PAPER)
    text('KILN',x+14,y+12,8,'Sans',CREAM)
    right('OAK',x+w-14,y+29,12,'Bold',PAPER)
    right('SWITCH',x+w-14,y+12,8,'Sans',CREAM)
    c.setFillColor(PAPER);c.setFont('Bold',25);c.drawCentredString(x+w/2,y+23,'12 - 14')
    c.setFillColor(GOLD);c.setFont('Sans',9);c.drawCentredString(x+w/2,y+8,'0:42   /   SHOT 12')

def phone(x,y,scale=1):
    c.saveState();c.translate(x,y);c.scale(scale,scale)
    rect(-7,-7,404,858,INK)
    rect(0,0,390,844,PAPER)
    text('CYBERLIGA',18,813,18,'Bold')
    right('WATCH',372,815,10,'Bold',TEAL)
    scorebug(12,739,366,57)
    rect(12,192,366,535,CREAM)
    image('court-portrait.png',12,192,366,535)
    rect(12,157,366,35,INK)
    text('LATCH  7',24,170,11,'Bold',PAPER)
    right('PIT POSSESSION',366,170,9,'Sans',GOLD)
    text('THE CHECKPOINT',18,132,13,'Bold')
    text('Pittsburgh Kiln vs Oakland Switch',18,111,11,'Sans',MUTED)
    line(18,88,372,88)
    text('NEXT',18,67,9,'Bold',TEAL)
    text('Schedule and standings below the match',59,67,10,'Sans',MUTED)
    rect(0,0,390,43,INK)
    for label,xx,col in [('WATCH',40,GOLD),('LEAGUE',158,PAPER),('PLAYERS',283,PAPER)]:text(label,xx,17,11,'Bold',col)
    c.restoreState()

def landscape(x,y,w=870,h=402):
    rect(x-6,y-6,w+12,h+12,INK)
    rect(x,y,w,h,CREAM)
    image('court-landscape.png',x,y,w,h)
    scorebug(x+16,y+h-67,305,51)
    rect(x+w-125,y+h-45,109,29,INK)
    text('CYBERLIGA',x+w-113,y+h-35,12,'Bold',PAPER)
    rect(x+16,y+16,255,36,INK)
    text('7  LATCH',x+28,y+36,10,'Bold',PAPER)
    text('PIT POSSESSION  /  THE CHECKPOINT',x+28,y+23,8,'Sans',GOLD)

def smallcourt(x,y,w,h,stage):
    rect(x,y,w,h,HexColor('#E2D2B3'))
    margin=12
    line(x+margin,y+margin,x+w-margin,y+margin,INK)
    line(x+margin,y+margin,x+margin,y+h-margin,INK)
    line(x+w-margin,y+margin,x+w-margin,y+h-margin,INK)
    line(x+margin,y+h-margin,x+w-margin,y+h-margin,INK)
    # Native schematic, not an inferred rendered scene.
    c.setStrokeColor(RUST);c.setLineWidth(1.5)
    c.rect(x+w*.35,y+h*.51,w*.30,h*.40,fill=0)
    c.arc(x+w*.16,y+h*.10,x+w*.84,y+h*1.15,180,180)
    c.circle(x+w/2,y+h*.85,5,stroke=1,fill=0)
    line(x+w*.42,y+h*.9,x+w*.58,y+h*.9,INK,2)
    pos=[
        [(7,.35,.27),(44,.46,.58),(11,.83,.32),(4,.44,.35),(33,.53,.77),(21,.74,.43)],
        [(7,.35,.5),(44,.56,.64),(11,.83,.32),(4,.30,.48),(33,.42,.65),(21,.74,.43)],
        [(7,.32,.5),(44,.56,.7),(11,.83,.32),(4,.32,.38),(33,.43,.72),(21,.66,.65)],
        [(7,.32,.5),(44,.51,.67),(11,.83,.32),(4,.30,.37),(33,.54,.79),(21,.74,.45)],
    ][stage]
    for num,px,py in pos:
        xx=x+w*px;yy=y+h*py
        fill=RUST if num in [7,44,11] else TEAL
        c.setFillColor(fill);c.setStrokeColor(PAPER);c.setLineWidth(1);c.circle(xx,yy,9,stroke=1,fill=1)
        c.setFillColor(PAPER);c.setFont('Bold',7);c.drawCentredString(xx,yy-2.4,str(num))
    if stage==0:arrow(x+w*.35,y+h*.31,x+w*.36,y+h*.49,INK)
    if stage==1:arrow(x+w*.40,y+h*.54,x+w*.53,y+h*.61,INK)
    if stage==2:arrow(x+w*.60,y+h*.67,x+w*.81,y+h*.36,INK)
    if stage==3:
        c.setDash(3,3);arrow(x+w*.83,y+h*.37,x+w*.52,y+h*.82,INK);c.setDash()

# 01 / Cover
begin('The new direction',True)
text('A LEAGUE WORTH',42,634,49,'Bold',PAPER)
text('FOLLOWING.',42,581,49,'Bold',PAPER)
para('Six athletes. One court. A match you want to see again.',46,552,820,20,GOLD)
image('cast.png',42,162,916,356)
line(42,143,958,143,MUTED)
for x,num,label in [(42,'03','PLAYERS PER SIDE'),(348,'01','OFFICIAL MATCH'),(654,'04:00','PROPOSED LIVE CLOCK')]:
    text(num,x,95,31,'Bold',PAPER);text(label,x+110,104,10,'Bold',GOLD)
text('A product and visual proposal. Generated studies are not gameplay footage.',42,60,11,'Sans',CREAM)
end()

# 02 / Product
begin('Product definition')
heading('Open on the match. Leave with a favorite.','The smallest complete experience that can prove the league-and-fandom idea.')
rect(42,306,552,258,INK)
text('THE FIRST VISIT',66,533,10,'Bold',GOLD)
steps=[('01','Understand the contest','Who is playing, who has possession and what the next basket means.'),('02','Recognize a decision','See a player create an opening and an opponent try to close it.'),('03','Remember the athlete','A name, a movement, a consequence and a reason to watch a rematch.')]
for i,(n,ti,body) in enumerate(steps):
    yy=496-i*75;text(n,66,yy,21,'Bold',GOLD);text(ti,107,yy,18,'Bold',PAPER);para(body,107,yy-11,455,13,CREAM)
text('PROTOTYPE SCOPE',629,544,10,'Bold',TEAL)
for yy,num,label in [(500,'2','provisional clubs'),(441,'6','distinct athletes'),(382,'1','intimate arena')]:
    text(num,629,yy,36,'Bold');text(label,685,yy+8,16)
para('A four-club, twelve-athlete league comes after repeat viewing is demonstrated.',629,329,305,14,MUTED)
text('THE REAL CREATIVE TEST',42,247,11,'Bold',RUST)
para('Can someone explain why the play worked, name the player they like, and choose to watch another match?',42,215,840,28,bold=True,leading=34)
text('Future distribution: entertainment first; a separately assessed operator product later.',42,72,13,'Sans',MUTED)
end()

# 03 / Directions
begin('Art direction comparison')
heading('Three treatments. One clarity test.','Same broad athletic archetypes. These are medium explorations, not the final named roster.')
cols=[(42,'A','Graphic sculpture','direction-a-refined.png',RUST,'RECOMMENDED STUDY','Smooth masses and controlled shading give contact, posture and jerseys room to read.','Next test: avoid generic mascot shapes; keep the ball clear at 390 px.'),(354,'B','Handmade miniatures','direction-b-initial.png',MUTED,'MATERIAL EXPLORATION','Tactile surfaces add warmth, but this generation drifts into realistic detail.','Not the recommended production target: too much surface noise on a phone.'),(666,'C','Sports comic','direction-c-initial.png',TEAL,'ALTERNATIVE','Strong contours and graphic attitude create a clear illustration language.','Next test: camera rotation, contact and contour stability in actual motion.')]
for x,code,title,img,col,tag,body,risk in cols:
    text(code,x,564,30,'Bold',col);text(title,x+35,570,18,'Bold')
    rect(x,326,292,218,CREAM);image(img,x,326,292,218)
    pill(tag,x,288,224,col)
    para(body,x,267,280,14,maxh=99)
    para(risk,x,166,280,12,MUTED,maxh=85)
text('A is a visual recommendation, not proof of riggability, frame rate or viewer recognition.',42,66,12,'Sans',MUTED)
end()

# 04 / Cast
begin('The first six')
heading('Different before the name appears.','Recommended direction applied to a complete roster. All identities are provisional.')
image('cast.png',42,125,916,476)
roster=[('7','LATCH','PIT / CREATOR','Upright pause. Low pass.',RUST),('44','BRUNT','PIT / FINISHER','Plant. Pivot. Hold ground.',RUST),('11','ZIP','PIT / SHOOTER','Quiet feet. Quick release.',RUST),('4','NIX','OAK / DISRUPTOR','Invite. Intercept.',TEAL),('33','TOLL','OAK / RIM GUARD','Wait. Rise vertically.',TEAL),('21','SABLE','OAK / STOPPER','Slide. Unfold the contest.',TEAL)]
for i,(num,name,role,signature,col) in enumerate(roster):
    x=142+i*119
    line(x,110,x+107,110,col,2)
    text(num+' / '+name,x,90,12,'Bold',col)
    text(role,x,71,8,'Bold',MUTED)
end()

# 05 / Behavior
begin('The matchup')
heading('Patience meets pressure.','Club identity should explain how the team competes, then carry into clothing and venue details.')
clubmark(45,505,49,RUST,'kiln');text('PITTSBURGH KILN',118,536,25,'Bold',RUST)
para('Patient. Physical. Earn the opening.',118,519,345,14,MUTED)
clubmark(531,505,49,TEAL,'switch');text('OAKLAND SWITCH',604,536,25,'Bold',TEAL)
para('Disrupt. Exchange. Punish hesitation.',604,519,350,14,MUTED)
left=[('LATCH / 7','Creates passing lanes; passes up his own shot.','Nix tries to make patience look like fear.'),('BRUNT / 44','Wins position; holds the ball when challenged.','Toll is the rival whose strength he respects.'),('ZIP / 11','Finds small windows; forces shots when frustrated.','Sable knows the habits of a former teammate.')]
right_rows=[('NIX / 4','Reads passes; abandons position on a gamble.','Latch refuses to be hurried.'),('TOLL / 33','Times vertical contests; recovers slowly outside.','Brunt tests his composure at the basket.'),('SABLE / 21','Contains and recovers; can overfocus on one player.','Zip wants to prove the release has changed.')]
for col,x in [(left,42),(right_rows,530)]:
    for i,(name,strength,rival) in enumerate(col):
        yy=447-i*113
        line(x,yy+20,x+426,yy+20)
        text(name,x,yy,16,'Bold')
        para(strength,x,yy-13,426,14,maxh=44)
        para(rival,x,yy-58,426,12,MUTED,maxh=34)
para('Rivalries start as character context. Claims about wins, records and breakthroughs must later come from actual match events.',42,91,897,14,MUTED,maxh=40)
end()

# 06 / Portrait
begin('Portrait broadcast')
heading('The phone is the primary seat.','A native layout study with a generated court illustration. All score state is illustrative.')
phone(73,64,.607)
notes=[('01 / ONE GLANCE','Club identity, score, game clock and shot clock occupy a compact strip.'),('02 / THE COURT LEADS','Stable elevated composition. Bright floor, subdued crowd, strong side colors.'),('03 / CONTEXT IN ONE LINE','Name the player when the action makes the name useful.'),('04 / KEEP WATCHING','Schedule, history and player files live below the broadcast.'),('05 / ROTATE BY CHOICE','Landscape expands context. It never resets the match.')]
for i,(title,body) in enumerate(notes):
    yy=564-i*92
    text(title,387,yy,12,'Bold',TEAL)
    para(body,387,yy-15,533,17,maxh=60)
para('Not yet validated: ball tracking, limb contact, real device performance or animation. The next motion prototype must establish those.',387,97,533,12,MUTED,maxh=39)
end()

# 07 / Landscape
begin('Landscape broadcast')
heading('More context. The same competition.','A separate camera and layout for the same official match; the illustration is a composition study.')
landscape(59,178,882,398)
for x,title,body in [(42,'HOLD THE CONTEST','Preserve the ball, receiver and defender through the decisive interaction.'),(354,'RESTRAIN THE OVERLAYS','A score strip and contextual identification are enough during live play.'),(666,'KEEP ONE EVENT HISTORY','Orientation, crowd effects and replay presentation cannot change outcomes.')]:
    text(title,x,129,11,'Bold',TEAL)
    para(body,x,111,286,13,maxh=56)
end()

# 08 / Possession
begin('Motion and decision storyboard')
heading('Twelve seconds that explain a basket.','Authored example, not footage: Pittsburgh trails 12-14. A made three would make it 15-14.')
beats=[('0-3 SEC','THE GAMBLE','Nix reaches. Latch keeps the dribble and turns toward a planted screen.'),('3-6 SEC','THE HELP','Toll steps up. Brunt rolls. Latch chooses the pocket pass.'),('6-9 SEC','THE EXTRA PASS','Sable leaves Zip. Brunt recognizes help and passes out instead of forcing the hook.'),('9-12 SEC','THE RELEASE','Zip adjusts his feet. The shot leaves before the horn as Sable recovers.')]
for i,(tim,title,body) in enumerate(beats):
    x=42+i*234
    pill(tim,x,547,92,TEAL if i==3 else RUST)
    smallcourt(x,298,214,232,i)
    text(title,x,269,15,'Bold')
    para(body,x,250,214,14,maxh=100)
text('DESIGN THE CHOICE, NOT A GUARANTEED ENDING',42,158,12,'Bold',RUST)
para('Release at 11.8 seconds; basket at about 13.0 (game clock 0:29); Oakland restarts at 15.0. No replay hides the next possession. Also demonstrate a defender staying home, a tipped pass, a late release and a miss. This ending is never forced.',42,135,890,14,maxh=65)
end()

# 09 / Motion and identity
begin('From movement to identity')
heading('Make the number mean something.','Uniform translation schematic. Provisional marks and names; no product is manufactured or offered for sale.')
jersey(54,272,193,260,RUST,'7','KILN')
jersey(270,272,193,260,RUST,'7','LATCH',True)
text('FRONT',111,248,10,'Bold',MUTED);text('BACK',332,248,10,'Bold',MUTED)
motion=[('LATCH','A still upright beat makes the low pass surprising.'),('BRUNT','Feet plant before contact; the pivot carries visible weight.'),('ZIP','Set feet, gather, release, land. Fast is not instantaneous.'),('DEFENDERS','Slide, commit, contest and recover with visible tradeoffs.')]
for i,(title,body) in enumerate(motion):
    yy=547-i*86
    text(title,532,yy,13,'Bold',TEAL)
    para(body,532,yy-16,418,16,maxh=60)
line(42,192,958,192)
text('A MEMORY EARNS THE SHIRT',42,159,12,'Bold',RUST)
para('The same name, number, face and signature must survive a live match, exact replay, player file and physical jersey. Merchandise demand is tested after attachment appears.',42,135,897,18,maxh=64)
end()

# 10 / Rules
begin('Prototype rules')
heading('Familiar basketball. Explicit boundaries.','Experimental prototype rules. This is not a claim of FIBA compliance or wagering approval.')
rules=[('MATCH','3v3, one basket, no substitutions or elimination. Four minutes of live playing time; clock stops on baskets, whistles and free throws. Two-second automatic restarts.'),('SCORING','Two inside the arc; three outside; one per free throw. A foot touching the arc counts as inside. No target-score early finish.'),('POSSESSION','12 seconds. New defensive control resets to 12, including clearing time. Offensive rim rebounds reset; non-rim rebounds retain the clock or turn over if expired. A legal release can finish after the horn.'),('CLEARING','After a steal or defensive rebound, control the ball with both feet beyond the arc before shooting. A possession gained there is already cleared.'),('RESTARTS','Opening possession is selected once and recorded. Dead-ball changes and baskets restart at a fixed point beyond the arc. Last touch decides out-of-bounds. Replays never hide live play.'),('FOULS','Offensive foul: turnover, no basket. Nonshooting defense: restart, or two free throws from the fourth team foul. Shooting fouls: two/three for a miss, or basket plus one.'),('FREE THROWS','Final missed free throw is reboundable. No foul-outs. Team foul counts continue into overtime. Detailed transitions belong in the rules specification.'),('ENDING','Finish legal buzzer shots and associated penalties. Ties enter sudden-death overtime; the non-opening team starts. First valid point wins; unused free throws are omitted.')]
for i,(title,body) in enumerate(rules):
    x=42+(i//4)*474;yy=559-(i%4)*116
    text(title,x,yy,12,'Bold',TEAL)
    para(body,x,yy-17,440,14,maxh=88)
para('Actual broadcast length exceeds four minutes. Pacing, long overtime and technical suspension policies must be resolved by testing; never invent a result to fit a schedule.',42,86,905,12,MUTED,maxh=36)
end()

# 11 / Architecture
begin('Foundation and implementation order')
heading('One match. One record. Every surface agrees.','Separate competition decisions from rendering, commentary and commercial systems.')
nodes=[('RULES + CAST','Versioned configuration'),('MATCH ENGINE','One authoritative instance'),('EVENT HISTORY','Ordered events + checkpoints'),('BROADCAST + RECORDS','Cameras, replays, careers')]
for i,(title,body) in enumerate(nodes):
    x=42+i*234
    rect(x,466,214,98,INK)
    text(title,x+13,529,11,'Bold',GOLD)
    para(body,x+13,507,188,13,PAPER,maxh=40)
    if i<3:arrow(x+216,515,x+229,515,TEAL)
stages=[('01','Motion proof','Dribble/catch, screen/contact, shot/rebound, reaction.'),('02','Competition proof','Two teams, simple geometry, a complete autonomous match.'),('03','Integrated prototype','Selected cast, one court, two cameras and exact replay.'),('04','Small league','Four clubs only after viewers choose to return.')]
for i,(num,title,body) in enumerate(stages):
    yy=405-i*67;text(num,42,yy,26,'Bold',RUST);text(title,94,yy+5,19,'Bold');para(body,360,yy+11,566,15,maxh=45)
line(42,116,958,116)
para('Private future randomness. Controlled policy updates. Explicit outages. No influence from purchases, fan votes or wagering exposure. Operator integration requires separate counsel, laboratory and partner scoping.',42,98,906,14,MUTED,maxh=43)
end()

# 12 / Review
begin('The review decision',True)
heading('Approve the look. Then prove the motion.',dark=True)
para('The recommendation is A: simplified graphic 3D, a six-athlete cast, and the portrait court as the primary broadcast.',42,577,878,25,PAPER,bold=True,leading=32,maxh=100)
criteria=[('CAST','Can you tell the six apart without the roster? Do you want to see them compete?'),('COURT','Does the phone composition make the ball and decisive matchup the focus?'),('TONE','Does the league feel like an original sports property you would follow?')]
for i,(title,body) in enumerate(criteria):
    yy=430-i*89;text(title,42,yy,12,'Bold',GOLD);para(body,179,yy+8,740,19,PAPER,maxh=60)
line(42,172,958,172,MUTED)
text('NEXT BOUNDED BUILD',42,139,11,'Bold',GOLD)
para('One motion study and one autonomous possession prototype. Assess real animation, ball contact and identity at phone size before a full application rebuild.',42,117,887,17,PAPER,maxh=51)
end()

c.save()
print(f'Created {OUT} ({page_num} pages)')
