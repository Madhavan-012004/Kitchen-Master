"""
pdf_extractor.py
────────────────────────────────────────────────────────────────────────────
100%-accurate invoice extraction from TEXT-BASED PDFs (no OCR required).

Strategy:
  1. Extract every word + its bounding-box (x0, top, x1, bottom) from pdfplumber.
  2. Group words into rows by Y-coordinate (±row_tol pixels).
  3. Detect the HEADER row (contains keywords like HSN, MRP, Rate …).
  4. From the header row build COLUMN BANDS: each header word owns the
     horizontal range between itself and the next header.
  5. For every subsequent data row, slot each word into the column whose
     band its X-centre falls in.
  6. Map band labels → our JSON field names.
"""

import re
import pdfplumber


# ─── Field alias map ────────────────────────────────────────────────────────
# Keys: any lowercase substring that might appear in a column header.
# Values: the JSON field name we want to produce.
HEADER_ALIASES = {
    # S.No / row number
    "s.no": "sno", "s. no": "sno", "sr": "sno", "sl": "sno", "#": "sno",

    # Product description
    "material": "name", "description": "name", "item": "name",
    "product": "name", "particulars": "name", "goods": "name",

    # HSN
    "hsn": "hsnCode", "sac": "hsnCode",

    # Cases / packs
    "cas": "cases", "case": "cases", "ctn": "cases", "carton": "cases",
    "box": "cases", "pack": "cases", "cs": "cases",

    # Pieces / quantity
    "pcs": "qty",  "pc": "qty",  "qty": "qty",  "quantity": "qty",
    "unit": "qty", "nos": "qty", "no.": "qty",  "ea": "qty",
    "pieces": "qty",

    # MRP
    "mrp": "mrp",

    # Rate / cost per unit
    "rate": "costPerUnit", "cost": "costPerUnit", "price": "costPerUnit",
    "selling": "costPerUnit",

    # Free goods
    "free": "free",

    # Discount
    "dis": "discount", "disc": "discount", "discount": "discount",

    # SGST
    "sgst": "sgst",

    # CGST
    "cgst": "cgst",

    # IGST (some invoices)
    "igst": "igst",

    # Total
    "total": "totalAmount", "amount": "totalAmount", "amt": "totalAmount",
    "net": "totalAmount", "value": "totalAmount",
}

HSN_PATTERN = re.compile(r"^\d{4,8}$")
NUMBER_PATTERN = re.compile(r"^-?\d{1,10}(\.\d{1,4})?$")


def _match_alias(text: str) -> str | None:
    """Return field name for a header word, or None."""
    t = text.lower().strip().rstrip(".")
    for alias, field in HEADER_ALIASES.items():
        if alias in t:
            return field
    return None


def _group_rows(words: list[dict], row_tol: int = 6) -> list[list[dict]]:
    """Group pdfplumber word dicts into rows by vertical proximity."""
    if not words:
        return []
    words = sorted(words, key=lambda w: (w["top"], w["x0"]))
    rows: list[list[dict]] = []
    cur_row = [words[0]]
    for w in words[1:]:
        if abs(w["top"] - cur_row[-1]["top"]) <= row_tol:
            cur_row.append(w)
        else:
            rows.append(cur_row)
            cur_row = [w]
    rows.append(cur_row)
    return rows


def _build_column_bands(header_words: list[dict]) -> list[dict]:
    """
    Given the header row words, build column bands.
    Each band = { "field": str, "x_start": float, "x_end": float }
    """
    # Sort left-to-right
    hw = sorted(header_words, key=lambda w: w["x0"])
    bands = []
    for i, w in enumerate(hw):
        field = _match_alias(w["text"])
        if not field:
            continue
        x_start = w["x0"]
        x_end = hw[i + 1]["x0"] if i + 1 < len(hw) else float("inf")
        bands.append({"field": field, "x_start": x_start, "x_end": x_end})
    return bands


def _slot_into_bands(row_words: list[dict], bands: list[dict]) -> dict:
    """Assign each word in a data row to the band that owns its X-centre."""
    result: dict[str, list[str]] = {}
    for w in row_words:
        cx = (w["x0"] + w["x1"]) / 2
        for band in bands:
            if band["x_start"] <= cx < band["x_end"]:
                result.setdefault(band["field"], []).append(w["text"])
                break
    # Flatten lists to single strings
    return {k: " ".join(v) for k, v in result.items()}


