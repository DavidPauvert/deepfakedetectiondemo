import { describe, it, expect } from "bun:test";
import {
    calculateAIPercentage,
    normalizeApiUrl,
    buildEndpointUrl,
    setApiBaseUrl,
    getApiBaseUrl,
} from "./api";
import type { PredictionResult } from "../types";

describe("API Service & URL Handling", () => {
    describe("calculateAIPercentage", () => {
        it("devrait calculer 67% pour une prédiction spoof avec 0.67 de confiance (Slide 2)", () => {
            const spoofResult: PredictionResult = {
                model_id: "wav2vec2_linear",
                filename: "blabla.m4a",
                prediction: "spoof",
                confidence: 0.67,
                raw_score: -0.708,
                inference_time_ms: 42.1,
                threshold_used: 0.0,
            };

            const percent = calculateAIPercentage(spoofResult);
            expect(percent).toBe(67);
        });

        it("devrait calculer 4% pour une prédiction bonafide avec 0.96 de confiance (Slide 3)", () => {
            const bonafideResult: PredictionResult = {
                model_id: "wav2vec2_linear",
                filename: "blabla.m4a",
                prediction: "bonafide",
                confidence: 0.96,
                raw_score: 3.178,
                inference_time_ms: 39.4,
                threshold_used: 0.0,
            };

            const percent = calculateAIPercentage(bonafideResult);
            expect(percent).toBe(4);
        });

        it("devrait borner le pourcentage entre 1% et 99%", () => {
            const extremeSpoof: PredictionResult = {
                model_id: "wav2vec2_linear",
                filename: "test.wav",
                prediction: "spoof",
                confidence: 1.0,
                raw_score: -10.0,
                inference_time_ms: 40.0,
                threshold_used: 0.0,
            };
            expect(calculateAIPercentage(extremeSpoof)).toBeLessThanOrEqual(99);
            expect(calculateAIPercentage(extremeSpoof)).toBeGreaterThanOrEqual(
                51,
            );

            const extremeBonafide: PredictionResult = {
                model_id: "wav2vec2_linear",
                filename: "test.wav",
                prediction: "bonafide",
                confidence: 1.0,
                raw_score: 10.0,
                inference_time_ms: 40.0,
                threshold_used: 0.0,
            };
            expect(
                calculateAIPercentage(extremeBonafide),
            ).toBeGreaterThanOrEqual(1);
            expect(calculateAIPercentage(extremeBonafide)).toBeLessThanOrEqual(
                49,
            );
        });
    });

    describe("normalizeApiUrl", () => {
        it("devrait ajouter http:// par défaut si le protocole est omis", () => {
            expect(normalizeApiUrl("192.168.1.50:8000")).toBe(
                "http://192.168.1.50:8000",
            );
        });

        it("devrait préserver https:// si présent", () => {
            expect(normalizeApiUrl("https://deepfake.srv.univ.fr")).toBe(
                "https://deepfake.srv.univ.fr",
            );
        });

        it("devrait retirer les slashes finaux et le suffixe /api éventuel", () => {
            expect(normalizeApiUrl("http://192.168.1.50:8000/")).toBe(
                "http://192.168.1.50:8000",
            );
            expect(normalizeApiUrl("http://192.168.1.50:8000/api")).toBe(
                "http://192.168.1.50:8000",
            );
            expect(normalizeApiUrl("http://192.168.1.50:8000/api/")).toBe(
                "http://192.168.1.50:8000",
            );
        });

        it("devrait retourner une chaîne vide si l'entrée est vide", () => {
            expect(normalizeApiUrl("   ")).toBe("");
        });
    });

    describe("buildEndpointUrl", () => {
        it("devrait concaténer proprement la base et le chemin", () => {
            setApiBaseUrl("http://192.168.1.50:8000");
            expect(buildEndpointUrl("/api/health")).toBe(
                "http://192.168.1.50:8000/api/health",
            );
            expect(buildEndpointUrl("api/predict")).toBe(
                "http://192.168.1.50:8000/api/predict",
            );
        });

        it("devrait accepter une URL de remplacement directe", () => {
            expect(
                buildEndpointUrl("/api/models", "http://autre-serveur:9000"),
            ).toBe("http://autre-serveur:9000/api/models");
        });
    });
});
