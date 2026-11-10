import time
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.models_registry import MODELS_REGISTRY, DEFAULT_MODEL_ID
from app.services.docker_runner import docker_runner
from app.api.schemas import (
    HealthResponse,
    ModelInfo,
    ModelsListResponse,
    PredictionResult,
    BatchPredictionResponse,
)

router = APIRouter()

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}


@router.get("/health", response_model=HealthResponse, tags=["System"])
def health_check():
    """
    Checks the health of the backend, Docker availability, and registered models.
    """
    docker_ok = docker_runner.is_docker_available()
    gpu_ok = docker_runner.is_gpu_available() if docker_ok else False

    details = None
    if not docker_ok:
        details = "Daemon docker inaccessible, assurez vous qu'il tourne en fond"
    elif not gpu_ok:
        details = (
            "Erreur avec docker et votre GPU. "
            "Pour activer le GPU dans docker, installez nvidia-container-toolkit et redémarrez docker."
        )

    return HealthResponse(
        status="ok" if docker_ok else "degraded",
        docker_available=docker_ok,
        gpu_available=gpu_ok,
        registered_models=list(MODELS_REGISTRY.keys()),
        default_model=DEFAULT_MODEL_ID,
        details=details,
    )


@router.get("/models", response_model=ModelsListResponse, tags=["Models"])
def list_models():
    """
    Lists all registered deepfake audio detection models and their build status.
    """
    model_infos = []
    for model_id, cfg in MODELS_REGISTRY.items():
        is_built = docker_runner.is_image_built(cfg.image_tag)
        model_infos.append(
            ModelInfo(
                id=model_id,
                name=cfg.name,
                description=cfg.description,
                image_tag=cfg.image_tag,
                image_built=is_built,
                default_threshold=cfg.default_threshold,
            )
        )

    return ModelsListResponse(
        models=model_infos,
        default_model_id=DEFAULT_MODEL_ID,
    )


@router.post("/models/{model_id}/build", tags=["Models"])
def build_model(model_id: str):
    """
    Builds the Docker image for a specific model.
    """
    if model_id not in MODELS_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Modèle '{model_id}' introuvable dans le registre des modèles.",
        )

    try:
        output = docker_runner.build_model_image(model_id)
        return {
            "status": "success",
            "model_id": model_id,
            "message": f"Image '{MODELS_REGISTRY[model_id].image_tag}' construite.",
            "build_output_snippet": output[-500:] if len(output) > 500 else output,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur de construction docker pour '{model_id}': {str(e)}",
        )


@router.post("/predict", response_model=PredictionResult, tags=["Inference"])
async def predict_single_audio(
    file: UploadFile = File(..., description="Audio à analyser (.wav, .mp3, etc.)"),
    model_id: Optional[str] = Form(DEFAULT_MODEL_ID, description="ID du modèle"),
    threshold: Optional[float] = Form(None, description="Seuil de décision personnalisé (optionnel)"),
):
    """
    Performs deepfake audio detection on a single audio file.
    """
    if model_id not in MODELS_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Modèle '{model_id}' introuvable. Modèles disponibles: {list(MODELS_REGISTRY.keys())}",
        )

    filename = file.filename or "uploaded_audio.wav"
    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier est vide.",
        )

    try:
        results = docker_runner.run_inference(
            model_id=model_id,
            audio_files=[(filename, file_bytes)],
            threshold=threshold,
        )
        if not results:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Inférence exécutée mais aucun résultat retourné",
            )
        return PredictionResult(**results[0])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur inférence: {str(e)}",
        )


@router.post("/predict/batch", response_model=BatchPredictionResponse, tags=["Inference"])
async def predict_batch_audio(
    files: List[UploadFile] = File(..., description="Liste de fichier à analyser"),
    model_id: Optional[str] = Form(DEFAULT_MODEL_ID, description="ID du modèle"),
    threshold: Optional[float] = Form(None, description="Seuil de décision (optionnel)"),
):
    """
    Performs deepfake audio detection on a batch of audio files in a single Docker run.
    """
    if model_id not in MODELS_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Modèle '{model_id}' introuvable. Modèles disponibles: {list(MODELS_REGISTRY.keys())}",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun fichier envoyé",
        )

    audio_files = []
    for f in files:
        fname = f.filename or "uploaded_audio.wav"
        fbytes = await f.read()
        if len(fbytes) > 0:
            audio_files.append((fname, fbytes))

    if not audio_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tous les fichiers sont vides.",
        )

    t0 = time.time()
    try:
        results = docker_runner.run_inference(
            model_id=model_id,
            audio_files=audio_files,
            threshold=threshold,
        )
        total_time_ms = round((time.time() - t0) * 1000, 2)

        prediction_results = [PredictionResult(**res) for res in results]
        return BatchPredictionResponse(
            model_id=model_id,
            total_files=len(prediction_results),
            results=prediction_results,
            total_time_ms=total_time_ms,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur inférence: {str(e)}",
        )
