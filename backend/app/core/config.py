"""
Configuration globale de l'application backend.

Ce module centralise les paramètres de configuration chargés au démarrage du serveur
via Pydantic Settings, incluant les chemins de répertoires, les paramètres Docker/GPU
et la politique CORS pour les requêtes du frontend.
"""
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Paramètres globaux du projet.

    Les valeurs par défaut définies ici peuvent être surchargées via des variables
    d'environnement ou un fichier .env situé à la racine du backend.

    Nous on en a pas mais c'est pour les chercheurs
    """
    # Métadonnées de l'application et préfixe global de l'API
    PROJECT_NAME: str = "Deepfake Audio Detection Backend"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # Répertoires de travail
    # BASE_DIR pointe vers la racine du dossier backend (3 niveaux au-dessus de ce fichier)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # MODELS_DIR stocke les modèles proposés par l'appli
    MODELS_DIR: Path = BASE_DIR / "models"

    # Paramètres Docker et accélération matérielle
    # USE_GPU active la prise en charge des GPU NVIDIA ('all') dans les conteneurs Docker
    USE_GPU: bool = True
    # DOCKER_TIMEOUT_SECONDS définit la durée maximale (en secondes) autorisée pour un conteneur
    DOCKER_TIMEOUT_SECONDS: int = 180

    # Origines autorisées pour les requêtes cross-origin (CORS)
    # Permet aux clients web de communiquer avec l'API (ex: Vite / React sur les ports 5173 ou 3000)
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*",
    ]

    class Config:
        """Options Pydantic régissant le chargement de la configuration."""
        # Fichier d'environnement local lu en priorité si présent
        env_file = ".env"
        # Ignore les variables d'environnement non déclarées sans lever d'erreur
        extra = "ignore"


# Instance unique de configuration réutilisée dans toute l'application
settings = Settings()
