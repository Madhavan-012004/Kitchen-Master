import easyocr
import os
import numpy as np
from PIL import Image

class OCREngine:
    def __init__(self):
        # EasyOCR uses PyTorch (already installed). gpu=False for CPU-only machines.
        self.reader = easyocr.Reader(['en'], gpu=False, verbose=False)

    def extract(self, file_path):
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            images = self._load_pdf(file_path)
        else:
            # Resize image if it's too small, but keep it manageable for CPU (max 1500px)
            img = Image.open(file_path).convert("RGB")
            w, h = img.size
            if w < 1000:
                scale = 1500.0 / w
                img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
            images = [img]

        results = []
        for img in images:
            img_np = np.array(img)
            # EasyOCR returns: [([[x1,y1],[x2,y2],[x3,y3],[x4,y4]], text, confidence), ...]
            # Removed mag_ratio=2 as it causes CPU to timeout (>120s). Contrast boost is kept.
            raw = self.reader.readtext(img_np, contrast_ths=0.1, adjust_contrast=0.5)
            # Normalise to PaddleOCR-like format: [[bbox, (text, conf)], ...]
            for (bbox, text, conf) in raw:
                results.append([bbox, (text, conf)])

        return results

    def _load_pdf(self, file_path):
        """Load PDF pages as PIL Images. Tries pypdfium2 first (no external deps),
        then falls back to pdf2image+poppler."""
        try:
            import pypdfium2 as pdfium
            doc = pdfium.PdfDocument(file_path)
            images = []
            for page in doc:
                # 3x scale = ~216 DPI. Good balance of accuracy and speed for CPU.
                bitmap = page.render(scale=3)
                images.append(bitmap.to_pil())
            return images
        except ImportError:
            pass
        except Exception as e:
            raise RuntimeError(f"pypdfium2 failed to read PDF: {e}")

        # Fallback: pdf2image + poppler
        try:
            from pdf2image import convert_from_path
            return convert_from_path(file_path, dpi=300)
        except Exception as e:
            raise RuntimeError(
                "Cannot read PDF. Please install pypdfium2: pip install pypdfium2\n"
                f"Original error: {e}"
            )
