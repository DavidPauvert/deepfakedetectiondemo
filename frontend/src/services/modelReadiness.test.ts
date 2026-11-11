import { describe, it, expect } from "bun:test";
import type { ModelInfo } from "../types";
import {
    getBatchAnalysisBlockReason,
    getSingleAnalysisBlockReason,
    getUnbuiltSelectedModels,
    isModelBuilt,
} from "./modelReadiness";

function makeModel(id: string, imageBuilt: boolean): ModelInfo {
    return {
        id,
        name: `Modèle ${id}`,
        description: "",
        image_tag: `${id}:latest`,
        image_built: imageBuilt,
        default_threshold: 0,
    };
}

const builtModel = makeModel("built", true);
const unbuiltModel = makeModel("unbuilt", false);
const models = [builtModel, unbuiltModel];

describe("modelReadiness", () => {
    describe("isModelBuilt", () => {
        it("devrait reconnaître un modèle construit", () => {
            expect(isModelBuilt(models, "built")).toBe(true);
        });

        it("devrait refuser un modèle non construit, absent ou vide", () => {
            expect(isModelBuilt(models, "unbuilt")).toBe(false);
            expect(isModelBuilt(models, "missing")).toBe(false);
            expect(isModelBuilt(models, null)).toBe(false);
            expect(isModelBuilt(models, "")).toBe(false);
        });
    });

    describe("getUnbuiltSelectedModels", () => {
        it("devrait retourner uniquement les modèles non construits", () => {
            const result = getUnbuiltSelectedModels(models, [
                "built",
                "unbuilt",
            ]);

            expect(result).toEqual([{ id: "unbuilt", name: "Modèle unbuilt" }]);
        });

        it("devrait considérer un modèle absent comme non construit", () => {
            const result = getUnbuiltSelectedModels(models, ["missing"]);

            expect(result).toEqual([{ id: "missing", name: "missing" }]);
        });

        it("devrait dédupliquer les identifiants", () => {
            const result = getUnbuiltSelectedModels(models, [
                "unbuilt",
                "unbuilt",
            ]);

            expect(result).toHaveLength(1);
        });
    });

    describe("getSingleAnalysisBlockReason", () => {
        it("devrait bloquer sans fichier audio", () => {
            expect(getSingleAnalysisBlockReason(models, "built", false)).toBe(
                "Ajoutez un fichier audio pour continuer.",
            );
        });

        it("devrait bloquer sans modèle sélectionné", () => {
            expect(getSingleAnalysisBlockReason(models, "", true)).toBe(
                "Sélectionnez un modèle.",
            );
        });

        it("devrait bloquer si le modèle sélectionné n'existe plus", () => {
            expect(getSingleAnalysisBlockReason(models, "missing", true)).toBe(
                "Sélectionnez un modèle.",
            );
        });

        it("devrait bloquer si aucun modèle n'est disponible", () => {
            expect(getSingleAnalysisBlockReason([], "built", true)).toBe(
                "Aucun modèle n'est disponible dans le backend.",
            );
        });

        it("devrait bloquer si le modèle n'est pas construit", () => {
            expect(getSingleAnalysisBlockReason(models, "unbuilt", true)).toBe(
                "Construisez d'abord l'image Docker de ce modèle avant de lancer l'analyse.",
            );
        });

        it("devrait autoriser l'analyse si tout est prêt", () => {
            expect(
                getSingleAnalysisBlockReason(models, "built", true),
            ).toBeNull();
        });
    });

    describe("getBatchAnalysisBlockReason", () => {
        it("devrait bloquer sans fichier audio", () => {
            expect(getBatchAnalysisBlockReason(models, ["built"], false)).toBe(
                "Ajoutez au moins un fichier audio pour continuer.",
            );
        });

        it("devrait bloquer sans modèle sélectionné", () => {
            expect(getBatchAnalysisBlockReason(models, [], true)).toBe(
                "Sélectionnez au moins un modèle.",
            );
        });

        it("devrait bloquer si un seul modèle sélectionné n'est pas construit", () => {
            expect(
                getBatchAnalysisBlockReason(models, ["built", "unbuilt"], true),
            ).toBe(
                "Construisez d'abord l'image Docker du modèle sélectionné : Modèle unbuilt.",
            );
        });

        it("devrait bloquer avec un message pluriel pour plusieurs modèles", () => {
            expect(
                getBatchAnalysisBlockReason(
                    models,
                    ["unbuilt", "missing"],
                    true,
                ),
            ).toBe(
                "Construisez d'abord les images Docker des modèles sélectionnés : Modèle unbuilt, missing.",
            );
        });

        it("devrait autoriser l'analyse si tous les modèles sont construits", () => {
            expect(
                getBatchAnalysisBlockReason(models, ["built"], true),
            ).toBeNull();
        });
    });
});
