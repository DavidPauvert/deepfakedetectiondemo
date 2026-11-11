# Deepfake Detector — Frontend React + TypeScript (Bun)

Application web moderne pour la détection et l'analyse de deepfakes audio multi-modèles, développée en **React**, **TypeScript** et propulsée par le runtime **Bun** avec **Tailwind CSS**.

---

## Démarrage Rapide

### 1. Installation des dépendances

```bash
cd frontend
bun install
```

### 2. Lancer le serveur de développement

```bash
bun dev
```

L'application démarre immédiatement sur [http://localhost:3000](http://localhost:3000) (ou le port alloué par Bun).  
Le serveur Bun intègre un proxy transparent vers l'API backend FastAPI (`http://localhost:8000/api/*`).

### 3. Exécuter les tests unitaires

```bash
bun test
```

### 4. Vérification statique des types TypeScript

```bash
bun run typecheck
```

### 5. Compiler pour la production

```bash
bun run build
```

---

## Intégration avec l'API Backend

Le frontend s'interface avec les endpoints FastAPI du dossier `backend` :

1. **`GET /api/health`** : Contrôle l'état du serveur, la disponibilité du démon Docker et du GPU NVIDIA CUDA.
2. **`GET /api/models`** : Récupère dynamiquement la liste des modèles enregistrés dans le registre (`wav2vec2_linear`, etc.).
3. **`POST /api/predict`** : Exécute l'inférence sur un fichier audio unique (`file`, `model_id`, `threshold`).
4. **`POST /api/predict/batch`** : Exécute l'inférence par lot sur plusieurs fichiers en un seul passage conteneurisé.
5. **`POST /api/models/{model_id}/build`** : Permet la construction à la demande d'une image Docker si elle n'est pas encore présente.

### Interprétation mathématique des scores

- `prob = 1.0 / (1.0 + exp(-score))`
- Si `prediction == "spoof"` : la probabilité que l'audio soit issu d'une IA correspond à `confidence` (ex: 67%).
- Si `prediction == "bonafide"` : la probabilité d'IA correspond à `(1.0 - confidence)` (ex: 4%).

---
