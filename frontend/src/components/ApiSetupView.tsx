import React, { useState } from "react";
import type { HealthResponse, ModelInfo } from "../types";
import {
    normalizeApiUrl,
    setStoredApiUrl,
    checkBackendHealth,
    fetchModels,
} from "../services/api";

export interface ApiSetupViewProps {
    /** Callback exécuté lorsque la connexion avec le serveur est validée */
    onConnected: (
        apiUrl: string,
        health: HealthResponse,
        models: ModelInfo[],
    ) => void;
    /** Adresse initiale pré-remplie (si déjà configurée précédemment) */
    initialUrl?: string;
    /** Permet d'annuler si appelé depuis un changement manuel */
    onCancel?: () => void;
}

/**
 * Écran d'accueil invitant l'utilisateur à renseigner l'adresse du serveur backend.
 */
export const ApiSetupView: React.FC<ApiSetupViewProps> = ({
    onConnected,
    initialUrl = "",
    onCancel,
}) => {
    const [urlInput, setUrlInput] = useState<string>(initialUrl);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        const cleanUrl = normalizeApiUrl(urlInput);

        if (!cleanUrl) {
            setErrorMessage(
                "Veuillez saisir une adresse valide (ex. http://192.168.1.50:8000).",
            );
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            // Test de connectivité préalable sur l'adresse saisie
            const [healthData, modelsData] = await Promise.all([
                checkBackendHealth(cleanUrl),
                fetchModels(cleanUrl),
            ]);

            // Enregistrement persistant dans localStorage
            setStoredApiUrl(cleanUrl);

            // Notification au parent avec les données fraîches
            onConnected(cleanUrl, healthData, modelsData.models || []);
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : String(err);
            setErrorMessage(
                `${errStr}\n\nConseils : Assurez-vous que le serveur distant a bien été démarré avec "--host 0.0.0.0" et que le pare-feu autorise le port 8000.`,
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto py-8 animate-fade-in">
            <div className="bg-white rounded-3xl border-2 border-gray-300 p-8 sm:p-10 shadow-xs flex flex-col items-center text-center">
                {/* Icône de serveur réseau */}
                <div className="w-20 h-20 rounded-full bg-cyan-50 border-2 border-cyan-200 flex items-center justify-center text-cyan-600 mb-4">
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
                            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                        />
                    </svg>
                </div>

                {/* Titre et sous-titre */}
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Connexion au serveur backend
                </h2>
                <p className="text-gray-600 text-sm mt-2 max-w-md">
                    Le backend de détection d&apos;IA s&apos;exécute sur un
                    serveur distant. Veuillez indiquer son adresse réseau pour
                    vous connecter.
                </p>

                {/* Formulaire de saisie de l'URL */}
                <form
                    onSubmit={handleSubmit}
                    className="w-full mt-6 flex flex-col gap-4 text-left"
                >
                    <div>
                        <label
                            htmlFor="backend-url-input"
                            className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1"
                        >
                            Adresse du serveur (IP ou nom d&apos;hôte avec port)
                        </label>
                        <input
                            id="backend-url-input"
                            type="text"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="http://127.0.0.1:8000 ou http://192.168.1.50:8000"
                            autoFocus
                            className="w-full px-4 py-3 rounded-2xl border-2 border-gray-300 focus:border-cyan-400 focus:outline-none text-base font-mono text-gray-900 transition-colors shadow-xs"
                        />
                        <p className="text-[11px] text-gray-500 mt-1.5">
                            <strong>Astuce :</strong> Utilisez l&apos;adresse
                            IPv4 explicite (ex.{" "}
                            <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                                http://127.0.0.1:8000
                            </code>{" "}
                            ou l&apos;IP du serveur) plutôt que{" "}
                            <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                                localhost
                            </code>{" "}
                            pour éviter les rejets de résolution IPv6 (::1) de
                            Firefox.
                        </p>
                    </div>

                    {/* Affichage d'erreur éventuelle */}
                    {errorMessage && (
                        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs whitespace-pre-line text-left">
                            <strong className="block font-bold mb-1">
                                Échec de connexion :
                            </strong>
                            {errorMessage}
                        </div>
                    )}

                    {/* Boutons d'action */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full sm:w-auto px-8 py-3.5 bg-[#4FE3E8] hover:bg-[#3cd0d5] text-gray-950 font-bold rounded-2xl shadow-xs transition-all duration-150 active:scale-95 cursor-pointer text-sm flex items-center justify-center gap-2 ${
                                isLoading ? "opacity-75 cursor-wait" : ""
                            }`}
                        >
                            {isLoading ? (
                                <>
                                    <svg
                                        className="animate-spin h-4 w-4 text-gray-950"
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
                                    <span>Vérification de l&apos;API...</span>
                                </>
                            ) : (
                                "Valider et se connecter"
                            )}
                        </button>

                        {onCancel && (
                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl border border-gray-300 transition-colors cursor-pointer text-sm"
                            >
                                Annuler
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
