# Page Builder: DWG / DXF import beta

This is a **separate experimental version** of the uploaded Page Builder, not a replacement for the working v0.2 file. Keep the original file and saved projects.

## What is and is not verified

The existing drawing tools, preview/accept workflow, ASCII DXF import, geometry translation, JSON save, and DXF export were tested. **The supplied E180 DWG was not decoded:** this development environment could not download the external DWG decoder. No converted copy of that DWG is included. The DWG decoding path requires a real browser test with Internet access before this can be considered a working DWG importer for that drawing.

The screenshots and fixture JSON files in `tests/` contain synthetic test geometry or an earlier generated test DXF. They are **not previews of the uploaded E180 schematic**.

## Open and try an import

1. Open `index.html` in a modern desktop browser. No build or installation is required for the app.
2. Click **Import DWG / DXF**, choose your file, and click **Read drawing**.
3. DWG import downloads a pinned LibreDWG-Web decoder from jsDelivr. It decodes the file in a local browser Worker; the importer does not upload your drawing to a conversion server. ASCII DXF and decoded-database JSON import do not need this download.
4. Confirm the source drawing units. Unknown or unitless files require you to choose units rather than guessing a scale.
5. Review the preview and the report of excluded or simplified objects.
6. Either **Save as project JSON**, or tick the review checkbox and click **Load into editor**.

A failed or cancelled import leaves the current project unchanged. Loading the accepted preview replaces the editor project, not the original file on disk; Undo can restore the previous in-session editor project. Save important work first.

## Import scope: all Model geometry, one editor canvas

This beta brings the source **Model-space geometry together onto one custom-sized editing canvas**, with 10 mm of blank margin. Existing geometry retains its relative arrangement. Units are converted to millimetres, then the whole drawing is translated to the canvas origin; there is no automatic fit-to-paper scaling.

It does **not** recreate the source Sheet tabs, viewport arrangements, print settings, layer states, or automatic title-block fields. It does not separate individual pages inside a large Model drawing. Paper-space-only geometry is excluded and reported. Thus an exported imported project has the beta's one model canvas and one generated Sheet, not the source DWG's original set of Sheets. The original page builder still creates linked Sheet viewports normally for newly authored projects.

The existing portrait default and custom 145 x 40 mm title-block template are retained. For an imported project, the shared template is switched off to avoid overlaying a second title block on imported geometry. The template definition is not deleted. Imported title-block lettering remains editable literal text, not inferred variables.

## Supported geometry and known simplifications

- Lines, circles and circular arcs are retained as editable primitives when their transforms allow it.
- 2D polylines are retained as paths. Bulged polylines are expanded into line/arc pieces.
- Nested block references are expanded to geometry. They do not retain block definitions, dynamic behavior or insertion identity in exported CAD.
- Block attribute values become editable text. Text placement, rotation and width factors are translated; fonts are substituted.
- MTEXT becomes separate text lines. Rich formatting and wrapping are approximate.
- Ellipses, splines and non-uniformly transformed curves become sampled polylines.
- Solid fills are retained as filled boundaries; patterned hatches become outlines.
- Dimensions use their cached picture when available, not associative dimension behavior.
- Unsupported/proxy/3D objects, missing blocks and unsupported boundaries are reported, not intentionally hidden as successful imports.
- Off/frozen layers are excluded unless **Include off / frozen layers** is checked.

Layer names and available source metadata are stored, but full layer control, fonts, lineweights, dash patterns, color inheritance, external references and all CAD database objects are not preserved. Do not use a plausible-looking preview as proof that every wire and label survived. Compare with the original before using the converted drawing as an engineering deliverable.

Imported paths and fills can be selected, moved, duplicated and deleted. Individual path vertices do not have dedicated editing controls yet. Arcs and text have numeric controls. The LISP fallback deliberately rejects unsupported extended geometry; use DXF for imported drawings.

## Saving and compatibility

The beta accepts existing v1/v2 project JSON and writes v3 JSON for its additional geometry. **v3 projects must be opened in this beta, not the older v0.2 app.** Browser backup uses a separate storage key from v0.2 so this beta does not overwrite the old app's automatic backup. Keep portable JSON copies with **Save project**.

## Troubleshooting DWG decoding

A DWG import requires access to `cdn.jsdelivr.net` to download JavaScript and WebAssembly. A blocked CDN, browser security rule, module load failure, unsupported drawing, or insufficient memory can stop decoding. The app limits source files to 40 MB and stops a Worker after 90 seconds. Ordinary editing and ASCII DXF import remain available without the decoder.

If decoding completes but translation fails or the preview is wrong, **Save decoder diagnostic JSON** retains the decoded database for debugging. That JSON contains drawing content and should be handled like the original company drawing. A failure before decoding cannot produce this diagnostic file. Do not upload a company drawing to an unrelated conversion service merely to work around a blocked CDN.

## Source and building

The standalone `index.html` is the complete application code. `source/` separates the geometry core, editor UI, import adapter, import dialog and Worker loader. Edit the standalone file directly, or edit the JavaScript files in `source/` and run:

```sh
python3 build.py
```

`source/shell.html` is the authoritative HTML/CSS shell for this build command. `import-dialog.html` and `import.css` are reference copies of the additions already embedded in that shell. Editing those reference copies alone does not alter the build.

DWG decoder files are not bundled. The external dependency and source links are documented in `THIRD_PARTY_NOTICES.md`.

## Tests

- 20 Node geometry/import regression tests.
- 14 Chromium interaction checks, including drawing, undo/redo, imports, preview cancellation, real download buttons and failure handling.
- Exported DXF files parsed and audited with ezdxf: zero audit errors or fixes in the test outputs.

Run the geometry tests with:

```sh
node tests/test-core.cjs
```

The browser tests require Python Playwright and a Chromium installation. They execute the delivered HTML with Playwright `set_content`; direct `file://` navigation and a real downloaded DWG decoder were not tested here. Set `CHROMIUM_PATH` if needed. `DWG_SAMPLE` optionally points to a DWG for the blocked-network failure test, which still does not decode its contents.

```sh
python3 tests/test-browser.py
```

The decoder module is explicitly mocked in one protocol test. That test does not validate any DWG binary or the actual library package. Neither real DWG decoding nor opening/printing these new exports in DraftSight was tested in this environment.
