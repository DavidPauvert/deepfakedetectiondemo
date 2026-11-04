"""
Registre des modèles de détection de deepfake audio.

Ce module centralise la configuration des différents modèles d'anti-spoofing disponibles.
Chaque modèle est modulaire et déclare :
    - Ses métadonnées descriptives (nom, architecture, seuil par défaut).
    - Sa configuration Docker (image, Dockerfile, commande d'inférence).
    - La fonction de montage des volumes pour lier les poids et les fichiers audio (get_volumes).
    - La fonction d'analyse syntaxique (parsing) de la sortie standard du script (parse_output).
"""
import re
import math
from pathlib import Path
from typing import Callable, Dict, Any, List


def parse_wav2vec_linear_output(stdout: str, threshold: float = 0.0) -> List[Dict[str, Any]]:
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


def get_wav2vec2_linear_volumes(base_dir: Path, temp_job_dir: Path) -> dict:
    """
    Définit les points de montage de volumes Docker pour le modèle Wav2Vec2 + Linear.

    Associe les dossiers locaux de l'hôte aux répertoires attendus dans le conteneur :
    1. Les poids pré-entraînés du modèle (spoofing_ckpt2.ckpt et wav2vec_xlsr_300m)
        sont montés en lecture seule sur '/wav2vec_linear'.
    2. Le répertoire temporaire contenant les fichiers audio de la requête est monté
        en lecture seule sur '/workspace/audio'.

    Args:
        base_dir: Chemin racine du backend (répertoire hôte).
        temp_job_dir: Dossier temporaire contenant les fichiers audio uploadés pour ce job.

    Returns:
        Dictionnaire de configuration des volumes pour l'API Docker Python SDK.

    Raises:
        FileNotFoundError: Si le dossier des poids pré-entraînés est manquant sur l'hôte.
    """
    weights_path = base_dir / "models/wav2vec2_linear/wav2vec2_linear/wav2vec_linear"
    if not weights_path.exists():
        raise FileNotFoundError(
            f"Dossier des poids du modèles introuvables à {weights_path}. "
            "Assurez vous que spoofing_ckpt2.ckpt et wav2vec_xlsr_300m sont présents."
        )

    return {
        # Montage des poids du modèle en lecture seule
        str(weights_path.resolve()): {"bind": "/wav2vec_linear", "mode": "ro"},
        # Montage des fichiers audio à analyser en lecture seule
        str(temp_job_dir.resolve()): {"bind": "/workspace/audio", "mode": "ro"},
    }


# ==============================================================================
# Registre des modèles
# ==============================================================================
# Ce dictionnaire associe un identifiant de modèle à toutes les informations
# nécessaires pour l'exécuter dans un conteneur Docker isolé.
#
# Pour ajouter un nouveau modèle dans le système, il suffit d'ajouter une entrée
# ici avec les fonctions get_volumes et parse_output correspondantes.
# ==============================================================================
MODELS_REGISTRY: Dict[str, Dict[str, Any]] = {
    "wav2vec2_linear": {
        # Identifiant technique unique utilisé dans l'API et les requêtes
        "id": "wav2vec2_linear",
        # Nom convivial destiné à l'affichage dans l'interface utilisateur
        "name": "IRISA Wav2Vec2 + Linear",
        # Description détaillée de l'architecture et du fonctionnement
        "description": "Anti-spoofing deepfake audio detection using Wav2Vec2 XLS-R 300M and a linear classifier",
        # Tag de l'image Docker à utiliser ou construire
        "image_tag": "antispoofs:latest",
        # Chemin relatif vers le dossier contenant le Dockerfile du modèle
        "dockerfile_dir": "models/wav2vec2_linear/antispoof",
        # Commande d'inférence exécutée à l'intérieur du conteneur
        "command": (
            "python inference.py "
            "--audiodir audio "
            "--cmmodel wav2vec_linear "
            "--ckpt_path /wav2vec_linear/spoofing_ckpt2.ckpt "
            "--xlsr_path /wav2vec_linear/wav2vec_xlsr_300m"
        ),
        # Seuil de décision par défaut (score > 0 => bonafide, sinon spoof)
        "default_threshold": 0.0,
        # Fonction retournant le mappage des volumes Docker pour ce modèle
        "get_volumes": get_wav2vec2_linear_volumes,
        # Fonction analysant la sortie texte pour en extraire les prédictions
        "parse_output": parse_wav2vec_linear_output,
    }
}

# Identifiant du modèle utilisé par défaut lorsqu'aucun modèle n'est spécifié
DEFAULT_MODEL_ID = "wav2vec2_linear"
