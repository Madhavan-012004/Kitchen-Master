from paddleocr import PaddleOCR
from pdf2image import convert_from_path
from PIL import Image
import numpy as np
import os

class OCREngine:
    def __init__(self):
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en')

    def extract(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            images = convert_from_path(file_path, dpi=300)
        else:
            images = [Image.open(file_path)]

        results = []
        for img in images:
            img_np = np.array(img)
            result = self.ocr.ocr(img_np, cls=True)
            results.extend(result[0])
        return results
