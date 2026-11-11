/**
 * Règles de disponibilité des modèles pour l'analyse.
 *
 * Un modèle n'est analysable que si son image Docker a été construite.
 * Ces fonctions sont pures afin de pouvoir être testées sans rendu React.
 */

import type { ModelInfo } from "../types";

/**
 * Modèle sélectionné dont l'image Docker n'est pas disponible.
 */
export interface UnbuiltSelectedModel {
    /** Identifiant technique du modèle */
    id: string;
    /** Nom d'affichage, ou identifiant si le modèle est introuvable */
    name: string;
}

/**
 * Indique si un modèle existe dans la liste et possède une image Docker.
 */
export function isModelBuilt(
    models: ModelInfo[],
    modelId: string | null | undefined,
): boolean {
    if (!modelId) return false;
    return models.some((model) => model.id === modelId && model.image_built);
}

/**
 * Retourne les modèles sélectionnés qui ne sont pas prêts pour l'analyse.
 * Un identifiant absent de la liste est considéré comme non construit.
 */
export function getUnbuiltSelectedModels(
    models: ModelInfo[],
    selectedModelIds: string[],
): UnbuiltSelectedModel[] {
    const seen = new Set<string>();
    const unbuilt: UnbuiltSelectedModel[] = [];

    for (const modelId of selectedModelIds) {
        if (seen.has(modelId)) continue;
        seen.add(modelId);

        const model = models.find((item) => item.id === modelId);
        if (!model || !model.image_built) {
            unbuilt.push({
                id: modelId,
                name: model?.name || modelId,
            });
        }
    }

    return unbuilt;
}

/**
 * Retourne la raison empêchant une analyse simple, ou null si elle est permise.
 */
export function getSingleAnalysisBlockReason(
    models: ModelInfo[],
    selectedModelId: string | null | undefined,
    hasFile: boolean,
): string | null {
    if (!hasFile) {
        return "Ajoutez un fichier audio pour continuer.";
    }

    if (models.length === 0) {
        return "Aucun modèle n'est disponible dans le backend.";
    }

    if (
        !selectedModelId ||
        !models.some((model) => model.id === selectedModelId)
    ) {
        return "Sélectionnez un modèle.";
    }

    if (!isModelBuilt(models, selectedModelId)) {
        return "Construisez d'abord l'image Docker de ce modèle avant de lancer l'analyse.";
    }

    return null;
}

/**
 * Retourne la raison empêchant une analyse par lot, ou null si elle est permise.
 */
export function getBatchAnalysisBlockReason(
    models: ModelInfo[],
    selectedModelIds: string[],
    hasFiles: boolean,
): string | null {
    if (!hasFiles) {
        return "Ajoutez au moins un fichier audio pour continuer.";
    }

    if (selectedModelIds.length === 0) {
        return "Sélectionnez au moins un modèle.";
    }

    const unbuiltModels = getUnbuiltSelectedModels(models, selectedModelIds);
    if (unbuiltModels.length === 0) {
        return null;
    }

    const names = unbuiltModels.map((model) => model.name).join(", ");

    if (unbuiltModels.length === 1) {
        return `Construisez d'abord l'image Docker du modèle sélectionné : ${names}.`;
    }

    return `Construisez d'abord les images Docker des modèles sélectionnés : ${names}.`;
}
