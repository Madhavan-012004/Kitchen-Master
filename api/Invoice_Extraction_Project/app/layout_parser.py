import re

HEADER_ALIASES = {
    "s.no": "sno", "sr": "sno", "sl": "sno", "#": "sno",
    "material": "name", "description": "name", "item": "name", "product": "name", "particulars": "name",
    "hsn": "hsnCode", "sac": "hsnCode",
    "cas": "cases", "case": "cases", "ctn": "cases", "carton": "cases", "box": "cases",
    "pcs": "qty", "qty": "qty", "quantity": "qty", "unit": "qty", "nos": "qty",
    "mrp": "mrp",
    "rate": "costPerUnit", "cost": "costPerUnit", "price": "costPerUnit",
    "free": "free",
    "dis": "discount", "disc": "discount", "discount": "discount",
    "sgst": "sgst", "cgst": "cgst", "igst": "igst",
    "total": "totalAmount", "amount": "totalAmount", "amt": "totalAmount", "value": "totalAmount",
}

def _match_alias(text: str) -> str | None:
    t = text.lower().strip().rstrip(".")
    for alias, field in HEADER_ALIASES.items():
        if alias in t:
            return field
    return None

class LayoutParser:
    def group_lines(self, ocr_output: list) -> list:
        if not ocr_output:
            return []

        words = []
        for item in ocr_output:
            box, (text, conf) = item
            x0 = min(pt[0] for pt in box)
            x1 = max(pt[0] for pt in box)
            y  = min(pt[1] for pt in box)
            words.append({"x0": x0, "x1": x1, "y": y, "text": text})

        words.sort(key=lambda w: w["y"])

        rows: list[list[dict]] = []
        cur: list[dict] = [words[0]]
        for w in words[1:]:
            if abs(w["y"] - cur[-1]["y"]) <= 15:
                cur.append(w)
            else:
                rows.append(cur)
                cur = [w]
        rows.append(cur)

        # Try to find header row for structured column bands
        header_idx = -1
        bands = []
        for idx, row in enumerate(rows):
            matched = sum(1 for w in row if _match_alias(w["text"]))
            if matched >= 3:
                header_idx = idx
                hw = sorted(row, key=lambda w: w["x0"])
                for i, w in enumerate(hw):
                    field = _match_alias(w["text"])
                    if field:
                        x_start = w["x0"] - 20 # slight overlap tolerance
                        x_end = hw[i + 1]["x0"] if i + 1 < len(hw) else float("inf")
                        bands.append({"field": field, "x_start": x_start, "x_end": x_end})
                break

        if header_idx != -1 and bands:
            # Mode A: Structured extraction
            structured_rows = []
            for row in rows[header_idx + 1:]:
                row.sort(key=lambda w: w["x0"])
                slotted = {}
                for w in row:
                    cx = (w["x0"] + w["x1"]) / 2
                    for band in bands:
                        if band["x_start"] <= cx < band["x_end"]:
                            slotted.setdefault(band["field"], []).append(w["text"])
                            break
                if slotted:
                    structured_rows.append({k: " ".join(v) for k, v in slotted.items()})
            if structured_rows:
                return structured_rows

        # Mode B: Fallback to plain strings left-to-right
        lines = []
        for row in rows:
            row.sort(key=lambda w: w["x0"])
            lines.append(" ".join(w["text"] for w in row))

        return lines
