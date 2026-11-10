import React, { useState, useRef, useEffect, useCallback } from "react";

export interface AudioPlayerProps {
    /** Audio source: Blob URL, HTTP URL, or File object */
    src: string;
    /** Audio display filename (ex, 'blabla.m4a') */
    filename: string;
    /** Optional file size in bytes */
    fileSize?: number;
    /** Compact mode for batch lists */
    compact?: boolean;
    /** Optional delete/remove handler */
    onRemove?: () => void;
}

/**
 * Audio preview player with custom waveform visualization matching Slides 2, 3, and 4.
 * Uses native HTML5 Audio for playback with smooth progress updates and animated waveform.
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
    src,
    filename,
    compact = false,
    onRemove,
}) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);

    // Pre-calculated deterministic pseudo-random waveform bar heights (normalized 0.1 to 1.0)
    // look at my cool audio bar isn't it big bandant like we say in français oh oh oh la baguette du fromage
    // je suis fatigué oui.
    // Generated using filename characters for consistent visual identity
    const waveformBars = React.useMemo(() => {
        const barCount = compact ? 28 : 46;
        const bars: number[] = [];
        let seed = 0;
        for (let i = 0; i < filename.length; i++) {
            seed = (seed + filename.charCodeAt(i) * (i + 1)) % 1000;
        }
        for (let i = 0; i < barCount; i++) {
            // Create natural speech-like envelope with louder peaks in center
            const envelope = Math.sin((i / barCount) * Math.PI);
            const pseudoRand =
                ((seed * (i + 3) * 9301 + 49297) % 233280) / 233280;
            const height = Math.max(
                0.18,
                Math.min(
                    1.0,
                    0.25 + envelope * 0.65 * pseudoRand + 0.15 * pseudoRand,
                ),
            );
            bars.push(height);
        }
        return bars;
    }, [filename, compact]);

    // Audio event listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            if (audio.duration && audio.duration > 0) {
                setProgress((audio.currentTime / audio.duration) * 100);
                setCurrentTime(audio.currentTime);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration || 0);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    // Play / Pause toggle
    const togglePlay = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio) return;

        try {
            if (isPlaying) {
                audio.pause();
                setIsPlaying(false);
            } else {
                await audio.play();
                setIsPlaying(true);
            }
        } catch {
            // Audio autoplay restrictions or invalid audio format
            setIsPlaying(false);
        }
    }, [isPlaying]);

    // Format time mm:ss
    const formatTime = (seconds: number): string => {
        if (Number.isNaN(seconds) || seconds <= 0) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    };

    return (
        <div className="flex flex-col items-start w-full max-w-xl mx-auto">
            {/* Hidden native audio element */}
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Filename header */}
            <div className="flex items-center justify-between w-full mb-1 px-1">
                <span
                    className="text-sm font-semibold text-gray-700 truncate max-w-xs"
                    title={filename}
                >
                    {filename}
                </span>
                {duration > 0 && (
                    <span className="text-xs text-gray-500 font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                )}
            </div>

            {/* Orange Player Pill */}
            <div
                className={`w-full bg-[#FF8C42] hover:bg-[#ff8031] transition-colors rounded-2xl flex items-center shadow-sm select-none ${
                    compact ? "px-3 py-2 gap-2" : "px-4 py-3 gap-3"
                }`}
            >
                {/* Play/Pause Button */}
                <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={
                        isPlaying ? "Mettre en pause" : "Écouter l'audio"
                    }
                    className={`flex-shrink-0 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer ${
                        compact ? "w-8 h-8" : "w-10 h-10"
                    }`}
                >
                    {isPlaying ? (
                        // Pause icon
                        <svg
                            className={compact ? "w-4 h-4" : "w-5 h-5"}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                        </svg>
                    ) : (
                        // Play icon
                        <svg
                            className={`${compact ? "w-4 h-4" : "w-5 h-5"} translate-x-0.5`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                {/* Waveform Visualization Bars */}
                <div
                    className="flex-1 flex items-center justify-between h-8 px-1 cursor-pointer overflow-hidden gap-[2px]"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickPos = (e.clientX - rect.left) / rect.width;
                        if (audioRef.current && duration > 0) {
                            audioRef.current.currentTime = clickPos * duration;
                            setProgress(clickPos * 100);
                        }
                    }}
                    role="slider"
                    aria-label="Position de lecture"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowRight" && audioRef.current) {
                            audioRef.current.currentTime = Math.min(
                                duration,
                                audioRef.current.currentTime + 3,
                            );
                        } else if (e.key === "ArrowLeft" && audioRef.current) {
                            audioRef.current.currentTime = Math.max(
                                0,
                                audioRef.current.currentTime - 3,
                            );
                        }
                    }}
                >
                    {waveformBars.map((heightNorm, idx) => {
                        const barProgress = (idx / waveformBars.length) * 100;
                        const isPlayed = barProgress <= progress;
                        return (
                            <span
                                key={`bar-${filename}-${idx}`}
                                className={`w-1 rounded-full transition-all duration-150 ${
                                    isPlayed ? "bg-white" : "bg-black/60"
                                } ${isPlaying && isPlayed ? "wave-bar-active" : ""}`}
                                style={{
                                    height: `${Math.round(heightNorm * 28)}px`,
                                    opacity: isPlayed ? 1 : 0.85,
                                }}
                            />
                        );
                    })}
                </div>

                {/* Optional Remove button */}
                {onRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label="Supprimer le fichier"
                        title="Supprimer ce fichier"
                        className="flex-shrink-0 text-white/80 hover:text-white p-1 rounded-lg hover:bg-black/10 transition-colors cursor-pointer"
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
                )}
            </div>
        </div>
    );
};