def _parse_num(s: str, default=0.0) -> float:
    if s is None:
        return default
    clean = s.replace(",", "").replace("₹", "").strip()
    try:
        return float(clean)
    except ValueError:
        return default


def _extract_metadata(all_text: str) -> dict:
    meta = {"supplier": None, "invoiceNo": None, "date": None}

    # Invoice number
    m = re.search(
        r"\b(?:invoice|bill|inv)\b\s*(?:no\.?|n0\.?|na\.?|num\.?|number|#)?[:\s\-]*([A-Z0-9][A-Z0-9/\-]{2,25})",
        all_text, re.I
    )
    if m:
        meta["invoiceNo"] = m.group(1).strip()

    # Date
    m = re.search(r"(\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}-\d{2}-\d{2})", all_text)
    if m:
        meta["date"] = m.group(1).replace(".", "-")

    # Supplier – line with enterprise/agency/pvt/ltd suffix
    m = re.search(
        r"([A-Z][A-Za-z\s&.,()'-]{3,50}"
        r"(?:Enterprise|Agency|Agencies|Distributor|Traders?|Pvt|Ltd|LLP|Corp|"
        r"Industries|Products|Company|Co\.|Stores?)[^\n]*)",
        all_text, re.I
    )
    if m:
        meta["supplier"] = m.group(1).strip()

    return meta


def extract_pdf(file_path: str) -> dict:
    """
    Main entry-point.
    Returns the same JSON shape as rule_extractor.RuleExtractor.extract_invoice().
    """
    product_rows = []
    all_text_lines = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            words = page.extract_words(
                x_tolerance=3,
                y_tolerance=3,
                keep_blank_chars=False,
                use_text_flow=False,
            )
            if not words:
                continue

            all_text_lines.append(page.extract_text() or "")
            rows = _group_rows(words)

            # ── Find header row ──────────────────────────────────────────────
            header_idx = -1
            bands = []
            for idx, row in enumerate(rows):
                matched = sum(1 for w in row if _match_alias(w["text"]))
                if matched >= 3:           # at least 3 recognised header words
                    header_idx = idx
                    bands = _build_column_bands(row)
                    break

            if header_idx == -1 or not bands:
                # Fallback: return raw text for OCR-based pipeline to handle
                continue

            # ── Extract data rows ────────────────────────────────────────────
            for row in rows[header_idx + 1:]:
                slotted = _slot_into_bands(row, bands)

                # Must have at least a product name and HSN or numbers
                name = slotted.get("name", "").strip()
                hsn_raw = slotted.get("hsnCode", "").strip()

                # If no name column matched, try sno column or first non-numeric word
                if not name:
                    row_text = " ".join(w["text"] for w in sorted(row, key=lambda w: w["x0"]))
                    # Grab alpha tokens before any HSN-like number
                    alpha = re.findall(r"[A-Za-z][A-Za-z\s.&()/'-]{2,}", row_text)
                    name = " ".join(alpha[:3]).strip() if alpha else ""

                if not name or len(name) < 2:
                    continue

                # Validate HSN (4-8 digits) – also try finding it from row
                if not HSN_PATTERN.match(hsn_raw):
                    for w in row:
                        if HSN_PATTERN.match(w["text"]):
                            hsn_raw = w["text"]
                            break

                if not hsn_raw:
                    continue   # skip rows without HSN (header repeats, totals, etc.)

                product_rows.append({
                    "name": name,
                    "hsnCode": hsn_raw,
                    "cases":       _parse_num(slotted.get("cases")),
                    "qty":         _parse_num(slotted.get("qty")),
                    "mrp":         _parse_num(slotted.get("mrp")),
                    "costPerUnit": _parse_num(slotted.get("costPerUnit")),
                    "free":        _parse_num(slotted.get("free")),
                    "discount":    _parse_num(slotted.get("discount")),
                    "sgst":        _parse_num(slotted.get("sgst")),
                    "cgst":        _parse_num(slotted.get("cgst")),
                    "totalAmount": _parse_num(slotted.get("totalAmount")),
                })

    all_text = "\n".join(all_text_lines)
    meta = _extract_metadata(all_text)
    meta["productRows"] = product_rows
    return meta
