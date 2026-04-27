# FourTwoRun watch faces

The collected source for all FourTwoRun watch faces, namespaced by hardware platform. Each face is its own subdirectory with its own `app.json`; shared brand tokens, sprite generators, and widget patterns live in `shared/`.

## Layout

```
watchfaces/
├── zepp/                      ← Zepp OS (Amazfit, Zepp Health watches)
│   └── 42r-simple/            ← First watch face. Bold HH:MM in #22CFCB on black.
└── shared/                    ← Reused across faces (brand tokens, sprite tooling)
```

When other platforms ship, they get parallel top-level namespaces (`apple/`, `garmin/`).

## Faces

| Face | Platform | Status | Description |
|---|---|---|---|
| [`zepp/42r-simple`](zepp/42r-simple) | Zepp OS 4.0 (Cheetah 2 Pro) | Phase 1 — hello-world scaffold | Bold `HH:MM` in `#22CFCB` on black, with a small date underneath. The simplest face FourTwoRun will ever ship. |

## Building a face

From inside any face directory:

```
cd zepp/42r-simple
zeus dev       # local simulator
zeus preview   # QR sideload to a paired watch
zeus build     # produce the .zab bundle
```

Prereqs: zeus CLI installed (`npm i -g @zeppos/zeus-cli`), Developer Mode on, watch connected via Bridge. Full procedure in the private wiki: `~/repos/fourtworun/runfourtworun/setup/zepp-toolchain.md`.

## Brand

All faces use the FourTwoRun visual system: solid black background, `#22CFCB` foreground only, **Inter Black** font rendered as PNG sprites. Detailed rules in the private wiki: `~/repos/fourtworun/runfourtworun/brand/identity.md`.

## License

TBD per face. Most likely MIT once anything publishes.
