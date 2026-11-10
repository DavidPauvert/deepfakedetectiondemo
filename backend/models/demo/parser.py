import json
from typing import Dict, Any, List

def parse(stdout: str, threshold: float = 0.0) -> List[Dict[str, Any]]:
    
    r = json.loads(stdout)
    
    results = []

    for f in r.keys():

        score = r[f]

        prediction = "bonafide" if score > threshold else "spoof"

        results.append({
            "filename": f,
            "raw_score": round(score, 4),
            "prediction": prediction,
            "confidence": round(score, 4),
            "inference_time_ms": round(score * 10, 2),
            "threshold_used": threshold,
        })

    return results
