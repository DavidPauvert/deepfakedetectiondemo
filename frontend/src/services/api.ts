/**
 * Service API pour la communication avec le backend FastAPI de détection de deepfakes.
 * Gère les requêtes d'inférence (simple et par lot), la découverte dynamique des modèles,
 * et le contrôle de santé du système.
 *
 * Prend en compte les temps d'inférence potentiellement longs des modèles d'IA
 * (chargement de checkpoints lourds de 3,7 Go dans Docker) et supporte l'annulation par AbortSignal.
 */

import type {
    HealthResponse,
    ModelsListResponse,
    PredictionResult,
    BatchPredictionResponse,
    BuildModelResponse,
} from "../types";

const STORAGE_KEY = "super_detector_backend_url";

/**
 * Normalise l'URL saisie par l'utilisateur :
 * - Supprime les espaces superflus
 * - Ajoute le protocole http:// si omis
 * - Supprime le slash final
 * - Supprime un suffixe /api éventuel pour conserver l'origine racine
 */
export function normalizeApiUrl(rawUrl: string): string {
    let clean = rawUrl.trim();
    if (!clean) return "";

    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `http://${clean}`;
    }

    clean = clean.replace(/\/+$/, "");

    if (clean.endsWith("/api")) {
        clean = clean.slice(0, -4);
    }

    return clean.replace(/\/+$/, "");
}

/**
 * Récupère l'URL de l'API enregistrée dans localStorage.
 * Retourne une chaîne vide si aucune adresse n'a été saisie par l'utilisateur.
 */
export function getStoredApiUrl(): string {
    if (typeof window === "undefined") return "";
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored ? normalizeApiUrl(stored) : "";
    } catch {
        return "";
    }
}

/**
 * Enregistre l'URL de l'API dans localStorage et met à jour l'état local.
 */
export function setStoredApiUrl(url: string): string {
    const normalized = normalizeApiUrl(url);
    customApiBaseUrl = normalized;
    if (typeof window !== "undefined") {
        try {
            if (normalized) {
                window.localStorage.setItem(STORAGE_KEY, normalized);
            } else {
                window.localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            // Ignorer les erreurs d'accès à localStorage (ex: navigation privée stricte)
        }
    }
    return normalized;
}

// Initialise l'URL active à partir du stockage local (ou vide par défaut)
let customApiBaseUrl: string = getStoredApiUrl();

/**
 * Configure manuellement l'URL de base active en mémoire.
 */
export function setApiBaseUrl(url: string): void {
    customApiBaseUrl = normalizeApiUrl(url);
}

/**
 * Retourne l'URL de base actuellement configurée.
 */
export function getApiBaseUrl(): string {
    return customApiBaseUrl;
}

/**
 * Construit l'URL complète pour un point de terminaison donné.
 */
export function buildEndpointUrl(
    path: string,
    overrideBaseUrl?: string,
): string {
    const base =
        overrideBaseUrl !== undefined
            ? normalizeApiUrl(overrideBaseUrl)
            : getApiBaseUrl();
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    if (!base) {
        return cleanPath;
    }
    return `${base}${cleanPath}`;
}

/**
 * Transforme les erreurs fetch brutes (notamment les NetworkError de navigateur)
 * en messages explicites et actionnables pour l'utilisateur.
 */
function handleFetchError(err: unknown, targetUrl: string): Error {
    if (err instanceof DOMException && err.name === "AbortError") {
        return new Error("L'analyse a été annulée par l'utilisateur.");
    }

    if (
        err instanceof TypeError &&
        (err.message.includes("NetworkError") || err.message.includes("fetch"))
    ) {
        return new Error(
            `Erreur de communication réseau avec "${targetUrl}". ` +
                `Le navigateur n'a reçu aucune réponse HTTP (connexion réinitialisée ou rejetée). ` +
                `Si le modèle prend du temps à charger dans Docker, vérifiez les logs du terminal backend ` +
                `pour vérifier que le processus Python / Docker n'a pas planté ou dépassé le délai imparti.`,
        );
    }
    return err instanceof Error ? err : new Error(String(err));
}

/**
 * Effectue un contrôle de santé auprès du backend FastAPI (/api/health).
 */
export async function checkBackendHealth(
    targetBaseUrl?: string,
    signal?: AbortSignal,
): Promise<HealthResponse> {
    const url = buildEndpointUrl("/api/health", targetBaseUrl);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal,
        });

        if (!response.ok) {
            throw new Error(
                `Contrôle de santé échoué (HTTP ${response.status}: ${response.statusText})`,
            );
        }

        return (await response.json()) as HealthResponse;
    } catch (err) {
        throw handleFetchError(err, url);
    }
}

