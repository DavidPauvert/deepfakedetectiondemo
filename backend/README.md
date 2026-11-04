# Backend FastAPI - Détection de Deepfakes Audio

Application FastAPI permettant d'interagir avec différents modèles d'anti-spoofing et de détection de deepfakes audio encapsulés dans des conteneurs Docker.

---

## Démarrage Rapide

### 1. Activer l'environnement virtuel Python
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Lancer le serveur FastAPI
```bash
uvicorn main:app --reload --port 8000
```
- **Documentation Swagger UI interactive** : [http://localhost:8000/docs](http://localhost:8000/docs)
- **Vérification d'état (Healthcheck)** : [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Liste des modèles** : [http://localhost:8000/api/models](http://localhost:8000/api/models)

---

## Activation du GPU NVIDIA dans Docker

Les modèles tournant sur docker requierent CUDA pour exécuter leurs inférences.
Assurez vous donc d'avoir les drivers nécessaires si vous faites tourner le projet sous linux (Il s'agit du package nvidia-container-toolkit)

Vous pouvez ensuite vérifier la disponibilité via :
```bash
curl http://localhost:8000/api/health
```
*(Le champ `"gpu_available"` passera à `true`)*.

---

## Utilisation des Endpoints

### 1. Inférence sur un seul fichier audio
```bash
curl -X POST http://localhost:8000/api/predict \
  -F "file=lecheminverslefichier" \
  -F "model_id=lemodèleàutiliser"
```
**Exemple de réponse JSON :**
```json
{
  "model_id": "wav2vec2_linear",
  "filename": "p376_004.wav",
  "prediction": "spoof",
  "confidence": 0.9182,
  "raw_score": -2.4184,
  "inference_time_ms": 42.1,
  "threshold_used": 0.0
}
```

### 2. Inférence sur plusieurs fichiers
Traite plusieurs fichiers en une seule exécution de conteneur (les poids ne sont chargés qu'une seule fois) :
```bash
curl -X POST http://localhost:8000/api/predict/batch \
  -F "files=@audio1.wav" \
  -F "files=@audio2.wav" \
  -F "model_id=lemodèleàutiliser"
```

---

## Comment ajouter un nouveau modèle

Le système est conçu pour accueillir de nouveaux modèles sans altérer leur code interne :

1. Déposez le nouveau modèle dans son propre sous-dossier, par exemple : `models/mon_nouveau_modele/`
2. Assurez-vous que sa `Dockerfile` construit et exécute son script d'inférence.
3. Déclarez le modèle dans [app/core/models_registry.py](file:///home/epic/Documents/BUT/BUT3/SAE/deepfakedetectiondemo/backend/app/core/models_registry.py) :
```python
MODELS_REGISTRY["mon_nouveau_modele"] = {
    "id": "mon_nouveau_modele",
    "name": "Le nom du modèle",
    "description": "Description du modèle...",
    "image_tag": "mon_nouveau_modele:latest",
    "dockerfile_dir": "models/mon_nouveau_modele",
    "command": "python inference.py --audio /workspace/audio ...",
    "default_threshold": 0.0,
    "get_volumes": get_volumes_callback,
    "parse_output": parse_output_callback,
}
```
L'API détectera automatiquement le nouveau modèle dès le redémarrage.