import argparse
from processor import Processor

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--model", required=True)
    args = parser.parse_args()

    processor = Processor(args.model)
    processor.process(args.file)

if __name__ == "__main__":
    main()
