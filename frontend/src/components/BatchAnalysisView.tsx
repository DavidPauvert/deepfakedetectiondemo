import React, {
    useState,
    useCallback,
    useMemo,
    useEffect,
    useRef,
} from "react";
import type {
    UploadedAudioFile,
    ModelBuildStates,
    ModelInfo,
    PredictionResult,
} from "../types";
import { AudioUploader } from "./AudioUploader";
import { ModelSelector } from "./ModelSelector";
import { AudioPlayer } from "./AudioPlayer";
import { GaugeMeter } from "./GaugeMeter";
import { analyzeBatchAudio, calculateAIPercentage } from "../services/api";
import { getBatchAnalysisBlockReason } from "../services/modelReadiness";

export interface BatchAnalysisViewProps {
    /** Modèles disponibles retournés par le backend */
    models: ModelInfo[];
    /** ID du modèle sélectionné par défaut */
    defaultModelId: string;
    /** États des builds Docker, indexés par identifiant de modèle */
    modelBuildStates: ModelBuildStates;
    /** Déclenche la construction ou reconstruction d'un modèle */
    onBuildModel: (modelId: string) => void;
}

/**
 * Vue d'analyse par lot multi-fichiers et multi-modèles
 * Exécute les requêtes réelles auprès de /api/predict/batch pour chaque modèle sélectionné.
 * Gère les temps de réponse longs avec timer et annulation propre.
 */
