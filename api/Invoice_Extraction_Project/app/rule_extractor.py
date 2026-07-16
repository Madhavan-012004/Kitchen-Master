"""
rule_extractor.py
────────────────────────────────────────────────────────────────────────────
Converts layout_parser output → structured invoice JSON.

Handles two input modes:

  Mode A – Structured dicts (new column-band layout parser):
    Input:  [{"name": "Milk …", "hsnCode": "0401", "qty": "96", "mrp": "20", …}, …]
    Action: Simple field copy + numeric parsing. No guessing needed.

  Mode B – Plain strings (fallback for headerless invoices):
    Input:  ["Milk Fantacy Cup 40ML 0401 4 96 20 16.76 0 0 30.17 30.17 1267.20", …]
    Action: Detect HSN, split numeric tokens, assign positionally, then
            validate with Qty × Rate ≈ Total arithmetic.
"""

import re

HSN_PATTERN = re.compile(r"^\d{4,8}$")
NUM_PATTERN  = re.compile(r"^-?\d{1,10}(\.\d{1,4})?$")

UOM_TOKENS = {
    'crt','crts','carton','cartons','pkt','pkts','packet','packets',
    'kg','kgs','gm','gms','gram','grams','mg','mgs',
    'l','ltr','ltrs','litre','litres','liter','liters','ml','mls',
    'n','nos','no','pcs','pc','piece','pieces','unit','units',
    'box','boxes','bag','bags','roll','rolls','bundle','bundles',
    'doz','dozen','dozens','pair','pairs','set','sets',
    'tab','tabs','tablet','tablets','cap','caps','capsule','capsules',
    'strip','strips','bottle','bottles','tube','tubes','can','cans',
    'ea','each','un','mtr','mtrs','meter','meters',
    'sqft','sft','sqm','sqmtr','rft','rmt',
}


def _pn(s, default=0.0) -> float:
    """Parse numeric string → float, tolerating commas and ₹."""
    if not s:
        return default
    try:
        return float(str(s).replace(",", "").replace("₹", "").strip())
    except ValueError:
        return default


def clean_product_name(name: str) -> str:
    # Replace S/s with 5 when followed by digits and a unit of measure
    name = re.sub(
        r'\b[sS](\d+)\s*(ml|g|kg|ltr|gm|gms|grams|pcs|box|pkts|pkt|packet|packets|pack)\b',
        r'5\g<1>\g<2>', name, flags=re.I
    )
    # Replace l (lowercase L) or I (uppercase i) with 1 when surrounded by digits
    name = re.sub(r'(\d)[lI](\d)', r'\g<1>1\g<2>', name)
    # Replace double spaces
    name = re.sub(r'\s+', ' ', name).strip()
    return name