/**
 * Récupère la liste des modèles enregistrés dans le backend FastAPI (/api/models).
 */
export async function fetchModels(
    targetBaseUrl?: string,
    signal?: AbortSignal,
): Promise<ModelsListResponse> {
    const url = buildEndpointUrl("/api/models", targetBaseUrl);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: { Accept: "application/json" },
            signal,
        });

        if (!response.ok) {
            throw new Error(
                `Échec de la récupération des modèles (HTTP ${response.status})`,
            );
        }

        return (await response.json()) as ModelsListResponse;
    } catch (err) {
        throw handleFetchError(err, url);
    }
}

/**
 * Extrait un message lisible depuis le corps d'erreur renvoyé par FastAPI.
 * Le champ `detail` peut être une chaîne, un tableau d'erreurs de validation
 * ou un objet.
 */
function extractApiErrorDetail(errorData: unknown, fallback: string): string {
    if (
        typeof errorData === "object" &&
        errorData !== null &&
        "detail" in errorData
    ) {
        const detail = (errorData as { detail?: unknown }).detail;

        if (typeof detail === "string" && detail.trim()) {
            return detail;
        }

        if (Array.isArray(detail)) {
            const messages = detail
                .map((item) => {
                    if (
                        typeof item === "object" &&
                        item !== null &&
                        "msg" in item
                    ) {
                        return String((item as { msg: unknown }).msg);
                    }
                    return typeof item === "string"
                        ? item
                        : JSON.stringify(item);
                })
                .filter(Boolean);

            if (messages.length > 0) {
                return messages.join("\n");
            }
        } else if (detail !== undefined) {
            return JSON.stringify(detail);
        }
    }

    return fallback;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** États renvoyés par GET /api/models/{id}/build/status */
type BuildStatusResponse = {
    state: "idle" | "building" | "ready" | "failed";
    error?: string | null;
    log_tail?: string[];
};

/**
 * Construit l'image Docker d'un modèle.
 * Le backend lance le build en arrière-plan et répond immédiatement ;
 * on interroge ensuite son statut jusqu'à la fin. Aucune requête ne dure
 * longtemps, donc aucun risque de coupure réseau, même pour un build de
 * plusieurs minutes. La promesse se résout quand l'image est prête et
 * échoue si le build échoue.
 */
export async function buildModelImage(
    modelId: string,
    targetBaseUrl?: string,
    signal?: AbortSignal,
): Promise<void> {
    const id = encodeURIComponent(modelId);
    const startUrl = buildEndpointUrl(`/api/models/${id}/build`, targetBaseUrl);
    const statusUrl = buildEndpointUrl(
        `/api/models/${id}/build/status`,
        targetBaseUrl,
    );

    // 1. Lancement du build : réponse immédiate (202)
    try {
        const response = await fetch(startUrl, {
            method: "POST",
            headers: { Accept: "application/json" },
            signal,
        });

        if (!response.ok) {
            const errorData = await response
                .json()
                .catch(() => ({ detail: response.statusText }));
            throw new Error(
                extractApiErrorDetail(
                    errorData,
                    `Échec de la construction (HTTP ${response.status})`,
                ),
            );
        }
    } catch (err) {
        throw handleFetchError(err, startUrl);
    }

    // 2. Suivi du statut jusqu'à la fin
    const POLL_INTERVAL_MS = 3000;
    const MAX_CONSECUTIVE_ERRORS = 5;
    let consecutiveErrors = 0;

    while (true) {
        await sleep(POLL_INTERVAL_MS);

        let status: BuildStatusResponse;
        try {
            const response = await fetch(statusUrl, {
                method: "GET",
                headers: { Accept: "application/json" },
                signal,
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            status = (await response.json()) as BuildStatusResponse;
            consecutiveErrors = 0;
        } catch (err) {
            // Annulation volontaire : on ne réessaie pas
            if (signal?.aborted) {
                throw handleFetchError(err, statusUrl);
            }
            // Une coupure brève ne doit pas faire échouer un long build
            consecutiveErrors += 1;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                throw new Error(
                    "Connexion au serveur perdue pendant la construction de l'image.",
                );
            }
            continue;
        }

        if (status.state === "ready") return;

        if (status.state === "failed") {
            throw new Error(
                status.error?.trim() || "Échec de la construction de l'image.",
            );
        }

        if (status.state === "idle") {
            throw new Error(
                "La construction s'est interrompue (le serveur a peut-être redémarré).",
            );
        }
        // state === "building" : on continue d'attendre
    }
}

/**
 * Exécute la détection de deepfake sur un fichier audio unique via POST /api/predict.
 * Ne définit aucun timeout restrictif côté frontend pour laisser le temps nécessaire
 * au conteneur Docker de charger les poids et de calculer l'inférence.
 */
export async function analyzeSingleAudio(
    file: File,
    modelId: string,
    threshold?: number,
    signal?: AbortSignal,
): Promise<PredictionResult> {
    const url = buildEndpointUrl("/api/predict");
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("model_id", modelId);
    if (threshold !== undefined) {
        formData.append("threshold", threshold.toString());
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            signal,
        });

        if (!response.ok) {
            const errBody = await response
                .json()
                .catch(() => ({ detail: response.statusText }));
            throw new Error(
                errBody.detail ||
                    `Erreur d'inférence (HTTP ${response.status})`,
            );
        }

        return (await response.json()) as PredictionResult;
    } catch (err) {
        throw handleFetchError(err, url);
    }
}

