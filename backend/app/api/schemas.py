"""
Schémas Pydantic pour la validation des données et la documentation de l'API.

Ces modèles définissent la structure des réponses retournées par les points d'entrée
FastAPI ainsi que les formats des données de sortie lors de l'inférence.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """
    Schéma de réponse pour l'état de santé du service (/api/health).

    Fournit des informations sur le statut général de l'API, la connectivité au
    démon Docker, la disponibilité du GPU et la liste des modèles enregistrés.
    """
    status: str = Field(
        ...,
        example="ok",
        description="Statut global du système"
    )
    docker_available: bool = Field(
        ...,
        example=True,
        description="Indique si le démon Docker est joignable et opérationnel"
    )
    gpu_available: bool = Field(
        ...,
        example=True,
        description="Indique si le runtime GPU NVIDIA est disponible sous Docker"
    )
    registered_models: List[str] = Field(
        ...,
        example=["wav2vec2_linear"],
        description="Liste des identifiants des modèles enregistrés dans le système"
    )
    default_model: str = Field(
        ...,
        example="wav2vec2_linear",
        description="Identifiant du modèle sélectionné par défaut pour les prédictions"
    )
    details: Optional[str] = Field(
        default=None,
        example=None,
        description="Message d'information ou d'erreur en cas de mode dégradé"
    )


class ModelInfo(BaseModel):
    """
    Métadonnées décrivant un modèle d'anti-spoofing enregistré.

    Permet au frontend de connaître les caractéristiques d'un modèle, son seuil
    par défaut et si son conteneur Docker est déjà construit.
    """
    id: str = Field(
        ...,
        example="wav2vec2_linear",
        description="ID du modèle"
    )
    name: str = Field(
        ...,
        example="IRISA Wav2Vec2 + Linear",
        description="Nom d'affichage pour l'interface utilisateur"
    )
    description: str = Field(
        ...,
        example="Counter-measure model based on Wav2Vec2 XLS-R",
        description="Description technique du modèle et de son architecture"
    )
    image_tag: str = Field(
        ...,
        example="antispoofs:latest",
        description="Nom et tag de l'image Docker contenant l'environnement d'exécution"
    )
    image_built: bool = Field(
        ...,
        example=True,
        description="Indique si l'image Docker a déjà été construite sur l'hôte"
    )
    default_threshold: float = Field(
        ...,
        example=0.0,
        description="Seuil de décision par défaut pour classifier 'bonafide' ou 'spoof'"
    )


class ModelsListResponse(BaseModel):
    """
    Schéma de réponse pour la liste des modèles disponibles (/api/models).
    """
    models: List[ModelInfo] = Field(
        ...,
        description="Liste des métadonnées de tous les modèles enregistrés"
    )
    default_model_id: str = Field(
        ...,
        example="wav2vec2_linear",
        description="ID du modèle sélectionné par défaut"
    )


class PredictionResult(BaseModel):
    """
    Résultat de détection d'anti-spoofing pour un fichier audio individuel.

    Contient la décision binaire (authentique ou deepfake), la confiance estimée,
    le score brut du modèle ainsi que la durée de calcul.
    """
    model_id: str = Field(
        ...,
        example="wav2vec2_linear",
        description="ID du modèle ayant réalisé la prédiction"
    )
    filename: str = Field(
        ...,
        example="audio.wav",
        description="Nom d'origine du fichier audio analysé"
    )
    prediction: str = Field(
        ...,
        example="spoof",
        description="Verdict de classification : 'bonafide' (authentique) ou 'spoof' (deepfake)"
    )
    confidence: float = Field(
        ...,
        example=0.942,
        description="Score de confiance normalisé entre 0.0 et 1.0 (calculé via sigmoïde parce que la FLEMME de documenter et faire le calcul de tête la)"
    )
    raw_score: float = Field(
        ...,
        example=-2.418,
        description="Score logit brut sorti par le modèle (seuil habituel à 0.0)"
    )
    inference_time_ms: float = Field(
        ...,
        example=42.1,
        description="Durée de l'inférence du modèle pour cet échantillon (en millisecondes)"
    )
    threshold_used: float = Field(
        ...,
        example=0.0,
        description="Valeur du seuil de décision appliquée pour cette prédiction"
    )


class BatchPredictionResponse(BaseModel):
    """
    Schéma de réponse globale pour une analyse audio individuelle ou par lot (/api/predict).

    Regroupe les résultats individuels de chaque fichier et le temps total d'exécution.
    """
    model_id: str = Field(
        ...,
        example="wav2vec2_linear",
        description="ID du modèle utilisé pour traiter la requête"
    )
    total_files: int = Field(
        ...,
        example=1,
        description="Nombre total de fichiers audio traités avec succès"
    )
    results: List[PredictionResult] = Field(
        ...,
        description="Liste détaillée des résultats de prédiction pour chaque fichier"
    )
    total_time_ms: float = Field(
        ...,
        example=120.5,
        description="Temps total d'exécution de la requête en millisecondes"
    )
