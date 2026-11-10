import React from "react";
import type { HealthResponse, ViewMode } from "../types";

export interface HeaderProps {
    /** Mode d'affichage courant */
    viewMode: ViewMode;
    /** Gestionnaire de changement de mode */
    onViewModeChange: (mode: ViewMode) => void;
    /** État de santé du backend */
    health: HealthResponse | null;
    /** Indique si le backend est joignable */
    isBackendConnected: boolean;
    /** Adresse actuelle du backend */
    currentApiUrl: string;
    /** Ouvre le modal de diagnostic et statut du backend */
    onOpenSettings: () => void;
}

/**
 * Bandeau d'en-tête supérieur "Deepfake Detector".
 * Permet la navigation entre modes, affiche l'adresse du serveur configuré,
 * et donne accès au panneau de diagnostic et changement d'adresse.
 */
export const Header: React.FC<HeaderProps> = ({
    viewMode,
    onViewModeChange,
    health,
    isBackendConnected,
    currentApiUrl,
    onOpenSettings,
}) => {
    // Formatage concis de l'URL pour l'affichage dans le bandeau
    const displayHost = currentApiUrl
        ? currentApiUrl.replace(/^https?:\/\//, "")
        : "Non configuré";

    return (
        <header className="w-full bg-[#FFF4D0] border-b border-amber-200/60 px-6 py-4 shadow-xs sticky top-0 z-30">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Titre "Deepfake Detector" */}
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                        Deepfake Detector
                    </h1>
                </div>

                {/* Contrôles et statut */}
                <div className="flex items-center gap-3 flex-wrap justify-center">
                    {/* Bascule : Analyse unique vs Analyse par lot */}
                    <div className="flex items-center bg-amber-100/70 p-1 rounded-2xl border border-amber-300/60 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => onViewModeChange("single")}
                            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                                viewMode === "single"
                                    ? "bg-white text-gray-900 shadow-xs font-bold"
                                    : "text-gray-700 hover:text-gray-950"
                            }`}
                        >
                            Analyse unique
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewModeChange("batch")}
                            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                                viewMode === "batch"
                                    ? "bg-white text-gray-900 shadow-xs font-bold"
                                    : "text-gray-700 hover:text-gray-950"
                            }`}
                        >
                            Analyse par lot (Batch)
                        </button>
                    </div>

                    {/* Badge Serveur & Statut de connexion */}
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-medium text-gray-800 border border-amber-200 transition-colors cursor-pointer shadow-xs"
                        title="Cliquer pour voir le statut du backend et modifier l'adresse du serveur"
                    >
                        <span
                            className={`w-2 h-2 rounded-full ${
                                isBackendConnected
                                    ? health?.docker_available
                                        ? "bg-emerald-500"
                                        : "bg-amber-500"
                                    : "bg-red-500"
                            }`}
                        />
                        <span className="font-mono text-gray-600 truncate max-w-[150px]">
                            {displayHost}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="font-bold">
                            {isBackendConnected
                                ? health?.docker_available
                                    ? "En ligne"
                                    : "Docker requis"
                                : "Inaccessible"}
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
};
