import React, { useRef, useState, useCallback } from "react";
import type { UploadedAudioFile } from "../types";
import { AudioPlayer } from "./AudioPlayer";

export interface AudioUploaderProps {
    /** Currently uploaded files */
    files: UploadedAudioFile[];
    /** Handler when files are added */
    onFilesAdded: (newFiles: File[]) => void;
    /** Handler when a file is removed */
    onFileRemoved: (id: string) => void;
    /** Allow multiple files selection (for batch mode) */
    multiple?: boolean;
    /** Step title label */
    title?: string;
}

/**
 * Audio file drag-and-drop / click-to-upload box.
 * Renders the folder icon with arrow cursor and handles audio file validation.
 */
export const AudioUploader: React.FC<AudioUploaderProps> = ({
    files,
    onFilesAdded,
    onFileRemoved,
    multiple = false,
    title = "1. Ajoutez un fichier audio",
}) => {
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Accepted audio MIME types and extensions
    const acceptedExtensions = ".wav,.mp3,.ogg,.flac,.m4a";

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);
        },
        [],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const droppedFiles = Array.from(e.dataTransfer.files).filter(
                    (file) => {
                        const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
                        return [
                            ".wav",
                            ".mp3",
                            ".ogg",
                            ".flac",
                            ".m4a",
                        ].includes(ext);
                    },
                );

                if (droppedFiles.length > 0) {
                    onFilesAdded(multiple ? droppedFiles : [droppedFiles[0]!]);
                }
            }
        },
        [multiple, onFilesAdded],
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.files && e.target.files.length > 0) {
                const selected = Array.from(e.target.files);
                onFilesAdded(multiple ? selected : [selected[0]!]);
                // Reset input value so re-selecting same file triggers change
                e.target.value = "";
            }
        },
        [multiple, onFilesAdded],
    );

    const triggerBrowse = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const hasFiles = files.length > 0;

    return (
        <div className="w-full">
            {/* Step Title matching */}
            {title && (
                <h2 className="text-xl font-bold text-gray-900 mb-3 text-left">
                    {title}
                </h2>
            )}

            {/* Main Container Card */}
            <div
                className={`w-full rounded-3xl border-2 transition-all duration-200 bg-white ${
                    isDragOver
                        ? "border-[#4FE3E8] bg-cyan-50/20 scale-[1.01]"
                        : "border-gray-300 hover:border-gray-400"
                } ${hasFiles && !multiple ? "p-6" : "p-10"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Hidden File Input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedExtensions}
                    multiple={multiple}
                    onChange={handleInputChange}
                    className="hidden"
                    id="audio-file-input"
                />

                {/* If Single File Mode and a file is selected: Display preview with change button */}
                {!multiple && hasFiles ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-2">
                        <AudioPlayer
                            src={files[0]!.objectUrl}
                            filename={files[0]!.name}
                            fileSize={files[0]!.size}
                            onRemove={() => onFileRemoved(files[0]!.id)}
                        />
                        <button
                            type="button"
                            onClick={triggerBrowse}
                            className="text-xs font-semibold text-gray-500 hover:text-cyan-700 underline mt-1 cursor-pointer"
                        >
                            Choisir un autre fichier audio
                        </button>
                    </div>
                ) : (
                    /* Empty state or Multi-file drop zone */
                    <div
                        onClick={triggerBrowse}
                        className="flex flex-col items-center justify-center cursor-pointer select-none py-4"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                triggerBrowse();
                            }
                        }}
                        aria-label="Cliquer ou glisser-déposer un fichier audio"
                    >
                        {/* Custom SVG folder icon with arrow cursor */}
                        <div className="relative mb-5 w-24 h-24 flex items-center justify-center">
                            <svg
                                viewBox="0 0 100 80"
                                className="w-20 h-20 text-gray-400"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                {/* Folder back tab and body */}
                                <path
                                    d="M10 18C10 13.5817 13.5817 10 18 10H36L46 22H82C86.4183 22 90 25.5817 90 30V68C90 72.4183 86.4183 76 82 76H18C13.5817 76 10 72.4183 10 68V18Z"
                                    fill="#9CA3AF"
                                />
                                <path
                                    d="M18 28H82C84.2091 28 86 29.7909 86 32V68C86 70.2091 84.2091 72 82 72H18C15.7909 72 14 70.2091 14 68V32C14 29.7909 15.7909 28 18 28Z"
                                    fill="#E5E7EB"
                                />
                            </svg>

                            {/* Cursor / Pointer Arrow */}
                            <svg
                                className="absolute right-0 bottom-0 w-10 h-10 text-gray-500 drop-shadow-md"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M4 3L11 20L13.5 13.5L20 11L4 3Z"
                                    fill="#6B7280"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>

                        {/* Prompt text from */}
                        <p className="text-gray-800 text-lg font-medium">
                            Cliquez ou déposez un fichier
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                            Formats supportés : WAV, MP3, M4A, FLAC, OGG
                        </p>
                    </div>
                )}

                {/* In Batch mode: List of queued files */}
                {multiple && hasFiles && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-gray-700">
                                {files.length} fichier
                                {files.length > 1 ? "s" : ""} sélectionné
                                {files.length > 1 ? "s" : ""}
                            </span>
                            <button
                                type="button"
                                onClick={triggerBrowse}
                                className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 cursor-pointer"
                            >
                                + Ajouter d&apos;autres fichiers
                            </button>
                        </div>
                        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                            {files.map((fileItem) => (
                                <AudioPlayer
                                    key={fileItem.id}
                                    src={fileItem.objectUrl}
                                    filename={fileItem.name}
                                    fileSize={fileItem.size}
                                    compact
                                    onRemove={() => onFileRemoved(fileItem.id)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