/**
 * Exécute la détection de deepfake par lot sur plusieurs fichiers audio via POST /api/predict/batch.
 */
export async function analyzeBatchAudio(
    files: File[],
    modelId: string,
    threshold?: number,
    signal?: AbortSignal,
): Promise<BatchPredictionResponse> {
    const url = buildEndpointUrl("/api/predict/batch");
    const formData = new FormData();
    for (const file of files) {
        formData.append("files", file, file.name);
    }
    formData.append("model_id", modelId);
    if (threshold !== undefined) {
        formData.append("threshold", threshold.toString());
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            body: formData,
            signal,
        });

        if (!response.ok) {
            const errBody = await response
                .json()
                .catch(() => ({ detail: response.statusText }));
            throw new Error(
                errBody.detail ||
                    `Erreur d'inférence par lot (HTTP ${response.status})`,
            );
        }

        return (await response.json()) as BatchPredictionResponse;
    } catch (err) {
        throw handleFetchError(err, url);
    }
}

/**
 * Calcule le pourcentage de probabilité d'IA (0% à 100%) à partir d'un PredictionResult.
 *
 * Selon la logique du backend (backend/app/core/models_registry.py) :
 * - Si prediction === 'spoof' : la probabilité d'IA correspond à confidence (ex: 67%).
 * - Si prediction === 'bonafide' : la probabilité d'IA correspond à (1 - confidence) (ex: 4%).
 */
export function calculateAIPercentage(result: PredictionResult): number {
    if (result.prediction === "spoof") {
        return Math.min(99, Math.max(51, Math.round(result.confidence * 100)));
    }
    return Math.max(1, Math.min(49, Math.round((1 - result.confidence) * 100)));
}