export const BatchAnalysisView: React.FC<BatchAnalysisViewProps> = ({
    models,
    defaultModelId,
    modelBuildStates,
    onBuildModel,
}) => {
    // Liste des fichiers téléversés
    const [uploadedFiles, setUploadedFiles] = useState<UploadedAudioFile[]>([]);
    // IDs des modèles sélectionnés (sélection multiple)
    const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
    // États de l'analyse
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [batchResults, setBatchResults] = useState<PredictionResult[]>([]);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Contrôleur d'annulation
    const abortControllerRef = useRef<AbortController | null>(null);

    // Filtre d'affichage
    const [statusFilter, setStatusFilter] = useState<
        "all" | "spoof" | "bonafide"
    >("all");

    // Chronomètre pendant l'analyse par lot
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

    // Nettoyage au démontage
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Initialise les modèles sélectionnés dès que la liste des modèles est disponible
    useEffect(() => {
        if (models.length > 0 && selectedModelIds.length === 0) {
            const initialId = models.some((m) => m.id === defaultModelId)
                ? defaultModelId
                : models[0]!.id;
            setSelectedModelIds([initialId]);
        }
    }, [models, defaultModelId, selectedModelIds.length]);

    // Ajout de fichiers
    const handleFilesAdded = useCallback((newFiles: File[]) => {
        const items: UploadedAudioFile[] = newFiles.map((file) => ({
            id: `${Date.now()}-${Math.random()}-${file.name}`,
            file,
            name: file.name,
            size: file.size,
            objectUrl: URL.createObjectURL(file),
        }));

        setUploadedFiles((prev) => [...prev, ...items]);
        setBatchResults([]);
        setErrorMessage(null);
    }, []);

    // Suppression d'un fichier
    const handleFileRemoved = useCallback((id: string) => {
        setUploadedFiles((prev) => {
            const target = prev.find((f) => f.id === id);
            if (target) {
                URL.revokeObjectURL(target.objectUrl);
            }
            return prev.filter((f) => f.id !== id);
        });
    }, []);

    // Sélection / désélection d'un modèle
    const handleToggleModel = useCallback((modelId: string) => {
        setSelectedModelIds((prev) => {
            if (prev.includes(modelId)) {
                return prev.length > 1
                    ? prev.filter((id) => id !== modelId)
                    : prev;
            }
            return [...prev, modelId];
        });
    }, []);

    // Lancement du traitement par lot réel
    const handleRunBatch = useCallback(async () => {
        const blockReason = getBatchAnalysisBlockReason(
            models,
            selectedModelIds,
            uploadedFiles.length > 0,
        );
        if (blockReason) {
            setErrorMessage(blockReason);
            return;
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setProgressPercent(5);
        setErrorMessage(null);
        setBatchResults([]);

        const aggregatedResults: PredictionResult[] = [];
        const nativeFiles = uploadedFiles.map((item) => item.file);
        const totalSteps = selectedModelIds.length;

        try {
            for (let i = 0; i < totalSteps; i++) {
                const mId = selectedModelIds[i]!;
                const batchResp = await analyzeBatchAudio(
                    nativeFiles,
                    mId,
                    undefined,
                    controller.signal,
                );
                aggregatedResults.push(...batchResp.results);
                setProgressPercent(Math.round(((i + 1) / totalSteps) * 100));
            }

            setBatchResults(aggregatedResults);
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : String(err);
            setErrorMessage(`Erreur lors du traitement par lot : ${errStr}`);
        } finally {
            setIsLoading(false);
            setProgressPercent(0);
            abortControllerRef.current = null;
        }
    }, [uploadedFiles, selectedModelIds, models]);

    // Annuler le traitement par lot en cours
    const handleCancelBatch = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }
    }, []);

    // Réinitialisation
    const handleReset = useCallback(() => {
        uploadedFiles.forEach((f) => URL.revokeObjectURL(f.objectUrl));
        setUploadedFiles([]);
        setBatchResults([]);
        setErrorMessage(null);
    }, [uploadedFiles]);

    // Calcul des statistiques de synthèse
    const stats = useMemo(() => {
        if (batchResults.length === 0) return null;
        const total = batchResults.length;
        const spoofs = batchResults.filter(
            (r) => r.prediction === "spoof",
        ).length;
        const bonafides = total - spoofs;
        const totalLatency = batchResults.reduce(
            (acc, r) => acc + r.inference_time_ms,
            0,
        );

        return {
            total,
            spoofs,
            bonafides,
            spoofPercent: Math.round((spoofs / total) * 100),
            totalLatency: totalLatency.toFixed(1),
        };
    }, [batchResults]);

    // Filtrage des résultats
    const filteredResults = useMemo(() => {
        if (statusFilter === "all") return batchResults;
        return batchResults.filter((r) => r.prediction === statusFilter);
    }, [batchResults, statusFilter]);

    // Raison du blocage du bouton d'analyse par lot bordel
    const batchAnalysisBlockReason = useMemo(
        () =>
            getBatchAnalysisBlockReason(
                models,
                selectedModelIds,
                uploadedFiles.length > 0,
            ),
        [models, selectedModelIds, uploadedFiles.length],
    );
    const isBatchAnalyzeDisabled =
        batchAnalysisBlockReason !== null || isLoading;

    // Export CSV
    const exportCSV = useCallback(() => {
        if (batchResults.length === 0) return;
        const headers = [
            "Fichier",
            "Modele",
            "Prediction",
            "Probabilite_IA_Pourcentage",
            "Confiance",
            "Score_Brut",
            "Temps_Inference_ms",
        ];
        const rows = batchResults.map((r) => [
            `"${r.filename}"`,
            `"${r.model_id}"`,
            `"${r.prediction}"`,
            calculateAIPercentage(r),
            r.confidence,
            r.raw_score,
            r.inference_time_ms,
        ]);
        const csvContent = [
            headers.join(","),
            ...rows.map((e) => e.join(",")),
        ].join("\n");
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `deepfake_batch_results_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }, [batchResults]);

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-8 py-2">
            {/* Configuration en 2 colonnes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Colonne gauche : multi-fichiers */}
                <div className="flex flex-col gap-4">
                    <AudioUploader
                        files={uploadedFiles}
                        onFilesAdded={handleFilesAdded}
                        onFileRemoved={handleFileRemoved}
                        multiple={true}
                        title="1. Fichiers audio à analyser par lot"
                    />
                </div>

                {/* Colonne droite : sélection des modèles retournés par /models + bouton Analyser */}
                <div className="flex flex-col gap-6">
                    <ModelSelector
                        models={models}
                        selectedModelIds={selectedModelIds}
                        onSelectModel={handleToggleModel}
                        modelBuildStates={modelBuildStates}
                        onBuildModel={onBuildModel}
                        multiSelect={true}
                        title="2. Sélectionnez les modèles à évaluer"
                    />

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <button
                            type="button"
                            onClick={handleRunBatch}
                            disabled={isBatchAnalyzeDisabled}
                            className={`w-full py-4 px-8 rounded-2xl font-bold text-base shadow-xs transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer ${
                                isBatchAnalyzeDisabled
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 active:scale-98"
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
                                        Traitement en cours ({elapsedSeconds}s —{" "}
                                        {progressPercent}%)...
                                    </span>
                                </>
                            ) : (
                                `Analyser (${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} × ${selectedModelIds.length} modèle${selectedModelIds.length > 1 ? "s" : ""})`
                            )}
                        </button>

                        {isLoading && (
                            <button
                                type="button"
                                onClick={handleCancelBatch}
                                className="w-full sm:w-auto px-5 py-4 rounded-2xl border border-gray-300 text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                        )}

                        {batchResults.length > 0 && !isLoading && (
                            <button
                                type="button"
                                onClick={handleReset}
                                className="w-full sm:w-auto px-5 py-4 rounded-2xl border-2 border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-sm transition-colors cursor-pointer"
                            >
                                Réinitialiser
                            </button>
                        )}
                    </div>

                    {/* Raison du blocage du bouton Analyser */}
                    {!isLoading && batchAnalysisBlockReason && (
                        <p
                            className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                            role="status"
                        >
                            {batchAnalysisBlockReason}
                        </p>
                    )}
                </div>
            </div>

            {/* Barre de progression pendant l'inférence */}
            {isLoading && (
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="bg-[#4FE3E8] h-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            )}

            {/* Alerte d'erreur API si l'un des modèles échoue */}
            {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm">
                    {errorMessage}
                </div>
            )}

            {/* Tableau de bord des résultats */}
            {batchResults.length > 0 && stats && (
                <div className="w-full flex flex-col gap-6 pt-4 border-t border-gray-200 animate-fade-in">
                    {/* Cartes de métriques globales */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-3xl border-2 border-gray-200 shadow-xs text-center">
                            <span className="text-xs uppercase font-bold text-gray-500">
                                Inférences Réalisées
                            </span>
                            <p className="text-3xl font-extrabold text-gray-900 mt-1">
                                {stats.total}
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl border-2 border-red-200 shadow-xs text-center">
                            <span className="text-xs uppercase font-bold text-red-600">
                                Deepfakes (IA)
                            </span>
                            <p className="text-3xl font-extrabold text-red-600 mt-1">
                                {stats.spoofs}
                                <span className="text-sm font-semibold ml-1 text-red-400">
                                    ({stats.spoofPercent}%)
                                </span>
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl border-2 border-emerald-200 shadow-xs text-center">
                            <span className="text-xs uppercase font-bold text-emerald-600">
                                Authentiques
                            </span>
                            <p className="text-3xl font-extrabold text-emerald-600 mt-1">
                                {stats.bonafides}
                                <span className="text-sm font-semibold ml-1 text-emerald-400">
                                    ({100 - stats.spoofPercent}%)
                                </span>
                            </p>
                        </div>

                        <div className="bg-white p-4 rounded-3xl border-2 border-gray-200 shadow-xs text-center">
                            <span className="text-xs uppercase font-bold text-gray-500">
                                Temps Total
                            </span>
                            <p className="text-3xl font-extrabold text-gray-900 mt-1">
                                {stats.totalLatency}
                                <span className="text-xs font-semibold ml-1 text-gray-400">
                                    ms
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Barre de filtrage et export CSV */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-600">
                                Filtrer :
                            </span>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                    statusFilter === "all"
                                        ? "bg-gray-900 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                            >
                                Tous ({stats.total})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("spoof")}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                    statusFilter === "spoof"
                                        ? "bg-red-600 text-white"
                                        : "bg-red-50 text-red-700 hover:bg-red-100"
                                }`}
                            >
                                IA Détectée ({stats.spoofs})
                            </button>
                            <button
                                type="button"
                                onClick={() => setStatusFilter("bonafide")}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                    statusFilter === "bonafide"
                                        ? "bg-emerald-600 text-white"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                Authentique ({stats.bonafides})
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={exportCSV}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                            <svg
                                className="w-4 h-4 text-gray-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                />
                            </svg>
                            <span>Exporter CSV</span>
                        </button>
                    </div>

                    {/* Grille de jauges semi-circulaires */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredResults.map((result, idx) => {
                            const aiPercentage = calculateAIPercentage(result);
                            const isSpoof = result.prediction === "spoof";
                            const modelObj = models.find(
                                (m) => m.id === result.model_id,
                            );
                            const fileObj = uploadedFiles.find(
                                (f) => f.name === result.filename,
                            );

                            return (
                                <div
                                    key={`${result.filename}-${result.model_id}-${idx}`}
                                    className="bg-white rounded-3xl border-2 border-gray-200 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                                >
                                    {/* Prévisualisation audio */}
                                    {fileObj ? (
                                        <AudioPlayer
                                            src={fileObj.objectUrl}
                                            filename={result.filename}
                                            compact={true}
                                        />
                                    ) : (
                                        <div className="text-sm font-bold text-gray-800 truncate mb-2">
                                            {result.filename}
                                        </div>
                                    )}

                                    {/* Jauge semi-circulaire */}
                                    <div className="my-2">
                                        <GaugeMeter
                                            percentage={aiPercentage}
                                            size="small"
                                            showDescription={true}
                                            verdictLabel={
                                                isSpoof
                                                    ? "Probablement de l’IA !"
                                                    : "Probablement pas de l’IA !"
                                            }
                                        />
                                    </div>

                                    {/* Métadonnées du résultat */}
                                    <div className="mt-2 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                        <span className="font-semibold text-gray-700 truncate max-w-[140px]">
                                            {modelObj?.name || result.model_id}
                                        </span>
                                        <span className="font-mono text-gray-400">
                                            {result.inference_time_ms.toFixed(
                                                0,
                                            )}{" "}
                                            ms
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
