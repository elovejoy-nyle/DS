# External DWG decoder

The DWG import Worker is configured to download `@mlightcad/libredwg-web` version `0.7.17` from jsDelivr. The JavaScript and WebAssembly decoder binaries are not contained in this archive.

Upstream project: https://github.com/mlightcad/libredwg-web

Upstream JavaScript API documentation: https://github.com/mlightcad/libredwg-web/tree/master/bindings/javascript

Upstream license: GPL-3.0, as identified by the upstream repository. Source and license text: https://github.com/mlightcad/libredwg-web/blob/master/COPYING

Configured distribution path: https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.7.17

The converter, import preview UI and Page Builder-specific geometry adapter are application code, not a bundled copy of the DWG decoder. This notice does not grant an alternative license for the external decoder or establish the redistribution terms for an application combined with it. Keep upstream license/source information with any future vendored decoder package and review its terms before distributing it with an application.

The application source and tests do not include any font files.
