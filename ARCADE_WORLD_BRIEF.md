# Cyberliga arcade world — implementation contract

The user wants a fresh, compelling, faster sports world covering all six sports. Prior realistic/procedural character studies were rejected. This implementation chooses expressive, crisp pixel athletes with smooth continuous movement and consistent broadcast presentation. The subsequent Higgsfield-video inquiry was withdrawn; generated footage is not evidence of functioning gameplay.

## Scope and preservation

Start: canonical 81da1208210027f03e0e3580526748874509df0a. Feature branch only; no deployment. Preserve autonomous engines, six sports, 48 canonical clubs, 416 athletes, 24 fixture slots, globe/game network, League HQ, fixture links, deterministic hooks, and mobile viewing. Home and Leagues are the only global primary destinations. No play, pause, restart or fullscreen controls. Side identification remains cyan/hot pink, with canonical club identity in the uniforms and broadcast. Retain compatibility rigs internally where their updates affect engine timing or heading; only the visible draw path changes.

## Shared render adapter

Import `installArcadeBroadcast` from `./arcade-broadcast.js` and call once after all state is initialized, before the animation driver:

```js
installArcadeBroadcast({ sportId, renderer, readFrame });
```

The shared layer intercepts renderer.render (GPU submissions) and renders the new stage. It does not own a second simulation clock. Do not feed it rounded render_game_to_text snapshots. readFrame returns raw state:

```js
{
  sportId, fixtureId, time, phase, clock, period,
  teams: [{id,name,code,city,score,colors:{primary,secondary,accent}}],
  venue: {name,city}, bounds: {halfX,halfZ},
  entities: [{id,name,number,team:0,role,x,y,z,vx,vz,facing,action,progress,visible,hasBall,profile}],
  projectile: {x,y,z,vx,vy,vz,ownerId,mode},
  event: {title,detail,type}, presentation: {attackSign}
}
```

Coordinates are engine metres, y is physical lift above the floor, facing zero is +z. Use canonical identity, real ownership, current state, actual score. clock may be seconds or a readable string. Entity number and profile can fall back sensibly. Sport ids: soccer, american-football, basketball, hockey, baseball, combat. Shared layer exposes __arcadeFrame and __arcadeView diagnostics.

## Work ownership

- Architecture implementer: index.html, football.html, football.js adapters.
- Court implementer: hoops.html and hockey.html adapters.
- Field/ring implementer: baseball.html and fight.html adapters.
- Manager: shared renderer/CSS, world/HQ, fixture resolver, integration, QA, documentation, commit.

Do not change another implementer's files. Do not commit independently. Report adapter details and material limitations. Preserve game probability, physical contact timing, and simulation state; do not speed everything by dropping phases. There must be no fabricated live event or score.

## Acceptance

All six games run autonomously with actual variable outcomes and visible canonical athletes. Continuous motion, readable ball and contacts, compact action framing, consistent desktop/portrait/landscape viewing. HQ fixture links select the actual advertised clubs. Verify errors, finite state, overflow and deterministic hooks, then inspect live motion and screenshots. Use independent review against the user goal, not only programmatic metrics. Deliver a reviewable local feature and release handoff, not a claim of production readiness.
