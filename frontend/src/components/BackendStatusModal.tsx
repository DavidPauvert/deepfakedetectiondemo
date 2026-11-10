import React, { useState } from "react";
import type { HealthResponse } from "../types";
import {
    getApiBaseUrl,
    setStoredApiUrl,
    normalizeApiUrl,
    checkBackendHealth,
    fetchModels,
} from "../services/api";

export interface BackendStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    health: HealthResponse | null;
    isBackendConnected: boolean;
    onRefreshHealth: () => void;
    onResetApiUrl?: () => void;
}

/**
 * Modal de diagnostic et configuration de l'adresse du serveur backend.
 * Permet de tester, modifier et sauvegarder l'adresse de l'API distante.
 */
export const BackendStatusModal: React.FC<BackendStatusModalProps> = ({
    isOpen,
    onClose,
    health,
    isBackendConnected,
    onRefreshHealth,
    onResetApiUrl,
}) => {
    const [apiUrl, setApiUrl] = useState<string>(getApiBaseUrl());
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [statusFeedback, setStatusFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    if (!isOpen) return null;

    const handleSaveAndTest = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const cleanUrl = normalizeApiUrl(apiUrl);

        if (!cleanUrl) {
            setStatusFeedback({
                type: "error",
                message: "Veuillez saisir une adresse valide.",
            });
            return;
        }

        setIsTesting(true);
        setStatusFeedback(null);

        try {
            await Promise.all([
                checkBackendHealth(cleanUrl),
                fetchModels(cleanUrl),
            ]);

            setStoredApiUrl(cleanUrl);
            setStatusFeedback({
                type: "success",
                message: "Connexion réussie ! Adresse enregistrée.",
            });
            onRefreshHealth();
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : String(err);
            setStatusFeedback({
                type: "error",
                message: errStr,
            });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <h3
                        id="modal-title"
                        className="text-xl font-bold text-gray-900"
                    >
                        Statut du Backend & Diagnostic
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer"
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Badges d'état du serveur */}
                <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                            Serveur FastAPI
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isBackendConnected
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                        >
                            {isBackendConnected ? "En ligne" : "Inaccessible"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                            Démon Docker
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                health?.docker_available
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                        >
                            {health?.docker_available
                                ? "Opérationnel"
                                : "Non disponible"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                            Accélération GPU NVIDIA
                        </span>
                        <span
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                                health?.gpu_available
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-200 text-gray-700"
                            }`}
                        >
                            {health?.gpu_available
                                ? "Actif (CUDA)"
                                : "Désactivé / Absent"}
                        </span>
                    </div>

                    {health?.details && (
                        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                            <strong>Info backend :</strong> {health.details}
                        </div>
                    )}
                </div>

                {/* Formulaire de modification de l'adresse du serveur */}
                <form onSubmit={handleSaveAndTest} className="mt-5">
                    <label
                        htmlFor="api-url-input"
                        className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                    >
                        Adresse de l&apos;API du serveur distant
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="api-url-input"
                            type="text"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            placeholder="http://127.0.0.1:8000 ou http://192.168.1.50:8000"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:border-cyan-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isTesting}
                            className="px-4 py-2 bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 font-bold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-50"
                        >
                            {isTesting ? "Test..." : "Appliquer"}
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Privilégiez{" "}
                        <code className="font-mono bg-gray-100 px-1 rounded">
                            127.0.0.1:8000
                        </code>{" "}
                        plutôt que{" "}
                        <code className="font-mono bg-gray-100 px-1 rounded">
                            localhost
                        </code>{" "}
                        pour contourner les blocages IPv6.
                    </p>

                    {statusFeedback && (
                        <p
                            className={`text-xs mt-2 font-medium p-2 rounded-lg ${
                                statusFeedback.type === "success"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                            }`}
                        >
                            {statusFeedback.message}
                        </p>
                    )}
                </form>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                    {onResetApiUrl && (
                        <button
                            type="button"
                            onClick={() => {
                                onResetApiUrl();
                                onClose();
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold underline cursor-pointer"
                        >
                            Déconnecter ce serveur
                        </button>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onRefreshHealth}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                        >
                            Rafraîchir
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
