import re
import math
from typing import Dict, Any, List

def parse(stdout: str, threshold: float = 0.0) -> List[Dict[str, Any]]:
    """
    Analyse la sortie standard du script d'inférence Wav2Vec2 + Linear.

    Exemple de ligne produite par models/wav2vec2_linear/antispoof/inference.py :
        'p376_004.wav → shape=(1,), preds=[-2.418374], time=42.1 ms'

    Logique de décision :
        - Le logit brut (score) est comparé au seuil (threshold).
        - score > threshold  => "bonafide" (voix authentique / humaine).
        - score <= threshold => "spoof" (voix synthétique / deepfake).

    Calcul de confiance :
        - Une fonction sigmoïde 1 / (1 + exp(-score)) convertit le logit en probabilité
        d'authenticité (entre 0.0 et 1.0). (j'en ai chié pour trouver cette formule dites merci svp)
        - La confiance finale correspond à la probabilité de la classe prédite.

    Args:
        stdout: Sortie textuelle brute générée par le conteneur Docker.
        threshold: Seuil numérique de classification (par défaut 0.0).

    Returns:
        Une liste de dictionnaires contenant pour chaque fichier audio analysé :
        le nom du fichier, le score brut, la prédiction, la confiance et le temps de calcul.
    """
    results = []
    # Expression régulière pour extraire :
    # 1. Le nom du fichier audio (ex: p376_004.wav)
    # 2. Le logit / score prédit (ex: -2.418374)
    # 3. La durée d'inférence en millisecondes (ex: 42.1)
    # J'EN PEUX PLUS DU REGEX AU SECOUUUUUUUUUUUUUUUUUUURS
    pattern = re.compile(
        r"([a-zA-Z0-9_\-\.]+)\s*→\s*shape=.*preds=\[([-\d\.\s,eE]+)\].*time=([\d\.]+)\s*ms"
    )

    for line in stdout.splitlines():
        match = pattern.search(line)
        if match:
            filename = match.group(1).strip()
            score_raw = match.group(2).strip()
            time_ms = float(match.group(3).strip())

            # Conversion du logit brut en float
            try:
                score = float(score_raw)
            except ValueError:
                score = float(score_raw.split()[0].replace(",", ""))

            # Règle de classification :
            # Un score supérieur au seuil indique un enregistrement authentique (bonafide).
            # Un score inférieur ou égal indique une contrefaçon / deepfake (spoof).
            prediction = "bonafide" if score > threshold else "spoof"

            # Conversion du score logit en probabilité via la fonction sigmoïde
            try:
                prob = 1.0 / (1.0 + math.exp(-score))
            except OverflowError:
                # Évite les erreurs d'overflow en cas d'exponentielle trop grande
                prob = 0.0 if score < 0 else 1.0

            # Calcul du score de confiance pour la classe retenue
            # Si bonafide, confiance = prob ; si spoof, confiance = 1 - prob
            confidence = prob if prediction == "bonafide" else (1.0 - prob)

            results.append({
                "filename": filename,
                "raw_score": round(score, 4),
                "prediction": prediction,
                "confidence": round(confidence, 4),
                "inference_time_ms": round(time_ms, 2),
                "threshold_used": threshold,
            })

    return results
