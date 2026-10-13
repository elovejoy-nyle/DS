Inkscape -> DraftSight AutoLISP Output Extension
================================================

Purpose
-------
Draw normally in Inkscape, then save/export the drawing as a .lsp file.
Loading that .lsp with DraftSight LOADAPPLICATION creates native DraftSight
LWPOLYLINE geometry on the active Model/Sheet space.

Installation on Windows / Inkscape 1.x
--------------------------------------
1. In Inkscape open:
      Edit -> Preferences -> System
   and find the "User extensions" directory.

2. Copy these two files into that directory:
      draftsight_lisp_output.inx
      draftsight_lisp_output.py

3. Restart Inkscape.

Using it
--------
1. Draw normally in Inkscape.
2. File -> Save a Copy (or Save As, depending on your workflow).
3. Choose:
      DraftSight AutoLISP (*.lsp)
4. Save, e.g.:
      panel_template.lsp
5. In DraftSight run:
      LOADAPPLICATION
6. Select panel_template.lsp.

By default, the generated LISP draws immediately when loaded. It also defines
this DraftSight command for rerunning the geometry:
      INKSCAPE2DS

Current conversion behavior
---------------------------
* SVG page coordinates are exported in millimetres.
* The SVG Y axis is flipped to conventional CAD Y-up coordinates.
* Groups and object transforms are applied.
* Inkscape is asked to convert standard shapes and text to paths before export.
* Straight geometry becomes native LWPOLYLINE segments.
* Bezier curves are flattened into native LWPOLYLINE vertices.
* Curve tolerance is configurable in the save/export options.
* Text currently becomes outline geometry rather than DraftSight TEXT entities.
* Fills, gradients, raster images, clipping/masks and SVG stroke appearance are
  not represented as CAD styling in this first version.

This is intentionally a geometry bridge, not a complete SVG renderer.
