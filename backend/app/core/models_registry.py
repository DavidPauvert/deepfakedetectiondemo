"""
Registre des modèles de détection de deepfake audio.

Ce module centralise la configuration des différents modèles d'anti-spoofing disponibles.
Chaque modèle est modulaire et déclare :
    - Ses métadonnées descriptives (nom, architecture, seuil par défaut).
    - Sa configuration Docker (image, Dockerfile, commande d'inférence).
    - La fonction de montage des volumes pour lier les poids et les fichiers audio (get_volumes).
    - La fonction d'analyse syntaxique (parsing) de la sortie standard du script (parse_output).
"""
from pathlib import Path
from dataclasses import dataclass
from typing import Callable, Dict, Any, List
from importlib.util import module_from_spec, spec_from_file_location
import json

from app.core.config import settings

@dataclass
class ModelConfig:
    """
    Description d'un modèle chargé par l'application
    """
    # Identifiant technique unique utilisé dans l'API et les requêtes
    id: str
    # Nom convivial destiné à l'affichage dans l'interface utilisateur
    name: str
    # Description détaillée de l'architecture et du fonctionnement
    description: str
    # Tag de l'image Docker à utiliser ou construire
    image_tag: str
    # Commande d'inférence exécutée à l'intérieur du conteneur
    command: str
    # Seuil de décision par défaut (score > 0 => bonafide, sinon spoof)
    default_threshold: float
    # Chemin vers le modèle
    model_path: Path
    # Chemin dans le modèle vers le Dockerfile
    dockerfile: Path
    # Chemin dans le modèle vers le dossier des poids
    weights_path: Path
    # Chemin dans le modèle vers le dossier où placer les fichiers audio
    audio_path: Path
    # Fonction analysant la sortie texte pour en extraire les prédictions
    parse_output: Callable[[str, float], List[Dict[str, Any]]]

def get_parser_from_filepath(filepath: Path) -> Callable[[str, float], List[Dict[str, Any]]]:
    """
    Récupère une fonction de parser depuis un fichier python
    """
    function_name = "parse"

    # Chargement dynamique du module à partir de son emplacement
    spec = spec_from_file_location("dynamic_parser_mod", filepath)
    if spec is None or spec.loader is None:
        raise ImportError(f"Impossible de charger le fichier à l'adresse : {filepath}")

    module = module_from_spec(spec)
    spec.loader.exec_module(module)

    if not hasattr(module, function_name):
        raise AttributeError(f"La fonction '{function_name}' est introuvable dans {filepath}")

    # Empaquetage de la fonction chargée
    parse_lambda = getattr(module, function_name)
    return lambda stdout, threshold=0.0: parse_lambda(stdout, threshold)

def build_registry() -> Dict[str, ModelConfig]:
    """
    Fonction de construction du registre
    """
    registry: Dict[str, ModelConfig] = {}

    # Exploration dossier par dossier dans le dossier des modèles
    for f in settings.MODELS_DIR.iterdir():
        jsonpath = f / "model.json"

        # On ne s'occupe que des dossiers qui ont un json de modèle
        if jsonpath.is_file():
            with open(jsonpath, "r", encoding="utf-8") as file:
                data = json.load(file)
            
            entry = build_registry_entry(data, f)

            if entry is not None:
                registry[entry.id] = entry
    
    return registry

def build_registry_entry(data, path: Path) -> ModelConfig:
    """
    Fonction de construction d'une entrée du registre
    """

    command = data["command"]

    dockerfile = Path(str(data["dockerfile"])) # Existence à vérifier
    weights_path = Path(str(data["weights_path"])) # Existence à vérifier
    audio_path = Path(str(data["audio_path"])) # Dossier temporaire, pas besoin de vérifier l'existence
    parser_path = (path / str(data["parser_path"])).resolve() # Existence vérifiée par get_parser_from_filepath()

    if not (path / dockerfile).exists():
        raise FileNotFoundError(f"Ce Dockerfile n'existe pas : {(path / dockerfile).resolve()}")

    if not (path / weights_path).exists():
        raise FileNotFoundError(f"Ce dossier des poids n'existe pas : {(path / weights_path).resolve()}")

    return ModelConfig(
        path.name,
        str(data["name"]),
        str(data["description"]),
        str(data["image_tag"]),
        " ".join(command) if isinstance(command, list) else str(command),
        float(data["default_threshold"]),
        path,
        dockerfile,
        weights_path,
        audio_path,
        get_parser_from_filepath(parser_path)
    )

# Registre des modèles
MODELS_REGISTRY: Dict[str, ModelConfig] = build_registry()

# Identifiant du modèle utilisé par défaut lorsqu'aucun modèle n'est spécifié
DEFAULT_MODEL_ID = next(iter(MODELS_REGISTRY))