class RuleExtractor:

    # ── public API ───────────────────────────────────────────────────────────

    def extract_invoice(self, lines: list) -> dict:
        data = {"supplier": None, "supplierGstin": None, "invoiceNo": None, "date": None, "subTotal": 0.0, "totalTax": 0.0, "productRows": []}

        if not lines:
            return data

        # Detect mode from first non-empty element
        structured_mode = isinstance(lines[0], dict)

        if structured_mode:
            return self._extract_structured(lines)
        else:
            return self._extract_strings(lines)

    # ── Mode A: structured dicts ─────────────────────────────────────────────

    def _extract_structured(self, rows: list[dict]) -> dict:
        data = {"supplier": None, "supplierGstin": None, "invoiceNo": None, "date": None, "subTotal": 0.0, "totalTax": 0.0, "productRows": []}

        for row in rows:
            name   = row.get("name", "").strip()
            name   = clean_product_name(name)
            hsn    = row.get("hsnCode", "").strip()

            if not name or len(name) < 2:
                continue
            if not HSN_PATTERN.match(hsn):
                continue

            cases = _pn(row.get("cases", 0))
            qty = _pn(row.get("qty", 0))
            mrp = _pn(row.get("mrp", 0))
            cost = _pn(row.get("costPerUnit", 0))
            free = _pn(row.get("free", 0))
            disc = _pn(row.get("discount", 0))
            sgst = _pn(row.get("sgst", 0))
            cgst = _pn(row.get("cgst", 0))
            total = _pn(row.get("totalAmount", 0))

            cases, qty, mrp, cost, free, disc, sgst, cgst, total = self._correct_fields(
                cases, qty, mrp, cost, free, disc, sgst, cgst, total
            )

            item = {
                "name":        name,
                "hsnCode":     hsn,
                "cases":       cases,
                "qty":         qty,
                "mrp":         mrp,
                "costPerUnit": cost,
                "free":        free,
                "discount":    disc,
                "sgst":        sgst,
                "cgst":        cgst,
                "totalAmount": total,
            }
            data["productRows"].append(item)

        return self._finalize_data(data)

    def _finalize_data(self, data: dict) -> dict:
        sub = 0.0
        tax = 0.0
        for r in data["productRows"]:
            # Recalculate if there are minor rounding errors
            row_sub = r["qty"] * r["costPerUnit"] - r["discount"]
            row_tax = r["sgst"] + r["cgst"]
            sub += row_sub
            tax += row_tax
            
        data["subTotal"] = round(sub, 2)
        data["totalTax"] = round(tax, 2)
        
        # Grand total is the sum of all product row totals, or sub + tax
        data["grandTotal"] = round(sum(r["totalAmount"] for r in data["productRows"]), 2)
        return data

    # ── Mode B: plain strings ─────────────────────────────────────────────────

    def _extract_strings(self, lines: list[str]) -> dict:
        data = {"supplier": None, "supplierGstin": None, "invoiceNo": None, "date": None, "subTotal": 0.0, "totalTax": 0.0, "productRows": []}
        full_text = " ".join(lines)

        # Metadata
        m = re.search(
            r"\b(?:invoice|bill|inv)\b\s*(?:no\.?|n0\.?|na\.?|num\.?|number|#)?[:\s\-]*([A-Z0-9][A-Z0-9/\-]{2,25})",
            full_text, re.I)
        if m:
            data["invoiceNo"] = m.group(1).strip()

        m = re.search(r"(\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}-\d{2}-\d{2})", full_text)
        if m:
            data["date"] = m.group(1).replace(".", "/")

        m = re.search(
            r"([A-Z][A-Za-z\s.&',()/]{5,}"
            r"(?:Limited|Ltd|Pvt|LLP|Corp|Inc|Industries|Products|"
            r"Agencies|Traders?|Distributors?|Company|Co\.))",
            full_text, re.I)
        if m:
            data["supplier"] = m.group(1).strip()

        # GSTIN (15 characters standard format)
        m = re.search(r"\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})\b", full_text, re.I)
        if m:
            data["supplierGstin"] = m.group(1).upper()

        for line in lines:
            item = self._parse_line(line)
            if item:
                data["productRows"].append(item)

        return self._finalize_data(data)

    def _parse_line(self, line: str) -> dict | None:
        tokens = [t for t in line.split() if t.strip()]
        if len(tokens) < 4:
            return None

        # Find HSN position
        hsn_idx = -1
        for i, t in enumerate(tokens):
            if HSN_PATTERN.match(t) and t.lower() not in UOM_TOKENS:
                hsn_idx = i
                break
        if hsn_idx == -1:
            return None

        # Product name
        name_start = 1 if re.match(r"^\d{1,3}$", tokens[0]) else 0
        name_tokens = [
            t for t in tokens[name_start:hsn_idx]
            if t.lower().rstrip(".") not in UOM_TOKENS
        ]
        name = " ".join(name_tokens).strip()
        name = clean_product_name(name)
        if not name or len(name) < 2:
            return None

        hsn = tokens[hsn_idx]

        # Parse numeric tokens after HSN
        nums = []
        for t in tokens[hsn_idx + 1:]:
            c = t.replace(",", "").replace("₹", "")
            if t.lower().rstrip(".") not in UOM_TOKENS:
                try:
                    v = float(c)
                    if v <= 999_999:
                        nums.append(v)
                except ValueError:
                    pass

        if len(nums) < 2:
            return None

        assigned = self._smart_assign(nums)
        if assigned is None:
            return None

        return {"name": name, "hsnCode": hsn, **assigned}

    def _correct_fields(self, cases, qty, mrp, cost, free, disc, sgst, cgst, total):
        def near(a, b):
            if a == 0 and b == 0:
                return True
            return abs(a - b) <= max(2.0, max(abs(a), abs(b)) * 0.03)

        # 1. Decimal point recovery for total
        if qty > 0 and mrp > 0 and total > 0:
            expected = qty * mrp
            if total > expected * 2:
                for shift in [10, 100, 1000]:
                    candidate = total / shift
                    if abs(candidate - expected) / expected <= 0.35:
                        total = candidate
                        break

        # 2. Check SGST / CGST symmetry
        if sgst > 0 and cgst == 0:
            cgst = sgst
        elif cgst > 0 and sgst == 0:
            sgst = cgst

        # 3. Swap cost and mrp if they are swapped
        if cost > 0 and mrp > 0 and not near(qty * cost, total):
            if near(qty * mrp, total):
                cost, mrp = mrp, cost

        # 4. If cost > mrp, it's invalid. Recompute cost if total and qty are valid
        if cost > mrp and mrp > 0 and qty > 0:
            cost_basic = round(total / qty, 2)
            cost_gross = round((total - sgst - cgst + disc) / qty, 2)
            if cost_gross <= mrp:
                cost = cost_gross
            elif cost_basic <= mrp:
                cost = cost_basic

        # 5. Correct SGST/CGST if total and qty*cost are consistent but taxes are wrong
        if qty > 0 and cost > 0 and total > 0:
            diff = total - (qty * cost - disc)
            if diff > 0 and not near(sgst + cgst, diff):
                sgst = cgst = round(diff / 2, 2)

        # 6. Recompute total if missing or inconsistent
        expected_total = round(qty * cost + sgst + cgst - disc, 2)
        if total == 0 and qty > 0 and cost > 0:
            total = expected_total
        elif total > 0 and qty > 0 and cost > 0 and not near(qty * cost, total) and not near(qty * cost + sgst + cgst - disc, total):
            total = expected_total

        return cases, qty, mrp, cost, free, disc, sgst, cgst, total

    # ── numeric assignment with math cross-validation ─────────────────────────

    def _smart_assign(self, n: list[float]) -> dict | None:
        """
        Assign numeric tokens to invoice fields.
        Key validation: Qty × Rate ≈ Total  (within 2 % or ₹2, whichever larger).
        """
        cases = qty = mrp = cost = free = disc = sgst = cgst = total = 0.0

        l = len(n)
        if   l >= 9: cases, qty, mrp, cost, free, disc, sgst, cgst, total = n[:9]
        elif l == 8: cases, qty, mrp, cost, disc, sgst, cgst, total        = n
        elif l == 7: cases, qty, mrp, cost, sgst, cgst, total              = n
        elif l == 6: qty, mrp, cost, sgst, cgst, total                     = n
        elif l == 5: qty, mrp, cost, sgst, total                            = n; cgst = sgst
        elif l == 4: qty, mrp, cost, total                                  = n
        elif l == 3: qty, cost, total                                        = n; mrp  = cost
        elif l == 2: qty, cost                                               = n; mrp  = cost; total = qty * cost
        else:        return None

        cases, qty, mrp, cost, free, disc, sgst, cgst, total = self._correct_fields(
            cases, qty, mrp, cost, free, disc, sgst, cgst, total
        )

        return {
            "cases": cases, "qty": qty, "mrp": mrp, "costPerUnit": cost,
            "free": free, "discount": disc, "sgst": sgst, "cgst": cgst,
            "totalAmount": total,
        }
