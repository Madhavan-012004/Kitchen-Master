import argparse
import json
from processor import Processor

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--model", required=False, default="")
    args = parser.parse_args()

    processor = Processor(args.model)
    data = processor.process(args.file)
    
    # Print the JSON to stdout so Java ProcessBuilder can read it
    print(json.dumps(data))

if __name__ == "__main__":
    main()
