import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import type { HealthResponse, ModelInfo, ViewMode } from "./types";
import {
    checkBackendHealth,
    fetchModels,
    getStoredApiUrl,
    setStoredApiUrl,
} from "./services/api";
import { Header } from "./components/Header";
import { ApiSetupView } from "./components/ApiSetupView";
import { SingleAnalysisView } from "./components/SingleAnalysisView";
import { BatchAnalysisView } from "./components/BatchAnalysisView";
import { BackendStatusModal } from "./components/BackendStatusModal";

/**
 * Composant racine de l'application.
 * Demande l'adresse du serveur backend à l'utilisateur au démarrage,
 * teste la connectivité et affiche l'interface d'analyse de deepfakes.
 */
export function App() {
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [currentApiUrl, setCurrentApiUrl] =
        useState<string>(getStoredApiUrl());
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [defaultModelId, setDefaultModelId] =
        useState<string>("wav2vec2_linear");
    const [isBackendConnected, setIsBackendConnected] =
        useState<boolean>(false);
    const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(
        Boolean(getStoredApiUrl()),
    );
    const [isSettingsModalOpen, setIsSettingsModalOpen] =
        useState<boolean>(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isChangingServer, setIsChangingServer] = useState<boolean>(false);

    // Teste la connectivité vers l'adresse d'API enregistrée
    const checkCurrentServer = useCallback(
        async (targetUrl?: string) => {
            const url = targetUrl ?? currentApiUrl;
            if (!url) {
                setIsCheckingConnection(false);
                setIsBackendConnected(false);
                return;
            }

            setIsCheckingConnection(true);
            setConnectionError(null);

            try {
                const [healthData, modelsData] = await Promise.all([
                    checkBackendHealth(url),
                    fetchModels(url),
                ]);

                setHealth(healthData);
                setModels(modelsData.models || []);
                setDefaultModelId(
                    modelsData.default_model_id || "wav2vec2_linear",
                );
                setIsBackendConnected(true);
                setIsChangingServer(false);
            } catch (err: unknown) {
                setIsBackendConnected(false);
                setHealth(null);
                setModels([]);
                const errMessage =
                    err instanceof Error ? err.message : String(err);
                setConnectionError(errMessage);
            } finally {
                setIsCheckingConnection(false);
            }
        },
        [currentApiUrl],
    );

    useEffect(() => {
        if (currentApiUrl) {
            void checkCurrentServer(currentApiUrl);
        }
    }, [currentApiUrl, checkCurrentServer]);

    // Callback lorsque l'utilisateur valide l'adresse du serveur sur l'écran d'accueil
    const handleServerConnected = (
        newUrl: string,
        healthData: HealthResponse,
        loadedModels: ModelInfo[],
    ) => {
        setCurrentApiUrl(newUrl);
        setHealth(healthData);
        setModels(loadedModels);
        setIsBackendConnected(true);
        setIsChangingServer(false);
        setConnectionError(null);
    };

    // Réinitialise l'adresse pour en demander une nouvelle
    const handleResetServer = () => {
        setStoredApiUrl("");
        setCurrentApiUrl("");
        setIsBackendConnected(false);
        setHealth(null);
        setModels([]);
        setIsChangingServer(true);
    };

    // Rendu du contenu principal selon l'état de connexion et le mode actif
    const renderMainContent = () => {
        // Cas 1 : Aucune adresse de serveur renseignée ou changement demandé
        if (!currentApiUrl || isChangingServer) {
            return (
                <ApiSetupView
                    initialUrl={currentApiUrl}
                    onConnected={handleServerConnected}
                    onCancel={
                        currentApiUrl
                            ? () => setIsChangingServer(false)
                            : undefined
                    }
                />
            );
        }

        // Cas 2 : Test de connexion en cours
        if (isCheckingConnection) {
            return (
                <div className="w-full max-w-md mx-auto py-16 text-center flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <svg
                        className="animate-spin h-10 w-10 text-cyan-500"
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
                    <p className="text-gray-700 font-medium text-sm">
                        Connexion au serveur{" "}
                        <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {currentApiUrl}
                        </code>
                        ...
                    </p>
                </div>
            );
        }

        // Cas 3 : Serveur configuré mais injoignable
        if (!isBackendConnected) {
            return (
                <div className="w-full max-w-2xl mx-auto py-8 animate-fade-in">
                    <div className="w-full bg-white rounded-3xl border-2 border-gray-300 p-8 sm:p-10 shadow-xs text-center flex flex-col items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-500">
                            <svg
                                className="w-10 h-10"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                Serveur distant injoignable
                            </h2>
                            <p className="text-gray-600 text-sm mt-2 max-w-lg mx-auto">
                                Impossible de contacter le serveur à
                                l&apos;adresse{" "}
                                <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs text-gray-800">
                                    {currentApiUrl}
                                </code>
                                .
                            </p>
                            {connectionError && (
                                <p className="text-xs text-red-600 font-mono mt-3 bg-red-50 p-3 rounded-xl border border-red-100 max-w-lg mx-auto break-all text-left">
                                    {connectionError}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => checkCurrentServer()}
                                className="w-full sm:w-auto px-6 py-3.5 bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 font-bold rounded-2xl shadow-xs transition-all duration-150 active:scale-95 cursor-pointer text-sm"
                            >
                                Réessayer la connexion
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsChangingServer(true)}
                                className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-2xl border border-gray-300 transition-all duration-150 active:scale-95 cursor-pointer text-sm"
                            >
                                Modifier l&apos;adresse du serveur
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // Cas 4 : Application opérationnelle (Analyse simple ou Analyse par lot)
        if (viewMode === "single") {
            return (
                <SingleAnalysisView
                    models={models}
                    defaultModelId={defaultModelId}
                />
            );
        }

        return (
            <BatchAnalysisView
                models={models}
                defaultModelId={defaultModelId}
            />
        );
    };

    return (
        <div className="min-h-screen bg-[#FBFBFB] flex flex-col text-gray-900 font-sans antialiased">
            {/* Bandeau d'en-tête supérieur "Deepfake Detector" */}
            <Header
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                health={health}
                isBackendConnected={isBackendConnected}
                currentApiUrl={currentApiUrl}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
            />

            {/* Contenu principal */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
                {renderMainContent()}
            </main>

            {/* Pied de page */}
            <footer className="w-full border-t border-gray-200 py-6 text-center text-xs text-gray-500">
                <p>
                    Deepfake Detector — Détection de Deepfakes Audio
                    Multi-Modèles
                </p>
            </footer>

            {/* Modal de statut et diagnostic du backend */}
            <BackendStatusModal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                health={health}
                isBackendConnected={isBackendConnected}
                onRefreshHealth={() => checkCurrentServer()}
                onResetApiUrl={handleResetServer}
            />
        </div>
    );
}

export default App;
