from llama_cpp import Llama

class LlamaClient:
    def __init__(self, model_path):
        self.llm = Llama(model_path=model_path, n_ctx=2048, n_threads=8)

    def refine(self, text, field):
        prompt = f"Extract {field} from this text:\n{text}\nOnly return value."
        output = self.llm(prompt, max_tokens=50, temperature=0)
        return output["choices"][0]["text"].strip()
