# AeroVision

Drop a CAD export of a STEM Racing car into the browser and see its airflow, its
pressure story and an aerodynamic assessment of its shape — in a few seconds, with
nothing uploaded anywhere.

Part of the Anantam Engineering Platform, alongside
[TechVerify](https://github.com/DDXPlayz/techverify) (regulation compliance) and
[EvalScore](https://github.com/DDXPlayz/evalscore) (portfolio scoring).

**[Live → tools.anantamracing.com/aerovision](https://tools.anantamracing.com/aerovision)**

---

## What this is, and what it is not

This is the section to read first, because the name invites a wrong assumption.

**AeroVision is a geometry-driven aerodynamic assessment and visualisation tool.**
It measures real geometric properties of your model — frontal, mid and rear
cross-sections, surface area, surface continuity, wheel exposure, slenderness,
downward-facing area — and maps them through an empirical formula to indicative
figures: a drag coefficient, a downforce index, an efficiency number and a flow-quality
score. The airflow you see is an animated vorticity field laid over the car to show
*where* the shape is working and where it is not.

**AeroVision is not a CFD solver.** There is no Navier–Stokes solve, no pressure
Poisson solve, no lattice Boltzmann step — no partial differential equation is
integrated anywhere in this codebase. The streamlines are illustrative, not computed
from a flow solution. The Cd it reports comes from a hand-tuned formula over measured
geometry, not from simulation, and it has **not been validated against wind-tunnel or
track data**.

So: use it to compare two shapes quickly and to see which features are hurting you.
Do not use it as a number to put in a report. For a model that is actually integrated
over time, see
[wheel-physics-lab](https://github.com/DDXPlayz/wheel-physics-lab) and
[stem-racing-simulator](https://github.com/DDXPlayz/stem-racing-simulator), both of
which publish their equations and their limitations.

---

## Why it exists

A STEM Racing team iterates a car shape dozens of times. Running real CFD on every
iteration is slow, expensive and needs expertise the team may not have on hand. Most
of those iterations do not need a solve — they need an answer to *"is this nose better
than the last one, and why?"*

AeroVision answers that in the time it takes to drag a file onto a page, and shows its
reasoning as geometry rather than as a single opaque number.

---

## Features

- **Drop in any common CAD export** — STL, OBJ, GLB or GLTF, parsed in the browser
  with `FileReader`. Nothing is uploaded; the file never leaves the machine.
- **Measured geometry, not guessed** — frontal / mid / rear cross-sectional areas,
  total surface area, surface continuity from face-normal agreement, wheel-area
  fraction, slenderness ratio, boxiness, downward-facing area.
- **Aero profile** — drag coefficient, downforce index, efficiency, flow quality and
  stability, each traceable to the geometric features that produced it.
- **Flow visualisation** — streamlines and particles over the body, a pressure view,
  and a wake region.
- **Scroll-choreographed presentation** — eight scenes (hero, problem, manifesto,
  flow, pressure, engine, launch, footer) that walk a viewer through the analysis.
- **Camera modes** including a chase camera, plus frame capture.
- **Engineering report** of the profile and its component scores.

---

## How it works

```
CAD file (STL / OBJ / GLB / GLTF)
   ↓  parsed in-browser — three.js loaders, FileReader
geometry measurement
   Afront, Amid, Arear, surface area, roughness (face-normal agreement),
   wheelArea, downArea, slenderness, boxiness
   ↓
empirical mapping                    ← hand-tuned coefficients, not a solve
   cd  = 0.14 + 0.18·boxiness + 0.14·max(rough−0.25, 0)
         − 0.10·noseSharp − 0.06·tailTaper
         − 0.05·clamp((slender−3)/6) + 0.10·wheelFrac
   flowQuality = 0.5 + 0.4·noseSharp + 0.3·tailTaper
                 − 0.5·rough − 0.3·wheelFrac          (clamped 6–99)
   ↓
aero profile + visualisation
   streamlines over a prescribed vorticity field, pressure view, wake, scores
```

`noseSharp` and `tailTaper` are derived from how much the cross-section narrows
fore and aft of the widest point: `1 − Afront/Amid` and `1 − Arear/Amid`. `rough`
is the mean of `1 − |n_i · n_{i−1}|` across adjacent faces, so a smoothly continuous
hull scores low and a faceted or stepped one scores high.

**The coefficients are judgement, not measurement.** They were chosen so the tool
ranks shapes the way an experienced eye does. That is the honest description of what
they are, and the reason the output is called a profile rather than a result.

---

## Stack

| Layer | |
|---|---|
| Rendering | three.js — `STLLoader`, `OBJLoader`, `GLTFLoader` |
| UI | React 19, Framer Motion, lucide-react |
| Shared | `@anantam/ui` — the platform navbar, vendored locally (see below) |
| Build | Vite, TypeScript |
| Backend | none — entirely client-side |

---

## Getting started

```bash
git clone https://github.com/DDXPlayz/aerovision.git
cd aerovision
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build               # builds for /aerovision/, the production path
VITE_BASE=/ npm run build   # builds for the root, e.g. to serve dist/ yourself
npm run preview
```

**On the base path.** Production is served from
`tools.anantamracing.com/aerovision/`, so `vite.config.ts` defaults `base` to
`/aerovision/` and a plain `npm run build` produces a `dist/` whose assets 404
if you serve it at `/`. Set `VITE_BASE=/` to build for the root. The same
applies to TechVerify and EvalScore.

No environment variables, no API keys, no server. The sample car
(`public/anantam-v1.stl`) loads on start, so there is something to look at before you
drop in your own model.

---

## Project structure

```
src/
  main.ts        the whole engine: scene setup, loaders, geometry measurement,
                 the aero mapping, the eight scroll scenes, camera and capture
  App.tsx        React shell — panels, controls, the report
  index.tsx      entry
  style.css
public/
  anantam-v1.stl the team's own car, used as the default model
extract.cjs      helper for pulling geometry out of a model offline
ui/              @anantam/ui, vendored as a local package
```

`main.ts` is 1,069 lines and does a lot in one file. That is a fair criticism of it;
it grew as a single scroll-driven scene and was never split.

---

## Engineering decisions

**Everything client-side, deliberately.** A team's unreleased car geometry is the
most sensitive file they own. Uploading it to a server to get an indicative score
would be a bad trade, so the measurement and the mapping both run in the browser and
the file never leaves the machine.

**Measure the geometry properly, then be honest about the mapping.** The hard,
genuinely correct part is the measurement — cross-sections at the right stations,
surface continuity from face normals, wheel area as a fraction of the hull. Those are
real numbers from the real mesh. The step from those numbers to a Cd is a judgement
call with hand-picked coefficients, and the README says so rather than letting the
decimal places imply otherwise.

**Rank, don't certify.** The tool is built to answer "better or worse than the last
one", which the mapping can do reliably even when its absolute values are off. The
scores are clamped to sane ranges so a degenerate mesh cannot produce a nonsense
headline figure.

**Surface continuity as a proxy for drag.** `1 − |n_i · n_{i−1}|` over adjacent faces
turns out to be a decent stand-in for how much a 3D-printed or hand-finished hull will
cost you, and it is cheap to compute on a mesh that is already loaded.

---

## Status & verification

**Status:** live and working. Stable; not under active development.

| Claim | How it was checked |
|---|---|
| Builds from a bare clone | `npm install && npm run build` — **run, passes** |
| Loads STL / OBJ / GLB / GLTF | loaders present and wired; **not exercised on one file of each format** |
| Live at `tools.anantamracing.com/aerovision` | HTTP 200, checked 2026-11-18 |
| No fluid solver | verified by inspection — **zero** PDE/solver terms in the source |
| Cd figures are accurate | **not verified, and not claimed.** No validation against wind-tunnel or track data has been done |

**Not verified:** the numerical accuracy of any reported figure; behaviour on very
large meshes; cross-browser rendering beyond the development machine.

---

## Credits

The software in this repository is written by **Dhruva Goyal**. Team Anantam —
Dhruva, Adrian, Kabir, Yuvraaj, Riddhi and Sanvi — did the engineering, enterprise
and portfolio work it was built to serve.

Built and deployed as part of an npm-workspaces monorepo in
`anantamracingsite/tools`, which remains the canonical source and serves the live
site. `@anantam/ui` is vendored here as a local package so a bare clone installs and
builds; it is 69 lines, which is less than the cost of publishing it to a registry.

three.js is BSD-3-Clause.

---

## Licence

[MIT](LICENSE).
