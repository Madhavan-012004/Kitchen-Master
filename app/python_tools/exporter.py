import json
import os
import openpyxl

class DataExporter:
    def __init__(self, output_dir):
        os.makedirs(output_dir, exist_ok=True)
        self.output_dir = output_dir

    def to_json(self, data, name):
        path = os.path.join(self.output_dir, name + ".json")
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def to_excel(self, data, name):
        path = os.path.join(self.output_dir, name + ".xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active

        ws.append(["Field", "Value"])
        ws.append(["Vendor", data.get("vendor_name")])
        ws.append(["Invoice Number", data.get("invoice_number")])
        ws.append(["Invoice Date", data.get("invoice_date")])

        wb.save(path)
