from ocr_engine import OCREngine
from layout_parser import LayoutParser
from rule_extractor import RuleExtractor
from llama_client import LlamaClient
from exporter import DataExporter

class Processor:
    def __init__(self, model_path):
        self.ocr = OCREngine()
        self.parser = LayoutParser()
        self.extractor = RuleExtractor()
        self.llm = LlamaClient(model_path)
        self.exporter = DataExporter("output")

    def process(self, file_path):
        ocr_output = self.ocr.extract(file_path)
        lines = self.parser.group_lines(ocr_output)
        data = self.extractor.extract_invoice(lines)

        if not data.get("invoice_date"):
            data["invoice_date"] = self.llm.refine("\n".join(lines), "invoice date")

        self.exporter.to_excel(data, "result")
        self.exporter.to_json(data, "result")
