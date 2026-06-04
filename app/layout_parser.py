import pandas as pd

class LayoutParser:
    def group_lines(self, ocr_output):
        rows = []
        for line in ocr_output:
            box, (text, conf) = line
            y = box[0][1]
            rows.append((y, text))

        df = pd.DataFrame(rows, columns=["y", "text"])
        df = df.sort_values("y")
        df["row"] = (df["y"].diff() > 15).cumsum()

        return df.groupby("row")["text"].apply(lambda x: " ".join(x)).tolist()
