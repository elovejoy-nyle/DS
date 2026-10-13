#!/usr/bin/env python3
"""Inkscape output extension: SVG -> DraftSight AutoLISP.

The extension asks Inkscape to preprocess ordinary SVG shapes and text into
paths, flattens Bezier curves to polylines, transforms all geometry into page
coordinates, converts those coordinates to millimetres, flips SVG's Y axis,
and emits native DraftSight LWPOLYLINE entities.
"""

import math
import inkex
from inkex import PathElement
from inkex.units import convert_unit


class DraftSightLispOutput(inkex.OutputExtension):
    def add_arguments(self, pars):
        pars.add_argument(
            "--curve_tolerance",
            type=float,
            default=0.05,
            help="Maximum curve flattening error in millimetres",
        )
        pars.add_argument(
            "--auto_run",
            type=inkex.Boolean,
            default=True,
            help="Run the generated drawing function immediately when loaded",
        )

    def effect(self):
        # Let Inkscape do the difficult SVG normalization for us.  This converts
        # rectangles, ellipses, lines, polylines, polygons and text to paths and
        # unlinks clones, while retaining visual transforms.
        self.preprocess()

    @staticmethod
    def _distance_point_to_line(p, a, b):
        """Perpendicular distance from complex point p to line a-b."""
        dx = b.real - a.real
        dy = b.imag - a.imag
        denom = math.hypot(dx, dy)
        if denom == 0:
            return abs(p - a)
        return abs(dy * p.real - dx * p.imag + b.real * a.imag - b.imag * a.real) / denom

    @classmethod
    def _flatten_cubic(cls, p0, p1, p2, p3, tolerance, out, depth=0):
        """Append p3 and subdivision points for a cubic Bezier."""
        flat = max(
            cls._distance_point_to_line(p1, p0, p3),
            cls._distance_point_to_line(p2, p0, p3),
        )
        if flat <= tolerance or depth >= 18:
            out.append(p3)
            return

        p01 = (p0 + p1) / 2
        p12 = (p1 + p2) / 2
        p23 = (p2 + p3) / 2
        p012 = (p01 + p12) / 2
        p123 = (p12 + p23) / 2
        p0123 = (p012 + p123) / 2

        cls._flatten_cubic(p0, p01, p012, p0123, tolerance, out, depth + 1)
        cls._flatten_cubic(p0123, p123, p23, p3, tolerance, out, depth + 1)

    @staticmethod
    def _clean_points(points, eps=1e-10):
        cleaned = []
        for p in points:
            if not cleaned or abs(p - cleaned[-1]) > eps:
                cleaned.append(p)
        return cleaned

    @staticmethod
    def _lisp_num(value):
        # Stable, compact decimal output. Avoid scientific notation because it is
        # less pleasant to inspect/debug in generated .lsp files.
        if abs(value) < 5e-13:
            value = 0.0
        s = f"{value:.10f}".rstrip("0").rstrip(".")
        if "." not in s:
            s += ".0"
        return s

    def _page_mapping(self):
        vb = self.svg.get_viewbox()
        if not vb or len(vb) != 4 or vb[2] == 0 or vb[3] == 0:
            raise inkex.AbortExtension("SVG must have a valid viewBox for DraftSight export.")

        width_attr = self.svg.get("width")
        height_attr = self.svg.get("height")
        if not width_attr or not height_attr:
            raise inkex.AbortExtension("SVG must have width and height attributes.")

        width_mm = convert_unit(width_attr, "mm")
        height_mm = convert_unit(height_attr, "mm")
        if width_mm is None or height_mm is None:
            raise inkex.AbortExtension("Could not convert SVG page dimensions to millimetres.")

        min_x, min_y, vb_w, vb_h = [float(v) for v in vb]
        sx = float(width_mm) / vb_w
        sy = float(height_mm) / vb_h
        return min_x, min_y, vb_w, vb_h, sx, sy, float(width_mm), float(height_mm)

    def _to_mm(self, p, mapping):
        min_x, min_y, vb_w, vb_h, sx, sy, _w, _h = mapping
        x = (p.real - min_x) * sx
        # SVG page coordinates increase downward; CAD coordinates increase upward.
        y = (min_y + vb_h - p.imag) * sy
        return complex(x, y)

    def _path_polylines(self, node, tolerance_user):
        # Apply all ancestor/group transforms before converting to a predictable
        # cubic representation.
        path = node.path.transform(node.composed_transform())
        csp = path.to_superpath()

        for sub in csp:
            if len(sub) < 2:
                continue

            points = [complex(float(sub[0][1][0]), float(sub[0][1][1]))]
            for i in range(len(sub) - 1):
                n0 = sub[i]
                n1 = sub[i + 1]
                p0 = complex(float(n0[1][0]), float(n0[1][1]))
                p1 = complex(float(n0[2][0]), float(n0[2][1]))
                p2 = complex(float(n1[0][0]), float(n1[0][1]))
                p3 = complex(float(n1[1][0]), float(n1[1][1]))

                is_line = (
                    self._distance_point_to_line(p1, p0, p3) < 1e-12
                    and self._distance_point_to_line(p2, p0, p3) < 1e-12
                )
                if is_line:
                    points.append(p3)
                else:
                    self._flatten_cubic(p0, p1, p2, p3, tolerance_user, points)

            points = self._clean_points(points)
            if len(points) < 2:
                continue

            closed = abs(points[0] - points[-1]) <= 1e-8
            if closed:
                points = points[:-1]
            if len(points) >= 2:
                yield points, closed

    def save(self, stream):
        mapping = self._page_mapping()
        _min_x, _min_y, _vb_w, _vb_h, sx, sy, width_mm, height_mm = mapping

        # Convert desired mm tolerance into SVG user-coordinate tolerance.  Use
        # the stricter axis when x/y scales differ.
        mm_per_user = min(abs(sx), abs(sy))
        tolerance_mm = max(0.001, float(self.options.curve_tolerance))
        tolerance_user = tolerance_mm / mm_per_user if mm_per_user else 0.05

        polylines = []
        non_rendered_ancestors = {
            "defs", "clipPath", "mask", "pattern", "marker", "symbol",
            "linearGradient", "radialGradient", "filter",
        }

        for node in self.svg.iterdescendants():
            if not isinstance(node, PathElement):
                continue

            # SVG resource containers can contain real-looking geometry that is
            # not itself rendered.  Inkscape commonly stores text-flow helper
            # rectangles in <defs>; exporting those created stray CAD objects.
            parent = node.getparent()
            skip_resource = False
            while parent is not None and parent is not self.svg:
                try:
                    local = parent.tag.rsplit("}", 1)[-1]
                except Exception:
                    local = ""
                if local in non_rendered_ancestors:
                    skip_resource = True
                    break
                parent = parent.getparent()
            if skip_resource:
                continue

            # Invisible geometry should not turn into CAD entities.
            try:
                style = node.specified_style()
                if style.get("display") == "none" or style.get("visibility") == "hidden":
                    continue
            except Exception:
                pass

            for points, closed in self._path_polylines(node, tolerance_user):
                mm_points = [self._to_mm(p, mapping) for p in points]
                polylines.append((mm_points, closed))

        out = []
        out.append("; Generated by Inkscape DraftSight AutoLISP Output")
        out.append(f"; Page size: {width_mm:.6f} mm x {height_mm:.6f} mm")
        out.append(f"; Curve flattening tolerance: {tolerance_mm:.6f} mm")
        out.append(f"; Native polylines: {len(polylines)}")
        out.append("")
        out.append("(defun _INKDS-LWPOLY (pts closed / data)")
        out.append("  (setq data")
        out.append("    (append")
        out.append("      (list '(0 . \"LWPOLYLINE\") '(100 . \"AcDbEntity\") '(100 . \"AcDbPolyline\")")
        out.append("            (cons 90 (length pts)) (cons 70 (if closed 1 0)))")
        out.append("      (mapcar '(lambda (p) (cons 10 p)) pts)))")
        out.append("  (entmakex data)")
        out.append(")")
        out.append("")
        out.append("(defun c:INKSCAPE2DS (/)")
        out.append("  (princ \"\\nDrawing Inkscape export as native DraftSight geometry...\")")

        for points, closed in polylines:
            pts = " ".join(
                f"({self._lisp_num(p.real)} {self._lisp_num(p.imag)})" for p in points
            )
            out.append(f"  (_INKDS-LWPOLY '({pts}) {'T' if closed else 'nil'})")

        out.append("  (princ \"\\nInkscape drawing complete.\")")
        out.append("  (princ)")
        out.append(")")
        out.append("")
        if self.options.auto_run:
            out.append("(c:INKSCAPE2DS)")
        else:
            out.append("; Run with command: INKSCAPE2DS")
        out.append("(princ)")
        out.append("")

        stream.write(("\n".join(out)).encode("utf-8"))


if __name__ == "__main__":
    DraftSightLispOutput().run()
