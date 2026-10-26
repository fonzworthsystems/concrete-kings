# Concrete Kings

A fully playable 3D 5v5 MOBA set in a neon-lit urban district. Two crews — the **Emerald Syndicate** and the **Crimson Cartel** — battle across three lanes of a living city to destroy the enemy's base.

**Play it live:** https://fonzworthsystems.github.io/concrete-kings/

## Controls

| Input | Action |
|-------|--------|
| Right-click | Move / attack a target |
| Left-click | Confirm ability cast / place area abilities |
| Q / W / E / R | Cast abilities |
| Ctrl + Q/W/E/R | Level up abilities (auto-level is on by default) |
| B | Recall to base (channeled) |
| T | Place a lookout ward |
| P | Open / close the item shop |
| Space | Center the camera on your hero |
| S | Stop |
| Esc | Cancel a cast |

## Features

- **3D city battlefield** — three lanes, jungle, a central canal, destructible turrets, inhibitors and a Nexus.
- **5 unique heroes** — Fighter, Assassin, Mage, Marksman and Support, each with a passive and 4 abilities (Q/W/E/R).
- **Full MOBA systems** — minion waves, jungle monsters, epic objectives (the Kingpin and the Arms Cache), gold, XP and levels 1–18, a 20-item shop, death & respawn, and team vision.
- **Fog of war** — concealment bushes, stealth, wards, and a live minimap.
- **5v5 bot matches** — 4 AI allies and 5 AI enemies with laning, farming, trading, retreating, shopping and objective play.

## Run locally

Serve this directory with any static file server — no build step, no dependencies:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Stack

- **Three.js** (WebGL) — 3D rendering (vendored in `js/three.min.js`)
- **Vanilla JavaScript** — game logic, AI, UI
- **Web Audio API** — procedural sound effects
