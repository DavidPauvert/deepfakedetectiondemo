import random
from pathlib import Path
import argparse
import json

if __name__ == "__main__":
    """
    Ce modèle démo renvoie des nombres au hasard pour les fichiers qu'il reçoit.
    """

    parser = argparse.ArgumentParser(description="Demo model for deepfake detection. Returns random results.")
    parser.add_argument("--audiodir", type=str, help="Path to the audio directory to be evaluated")
    args = parser.parse_args()

    audiodir = Path(args.audiodir)

    result = {}

    for f in audiodir.iterdir():
        result[f.name] = random.uniform(-1, 1)

    print(json.dumps(result))
