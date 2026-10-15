# DraftSight Page Builder

A static browser app for building multi-page CAD/schematic layouts without needing DraftSight while you design the page structure.

## Run it

Open `index.html` in a modern browser.

No web server, package manager, build system, or external JavaScript library is required.

## Current features

- Letter, Legal, A4, or custom paper size
- Portrait / landscape
- Configurable 10 mm (or any) gap between pages in Model
- Add/delete pages
- Page title, drawing number, revision
- Automatic `Sheet X of N`
- Side-by-side Model preview
- Simple Model drawing tools: line, rectangle, text
- Simple title-block designer: line, rectangle, text, variables
- Variables:
  - `{TITLE}`
  - `{DRAWING_NUMBER}`
  - `{REVISION}`
  - `{PAGE}`
  - `{PAGECOUNT}`
- Save/load project as plain JSON
- Export SVG preview
- Export plain-text ASCII DXF with complete Model geometry
- Export generated AutoLISP that reconstructs the Model pages and creates corresponding Sheet tabs in DraftSight

## Important limitation in this first version

The generated AutoLISP creates:
1. all complete page geometry in Model, side-by-side
2. the matching DraftSight Sheet tabs

It does **not yet automatically create/configure the live Sheet viewports** that look at each Model page.

That is intentionally left as the next DraftSight-tested step because DraftSight's viewport command/state behavior needs to be verified on the actual licensed installation before generating destructive automation.

The browser-side project structure is already set up for it: each page has an exact Model-space rectangle, so a future generated viewport can target that rectangle deterministically.

## Geometry convention

Page `i` starts at:

`X = i * (paperWidth + gap)`

where the first page uses index 0.

For US Letter landscape with a 10 mm gap:

- Page 1: X = 0.0 to 279.4 mm
- Page 2: X = 289.4 to 568.8 mm
- Page 3: X = 578.8 to 858.2 mm

All page-local drawing entities are stored relative to their page's origin.
