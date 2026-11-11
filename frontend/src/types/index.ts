/**
 * Type definitions for the Deepfake Detector deepfake audio detection frontend.
 * Defines API payload interfaces, model representations, and UI state models.
 */

/**
 * Result of an inference prediction on a single audio file, as returned by the backend API.
 */
export interface PredictionResult {
    /** Identifier of the model that executed the prediction (ex. 'wav2vec2_linear') */
    model_id: string;
    /** Original name of the evaluated audio file */
    filename: string;
    /** Classification outcome: 'spoof' (AI/deepfake) or 'bonafide' (authentic human voice) */
    prediction: "bonafide" | "spoof";
    /** Normalized confidence score in range [0.0, 1.0] */
    confidence: number;
    /** Raw logit output from the neural network classifier (threshold typically 0.0) */
    raw_score: number;
    /** Duration of inference inside container in milliseconds */
    inference_time_ms: number;
    /** Decision threshold applied during inference */
    threshold_used: number;
}

/**
 * Response structure for batch inference (/api/predict/batch).
 */
export interface BatchPredictionResponse {
    /** Identifier of the model used */
    model_id: string;
    /** Number of audio files processed */
    total_files: number;
    /** Detailed predictions for each file */
    results: PredictionResult[];
    /** Overall processing duration in milliseconds */
    total_time_ms: number;
}

/**
 * Metadata for a registered anti-spoofing model (/api/models).
 */
export interface ModelInfo {
    /** Unique technical model ID */
    id: string;
    /** Human-readable display label */
    name: string;
    /** Technical description and architecture details */
    description: string;
    /** Associated Docker image tag */
    image_tag: string;
    /** Indicates whether the container image is already built */
    image_built: boolean;
    /** Default decision threshold */
    default_threshold: number;
}

/**
 * Models registry response wrapper (/api/models).
 */
export interface ModelsListResponse {
    /** List of registered models */
    models: ModelInfo[];
    /** Default model ID selected by backend */
    default_model_id: string;
}

/**
 * Response returned by the model build endpoint
 * (POST /api/models/{model_id}/build).
 */
export interface BuildModelResponse {
    /** Backend operation status, typically "success" */
    status: string;
    /** Identifier of the model whose image was built */
    model_id: string;
    /** Human-readable success message */
    message: string;
    /** Tail end of the Docker build logs */
    build_output_snippet?: string;
}

/**
 * Lifecycle of a Docker image build triggered from the UI.
 * A model without an entry is considered idle.
 */
export type ModelBuildStatus = "building" | "success" | "error";

/**
 * State of one model's Docker image build.
 */
export interface ModelBuildState {
    /** Current build status */
    status: ModelBuildStatus;
    /** Error message when status is "error" */
    error?: string;
    /** Timestamp used to display the elapsed build time */
    startedAt?: number;
}

/**
 * Build states indexed by model ID.
 */
export type ModelBuildStates = Record<string, ModelBuildState>;

/**
 * System and service health check response (/api/health).
 */
export interface HealthResponse {
    /** Overall system status: 'ok' or 'degraded' */
    status: "ok" | "degraded";
    /** Whether the Docker daemon is accessible */
    docker_available: boolean;
    /** Whether NVIDIA GPU acceleration is operational in Docker */
    gpu_available: boolean;
    /** List of registered model IDs */
    registered_models: string[];
    /** Default model ID */
    default_model: string;
    /** Optional diagnostic or troubleshooting message */
    details: string | null;
}

/**
 * Represents an uploaded audio file stored in browser memory.
 */
export interface UploadedAudioFile {
    /** Unique local client ID */
    id: string;
    /** Native File reference */
    file: File;
    /** File display name */
    name: string;
    /** File size in bytes */
    size: number;
    /** Blob object URL for local audio playback preview */
    objectUrl: string;
    /** Estimated or loaded audio duration in seconds */
    duration?: number;
}

/**
 * Active application view mode.
 */
export type ViewMode = "single" | "batch";

/**
 * Progress states during inference requests.
 */
export type AnalysisStatus = "idle" | "loading" | "success" | "error";
