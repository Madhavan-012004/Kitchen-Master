"""
processor.py
────────────────────────────────────────────────────────────────────────────
Orchestrates the two-track extraction pipeline:

  Track A – PDF (text-based):
    Uses pdfplumber to read the EMBEDDED DIGITAL TEXT with exact X/Y
    coordinates.  No OCR at all → 100 % character accuracy.
    Column positions are detected from the header row, so every number
    lands in the correct field regardless of the invoice layout.

  Track B – Images (JPG / PNG / etc.):
    Uses EasyOCR → LayoutParser → RuleExtractor.
    The layout parser now sorts tokens left-to-right within each row,
    fixing the "scrambled columns" bug.  The rule extractor validates
    assignments using Qty × Rate ≈ Total arithmetic.
"""

import os

from ocr_engine   import OCREngine
from layout_parser import LayoutParser
from rule_extractor import RuleExtractor
from exporter      import DataExporter


class Processor:
    def __init__(self, model_path=""):
        self.parser   = LayoutParser()
        self.extractor = RuleExtractor()
        self.exporter  = DataExporter("output")

        # Lazy-init OCR (heavy PyTorch load — only when needed)
        self._ocr = None

    # ── public API ──────────────────────────────────────────────────────────

    def process(self, file_path: str) -> dict:
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            return self._process_pdf(file_path)
        else:
            return self._process_image(file_path)

    # ── private helpers ─────────────────────────────────────────────────────

    def _process_pdf(self, file_path: str) -> dict:
        """
        Track A: pdfplumber digital-text extraction.
        Falls back to OCR if the PDF is a scan (no embedded text found).
        """
        try:
            from pdf_extractor import extract_pdf
            result = extract_pdf(file_path)

            # If we got product rows, we're done
            if result.get("productRows"):
                # Run through the extractor to clean names and apply math corrections
                cleaned = self.extractor.extract_invoice(result["productRows"])
                result["productRows"] = cleaned["productRows"]
                return result

            # No rows → PDF is probably a scanned image; fall through to OCR
            print("[INFO] PDF has no embedded text — falling back to OCR", flush=True)
        except Exception as e:
            print(f"[WARN] pdfplumber failed ({e}), falling back to OCR", flush=True)

        # Fallback: render PDF pages → OCR
        return self._process_image(file_path)

    def _process_image(self, file_path: str) -> dict:
        """Track B: EasyOCR → layout → rule extraction."""
        if self._ocr is None:
            self._ocr = OCREngine()

        ocr_output = self._ocr.extract(file_path)
        lines      = self.parser.group_lines(ocr_output)
        return self.extractor.extract_invoice(lines)
