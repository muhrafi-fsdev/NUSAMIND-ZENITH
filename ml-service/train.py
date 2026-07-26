from __future__ import annotations

import argparse
import json
from nusamind_ml.engine import MLEngine


def main() -> None:
    parser = argparse.ArgumentParser(description="Train NusaMind intent classifier")
    parser.add_argument("--dataset", default="intent-seed.csv")
    args = parser.parse_args()
    result = MLEngine().train_intent(args.dataset)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
