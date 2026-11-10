import React from "react";
import type { ModelInfo } from "../types";

export interface ModelSelectorProps {
    /** Modèles retournés dynamiquement par l'appel à /models */
    models: ModelInfo[];
    /** IDs des modèles actuellement sélectionnés */
    selectedModelIds: string[];
    /** Gestionnaire de sélection */
    onSelectModel: (modelId: string) => void;
    /** Permet la sélection multiple (mode analyse par lot) */
    multiSelect?: boolean;
    /** Titre de la section */
    title?: string;
}

/**
 * Composant de sélection des modèles.
 * Adapte automatiquement les dimensions de la grille au nombre exact de modèles
 * retournés par l'endpoint /api/models du backend.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModelIds,
    onSelectModel,
    multiSelect = false,
    title = "2. Choisissez un modèle",
}) => {
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

                            return (
                                <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => onSelectModel(model.id)}
                                    aria-pressed={isSelected}
                                    className={`py-4 px-5 rounded-2xl text-center font-semibold text-sm transition-all duration-150 cursor-pointer flex flex-col items-center justify-center gap-1.5 shadow-xs ${
                                        isSelected
                                            ? "bg-[#4FE3E8] text-gray-950 ring-2 ring-cyan-400 font-bold scale-[1.01]"
                                            : "bg-[#E2E4E8] text-gray-700 hover:bg-[#D5D8DE] hover:text-gray-900"
                                    }`}
                                    title={model.description}
                                >
                                    {/* Nom du modèle issu du backend */}
                                    <span className="truncate max-w-full font-bold text-base">
                                        {model.name}
                                    </span>

                                    {/* Identifiant technique et description */}
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
                                        <span className="text-[11px] text-gray-600 font-normal">
                                            {model.image_built
                                                ? "Image Docker prête"
                                                : "Image non construite"}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
