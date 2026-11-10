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

Les modèles tournant sur docker nécessitent CUDA pour exécuter leurs inférences.

Vous devez donc posséder une carte graphique NVIDIA et installer `nvidia-container-tooklit` (consignes d'installations [ici](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html))

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

1. Déposez le nouveau modèle dans son propre sous-dossier dans le dossier `models/` (ex: `models/mon_nouveau_modele/`)

2. Assurez-vous que sa `Dockerfile` construit et exécute son script d'inférence.

3. Déclarez les propriétés du modèle dans un fichier `model.json` directement dans le dossier (ex: `models/mon_nouveau_modele/model.json`):
```json
{
    "name": "Le nom du modèle",
    "description": "Description du modèle...",
    "image_tag": "mon_nouveau_modele:latest",
    "dockerfile": "chemin/local/Dockerfile",
    "command": ["python inference.py ", "--audio /audio ...", "..."] OU "python inference.py --audio /audio ...",
    "default_threshold": 0.0,
    "weights_path": "wav2vec2_linear/",
    "audio_path": "audio/",
    "parser_path": "chemin/local/parser.py"
}
```
L'API détectera alors automatiquement le nouveau modèle dès le redémarrage.

4. Construisez le modèle. Vous avez alors deux possibilités:
    1. Via l'API:
      ```bash
      curl -X POST http://localhost:8000/api/models/demo/mon_nouveau_modele
      ```
    2. Directement via la commande `docker build` comme une image classique, en spécifiant bien le même tag d'image que dans `image_tag`.  
    L'interface côté client étant fatalement limitée sur ce sujet, il est préférable de build directement pour avoir un retour en direct de Docker.

Tous les chemins spécifiés dans le fichier model.json doivent être relatifs au dossier du modèle.  

Pour plus de détails sur le fonctionnement, référez-vous au modèle démo dans `models/demo/`.
