import React, { useState, useCallback, useRef, useEffect } from "react";
import type { UploadedAudioFile, ModelInfo, PredictionResult } from "../types";
import { AudioUploader } from "./AudioUploader";
import { ModelSelector } from "./ModelSelector";
import { AudioPlayer } from "./AudioPlayer";
import { GaugeMeter } from "./GaugeMeter";
import { analyzeSingleAudio, calculateAIPercentage } from "../services/api";

export interface SingleAnalysisViewProps {
    /** Modèles disponibles issus de l'API */
    models: ModelInfo[];
    /** ID du modèle sélectionné par défaut */
    defaultModelId: string;
}

/**
 * Vue d'analyse d'un fichier audio unique.
 * Gère les temps d'inférence longs avec chrono d'attente et possibilité d'annulation.
 */
export const SingleAnalysisView: React.FC<SingleAnalysisViewProps> = ({
    models,
    defaultModelId,
}) => {
    // Fichier audio téléversé
    const [uploadedFiles, setUploadedFiles] = useState<UploadedAudioFile[]>([]);
    // Modèle sélectionné
    const [selectedModelId, setSelectedModelId] =
        useState<string>(defaultModelId);
    // États de l'inférence
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [predictionResult, setPredictionResult] =
        useState<PredictionResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Contrôleur d'annulation pour les requêtes longues
    const abortControllerRef = useRef<AbortController | null>(null);

    // Chronomètre pendant l'analyse
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isLoading) {
            setElapsedSeconds(0);
            interval = setInterval(() => {
                setElapsedSeconds((prev) => prev + 1);
            }, 1000);
        } else {
            setElapsedSeconds(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);

    // Nettoyage de la requête en cours au démontage
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Synchronise le modèle par défaut si la sélection courante n'est pas dans la liste
    useEffect(() => {
        if (
            models.length > 0 &&
            !models.some((m) => m.id === selectedModelId)
        ) {
            setSelectedModelId(defaultModelId || models[0]!.id);
        }
    }, [models, defaultModelId, selectedModelId]);

    // Ajout de fichier
    const handleFilesAdded = useCallback((newFiles: File[]) => {
        if (newFiles.length === 0) return;
        const file = newFiles[0]!;
        const item: UploadedAudioFile = {
            id: `${Date.now()}-${file.name}`,
            file,
            name: file.name,
            size: file.size,
            objectUrl: URL.createObjectURL(file),
        };

        setUploadedFiles((prev) => {
            prev.forEach((f) => URL.revokeObjectURL(f.objectUrl));
            return [item];
        });
        setPredictionResult(null);
        setErrorMessage(null);
    }, []);

    // Suppression de fichier
    const handleFileRemoved = useCallback((id: string) => {
        setUploadedFiles((prev) => {
            const target = prev.find((f) => f.id === id);
            if (target) {
                URL.revokeObjectURL(target.objectUrl);
            }
            return prev.filter((f) => f.id !== id);
        });
        setPredictionResult(null);
        setErrorMessage(null);
    }, []);

    // Lancement de l'analyse via l'API backend
    const handleAnalyze = useCallback(async () => {
        if (uploadedFiles.length === 0) return;
        const currentAudio = uploadedFiles[0]!;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const result = await analyzeSingleAudio(
                currentAudio.file,
                selectedModelId,
                undefined,
                controller.signal,
            );
            setPredictionResult(result);
        } catch (err: unknown) {
            const errorStr = err instanceof Error ? err.message : String(err);
            setErrorMessage(errorStr);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [uploadedFiles, selectedModelId]);

    // Annuler la requête en cours
    const handleCancelAnalysis = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }
    }, []);

    // "Essayer un autre modèle" : réinitialise le résultat tout en conservant le fichier audio
    const handleTryAnotherModel = useCallback(() => {
        setPredictionResult(null);
        setErrorMessage(null);
    }, []);

    // "Essayer un autre fichier" : réinitialise le fichier et revient à l'étape 1
    const handleTryAnotherFile = useCallback(() => {
        if (uploadedFiles.length > 0) {
            URL.revokeObjectURL(uploadedFiles[0]!.objectUrl);
        }
        setUploadedFiles([]);
        setPredictionResult(null);
        setErrorMessage(null);
    }, [uploadedFiles]);

    const hasFile = uploadedFiles.length > 0;
    const currentFile = uploadedFiles[0];

    if (predictionResult && currentFile) {
        const aiPercentage = calculateAIPercentage(predictionResult);
        const selectedModel = models.find(
            (m) => m.id === predictionResult.model_id,
        );

        return (
            <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-8 py-4 animate-fade-in">
                {/* Lecteur audio orange en haut */}
                <div className="w-full">
                    <AudioPlayer
                        src={currentFile.objectUrl}
                        filename={currentFile.name}
                        fileSize={currentFile.size}
                    />
                </div>

                {/* Carte de résultat avec jauge tachymètre */}
                <div className="w-full bg-white rounded-3xl border-2 border-gray-300 p-8 shadow-xs flex flex-col items-center justify-center">
                    <GaugeMeter percentage={aiPercentage} size="large" />

                    {/* Détails techniques de l'inférence */}
                    <div className="mt-8 pt-6 border-t border-gray-100 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="bg-gray-50 rounded-2xl p-2.5">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                Modèle
                            </span>
                            <span
                                className="text-xs font-bold text-gray-800 truncate block mt-0.5"
                                title={selectedModel?.name}
                            >
                                {selectedModel?.name ||
                                    predictionResult.model_id}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-2.5">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                Confiance
                            </span>
                            <span className="text-xs font-bold text-gray-800 block mt-0.5">
                                {(predictionResult.confidence * 100).toFixed(1)}
                                %
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-2.5">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                Score Brut
                            </span>
                            <span className="text-xs font-mono font-bold text-gray-800 block mt-0.5">
                                {predictionResult.raw_score.toFixed(3)}
                            </span>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-2.5">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                                Temps Calcul
                            </span>
                            <span className="text-xs font-bold text-gray-800 block mt-0.5">
                                {predictionResult.inference_time_ms.toFixed(1)}{" "}
                                ms
                            </span>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 w-full">
                        <button
                            type="button"
                            onClick={handleTryAnotherModel}
                            className="w-full sm:w-auto px-6 py-3.5 bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 font-bold rounded-2xl shadow-xs transition-all duration-150 active:scale-95 cursor-pointer text-sm"
                        >
                            Essayer un autre modèle
                        </button>
                        <button
                            type="button"
                            onClick={handleTryAnotherFile}
                            className="w-full sm:w-auto px-6 py-3.5 bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 font-bold rounded-2xl shadow-xs transition-all duration-150 active:scale-95 cursor-pointer text-sm"
                        >
                            Essayer un autre fichier
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Vue Saisie
    return (
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-6 py-2">
            {/* Étape 1 : Ajout de fichier audio */}
            <AudioUploader
                files={uploadedFiles}
                onFilesAdded={handleFilesAdded}
                onFileRemoved={handleFileRemoved}
                multiple={false}
                title="1. Ajoutez un fichier audio"
            />

            {/* Étape 2 : Choix du modèle selon retour de /models */}
            <ModelSelector
                models={models}
                selectedModelIds={[selectedModelId]}
                onSelectModel={(id) => setSelectedModelId(id)}
                multiSelect={false}
                title="2. Choisissez un modèle"
            />

            {/* Message d'erreur API si l'inférence échoue */}
            {errorMessage && (
                <div className="w-full p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
                    <svg
                        className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <div className="flex-1 text-left">
                        <p className="font-bold">
                            Erreur lors de l&apos;analyse
                        </p>
                        <p className="text-xs mt-0.5 whitespace-pre-line">
                            {errorMessage}
                        </p>
                    </div>
                </div>
            )}

            {/* Bouton principal "Analyser" avec suivi du temps d'attente */}
            <div className="mt-2 flex flex-col items-center gap-3 w-full">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={!hasFile || isLoading}
                        aria-busy={isLoading}
                        className={`px-12 py-3.5 rounded-2xl text-base font-bold shadow-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                            !hasFile || isLoading
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                : "bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 active:scale-95"
                        }`}
                    >
                        {isLoading ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5 text-gray-950"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span>
                                    Analyse en cours ({elapsedSeconds}s)...
                                </span>
                            </>
                        ) : (
                            "Analyser"
                        )}
                    </button>

                    {isLoading && (
                        <button
                            type="button"
                            onClick={handleCancelAnalysis}
                            className="px-4 py-3.5 rounded-2xl border border-gray-300 text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            Annuler
                        </button>
                    )}
                </div>

                {/* Message d'information pendant les inférences longues */}
                {isLoading && (
                    <div className="text-center text-xs text-gray-500 max-w-md animate-pulse">
                        Le modèle analyse l&apos;échantillon audio dans le
                        conteneur Docker. Le chargement des poids du réseau (3,7
                        Go) peut nécessiter entre 15 et 60 secondes selon les
                        performances de la machine.
                    </div>
                )}
            </div>
        </div>
    );
};
