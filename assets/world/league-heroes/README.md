# Cyberliga venue image system

These six AI-assisted venue studies are the approved visual baseline for League HQ. They are fictional architecture, generated with the built-in image generation workflow, then compressed to 1672×941 JPEG at quality 84 for the web application.

| League | Anchor club | Venue | Asset |
| --- | --- | --- | --- |
| The Common Ground | Tokyo Paper Cranes | The Fold | `soccer-v2.jpg` |
| The Sunday Animal | New Orleans Bayou Kings | The Crown | `american-football-v2.jpg` |
| The High Room | New York Brownstones | The Block | `basketball-v2.jpg` |
| The Cold Argument | Montréal Sugar Maples | Cabane 21 | `hockey-v2.jpg` |
| The Long Afternoon | Mexico City Alebrijes | El Taller | `baseball-v2.jpg` |
| The Handmade Undercard | Accra Brass Bell | The Foundry | `combat-v2.jpg` |

## Shared prompt direction

- Cinematic architectural photography for a premium international sports broadcast.
- Believable contemporary construction and regionally grounded materials.
- Wide 16:9 establishing frame with the venue weighted right and dark negative space left for interface copy.
- Near-black, warm ivory, restrained club color, natural practical light, and subtle film grain.
- No text, logos, real brands, identifiable athletes, neon cyberpunk, holograms, robots, giant novelty sculptures, oversaturation, or culturally generic decoration.

Each prompt then used the exact venue description and local material language from `branddata.js`. The uncompressed originals remain in the image-generation artifact store; the application consumes only the optimized versioned JPEGs above.

## Expansion contract

The other 42 clubs intentionally retain their deterministic vector venue plates until they receive a venue-specific image that passes this same art direction. New images belong at `assets/world/club-venues/<team-id>-v1.jpg` and must be mapped through `venueImage` in `branddata.js`; procedural fallback remains required so the complete 48-club world never breaks while the art batch grows.
