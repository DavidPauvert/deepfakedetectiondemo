import React, { useEffect, useState } from "react";
import type { ModelBuildStates, ModelInfo } from "../types";

export interface ModelSelectorProps {
    /** Modèles retournés dynamiquement par l'appel à /models */
    models: ModelInfo[];
    /** IDs des modèles actuellement sélectionnés */
    selectedModelIds: string[];
    /** Gestionnaire de sélection */
    onSelectModel: (modelId: string) => void;
    /** États des builds Docker, indexés par identifiant de modèle */
    modelBuildStates: ModelBuildStates;
    /** Déclenche la construction ou reconstruction d'un modèle */
    onBuildModel: (modelId: string) => void;
    /** Permet la sélection multiple (mode analyse par lot) */
    multiSelect?: boolean;
    /** Titre de la section */
    title?: string;
}

/**
 * Composant de sélection des modèles.
 * Affiche pour chaque modèle un bouton de construction/reconstruction Docker.
 * Adapte automatiquement les dimensions de la grille au nombre exact de modèles
 * retournés par l'endpoint /api/models du backend.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModelIds,
    onSelectModel,
    modelBuildStates,
    onBuildModel,
    multiSelect = false,
    title = "2. Choisissez un modèle",
}) => {
    // Horloge partagée pour afficher le temps écoulé des builds en cours
    const [now, setNow] = useState<number>(() => Date.now());
    const hasRunningBuild = Object.values(modelBuildStates).some(
        (state) => state.status === "building",
    );

    useEffect(() => {
        if (!hasRunningBuild) return;

        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [hasRunningBuild]);

    // Calcule dynamiquement les classes CSS de grille selon le nombre de modèles
    const getGridColsClass = (count: number): string => {
        switch (count) {
            case 0:
                return "grid-cols-1";
            case 1:
                return "grid-cols-1 max-w-md mx-auto";
            case 2:
                return "grid-cols-1 sm:grid-cols-2";
            case 3:
                return "grid-cols-1 sm:grid-cols-3";
            case 4:
                return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
            default:
                return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
        }
    };

    return (
        <div className="w-full">
            {/* En-tête de section */}
            {title && (
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900 text-left">
                        {title}
                    </h2>
                    {multiSelect && (
                        <span className="text-xs text-gray-500 font-medium">
                            Sélection multiple possible
                        </span>
                    )}
                </div>
            )}

            {/* Carte conteneur à bordure arrondie */}
            <div className="w-full rounded-3xl border-2 border-gray-300 bg-white p-6 shadow-xs">
                {models.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                        Aucun modèle n&apos;est enregistré dans le backend pour
                        le moment.
                    </div>
                ) : (
                    <div
                        className={`grid ${getGridColsClass(models.length)} gap-4`}
                    >
                        {models.map((model) => {
                            const isSelected = selectedModelIds.includes(
                                model.id,
                            );
                            const buildState = modelBuildStates[model.id];
                            const isBuilding =
                                buildState?.status === "building";
                            const elapsedSeconds =
                                isBuilding && buildState?.startedAt
                                    ? Math.max(
                                          0,
                                          Math.floor(
                                              (now - buildState.startedAt) /
                                                  1000,
                                          ),
                                      )
                                    : 0;

                            const buildButtonLabel = isBuilding
                                ? `Construction en cours…${
                                      elapsedSeconds > 0
                                          ? ` (${elapsedSeconds}s)`
                                          : ""
                                  }`
                                : buildState?.status === "error"
                                  ? "Réessayer la construction"
                                  : model.image_built
                                    ? "Reconstruire l'image"
                                    : "Construire l'image";

                            const buildButtonClass = isBuilding
                                ? "bg-gray-200 text-gray-500 cursor-wait"
                                : buildState?.status === "error"
                                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                                  : model.image_built
                                    ? "bg-white/70 text-gray-700 border border-gray-300 hover:bg-white"
                                    : "bg-gray-900 text-white hover:bg-gray-800";

                            return (
                                <div
                                    key={model.id}
                                    className={`rounded-2xl text-center text-sm transition-all duration-150 flex flex-col shadow-xs ${
                                        isSelected
                                            ? "bg-[#4FE3E8] text-gray-950 ring-2 ring-cyan-400 scale-[1.01]"
                                            : "bg-[#E2E4E8] text-gray-700 hover:bg-[#D5D8DE]"
                                    }`}
                                >
                                    {/* Sélection du modèle */}
                                    <button
                                        type="button"
                                        onClick={() => onSelectModel(model.id)}
                                        aria-pressed={isSelected}
                                        className="py-4 px-5 rounded-t-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/40 focus-visible:ring-inset"
                                        title={model.description}
                                    >
                                        {/* Nom du modèle issu du backend */}
                                        <span className="truncate max-w-full font-bold text-base">
                                            {model.name}
                                        </span>

                                        {/* Identifiant technique */}
                                        <span
                                            className={`text-xs truncate max-w-full ${
                                                isSelected
                                                    ? "text-gray-900/80"
                                                    : "text-gray-500"
                                            }`}
                                        >
                                            ID : {model.id}
                                        </span>

                                        {/* Statut de construction Docker */}
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span
                                                className={`w-2 h-2 rounded-full ${
                                                    model.image_built
                                                        ? "bg-emerald-500"
                                                        : "bg-amber-500"
                                                }`}
                                            />
                                            <span
                                                className={`text-[11px] font-normal ${
                                                    isSelected
                                                        ? "text-gray-900/80"
                                                        : "text-gray-600"
                                                }`}
                                            >
                                                {model.image_built
                                                    ? "Image Docker prête"
                                                    : "Image non construite"}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Construction / reconstruction de l'image */}
                                    <div
                                        className="px-4 pb-4 flex flex-col gap-2"
                                        aria-live="polite"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onBuildModel(model.id)
                                            }
                                            disabled={isBuilding}
                                            aria-busy={isBuilding}
                                            aria-label={`${buildButtonLabel} : ${model.name}`}
                                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-wait ${buildButtonClass}`}
                                        >
                                            {isBuilding && (
                                                <svg
                                                    className="animate-spin h-3.5 w-3.5 text-current"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    aria-hidden="true"
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
                                            )}
                                            <span className="truncate max-w-full">
                                                {buildButtonLabel}
                                            </span>
                                        </button>

                                        {buildState?.status === "success" && (
                                            <p className="text-[11px] leading-snug font-medium text-emerald-700 text-left">
                                                Image construite avec succès.
                                            </p>
                                        )}

                                        {buildState?.status === "error" &&
                                            buildState.error && (
                                                <p
                                                    className="text-[11px] leading-snug text-red-700 bg-red-50/90 border border-red-200 rounded-xl px-2 py-1 text-left line-clamp-2 break-words whitespace-pre-line"
                                                    title={buildState.error}
                                                >
                                                    {buildState.error}
                                                </p>
                                            )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
