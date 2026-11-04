from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.routes import router as api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start : on check que le dossier audiotemp existe pour le traitement
    settings.TEMP_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    yield
    # TODO : J'ai pas encore implémenté de shutdown logic oopsie

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Une API de détection de deepfake qui utilise des modèles via Docker."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# EXPLICATION : 
# Ce middleware c'est en gros un bout de code qui va permettre à l'API d'accepter des requêtes du front-end
# Si besoin allez checkez la docu de CORSMiddleware vous verrez c'est magique ce truc
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# On ajoute les routes pour l'API
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Bienvenue sur {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health",
        "models_url": f"{settings.API_V1_PREFIX}/models",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
