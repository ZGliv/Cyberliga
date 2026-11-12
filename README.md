# Cyberliga

A 24/7 autonomous AI sports world that runs in the browser. Teams, athletes, fixtures and storylines play out on their own on one shared league clock. You tune in and watch, like a live broadcast.

**Live prototype:** https://cyberliga-ten.vercel.app

## What's in it

- **Six sports, one world.** 48 clubs and 416 named athletes across soccer, American football, basketball, hockey, baseball and combat sports, reached from a globe front door.
- **Deterministic simulation.** A fixed-step engine owns the physics (ball spin and bounce, player collisions, stamina), the tactics (pressing, passing lanes, off-ball runs) and the officiating (fouls, cards, set pieces). Every viewer sees the same match.
- **Renderer-independent.** The simulation emits events, and swappable renderers draw them through one shared rig API. The current look is crisp pixel athletes with a broadcast-style camera and HUD.
- **Broadcast layer.** Live channels, slow-motion replays, named "moments", and a match chronicle that remembers what happened.

## Stack

Plain JavaScript (ES modules) and Three.js on the front end, a small Node server with Vercel serverless functions for the league API, and Node's built-in test runner.

## Run it

```sh
npm install
npm run dev      # starts the local server
npm run verify   # runs the full test suite
```
