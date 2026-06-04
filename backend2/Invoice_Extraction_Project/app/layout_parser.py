"""
layout_parser.py
────────────────────────────────────────────────────────────────────────────
Groups EasyOCR bounding-box output into text lines.

Key fix vs the original:
  Within every row, words are sorted LEFT → RIGHT by their X-coordinate.
  The original code sorted only by Y (row order) but left words within a
  row in whatever order EasyOCR returned them, which caused columns to
  appear scrambled when the rule_extractor did positional assignment.

Returns: list of plain strings, one per visual row.
(The column-band approach is handled in pdf_extractor.py for PDFs,
 where pdfplumber gives reliable per-word bounding boxes.)
"""

class LayoutParser:

    def group_lines(self, ocr_output: list) -> list[str]:
        if not ocr_output:
            return []

        # Build flat word list with (x, y, text)
        words = []
        for item in ocr_output:
            box, (text, conf) = item
            x0 = min(pt[0] for pt in box)
            x1 = max(pt[0] for pt in box)
            y  = min(pt[1] for pt in box)
            words.append({"x0": x0, "x1": x1, "y": y, "text": text})

        # Sort by Y first
        words.sort(key=lambda w: w["y"])

        # Group into rows: new row when Y gap > 15 px
        rows: list[list[dict]] = []
        cur: list[dict] = [words[0]]
        for w in words[1:]:
            if abs(w["y"] - cur[-1]["y"]) <= 15:
                cur.append(w)
            else:
                rows.append(cur)
                cur = [w]
        rows.append(cur)

        # ── CRITICAL: sort each row left-to-right by X coordinate ──────────
        # Without this, EasyOCR sometimes delivers columns out of order,
        # causing the rule_extractor to assign numbers to wrong fields.
        lines = []
        for row in rows:
            row.sort(key=lambda w: w["x0"])
            lines.append(" ".join(w["text"] for w in row))

        return lines
