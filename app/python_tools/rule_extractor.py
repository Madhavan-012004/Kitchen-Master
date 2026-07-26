import re

class RuleExtractor:
    def extract_invoice(self, lines):
        data = {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "line_items": []
        }

        for line in lines:
            if not data["invoice_number"]:
                m = re.search(r"invoice\s*(no|number|#)?[:\s]*([A-Z0-9\-\/]+)", line, re.I)
                if m:
                    data["invoice_number"] = m.group(2)

            if not data["invoice_date"]:
                m = re.search(r"\d{4}-\d{2}-\d{2}", line)
                if m:
                    data["invoice_date"] = m.group(0)

        return data
