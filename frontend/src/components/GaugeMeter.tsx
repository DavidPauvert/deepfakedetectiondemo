import React from "react";

export interface GaugeMeterProps {
    /** Deepfake / AI probability percentage (0 to 100) */
    percentage: number;
    /** Size variant: 'large' for single view (Slides 2 & 3) or 'small' for batch view */
    size?: "large" | "small";
    /** Optional custom verdict label */
    verdictLabel?: string;
    /** Whether to show the descriptive text below percentage */
    showDescription?: boolean;
}

/**
 * Semi-circular speedometer gauge component
 * Displays an arc with color depending on AI likelihood (Red for deepfake, Green for authentic),
 * an animated needle pointing to the calculated percentage, and verdict text.
 */
export const GaugeMeter: React.FC<GaugeMeterProps> = ({
    percentage,
    size = "large",
    verdictLabel,
    showDescription = true,
}) => {
    // Clamp percentage between 0 and 100
    const clamped = Math.min(100, Math.max(0, Math.round(percentage)));
    const isAI = clamped >= 50;

    const arcColor = isAI ? "#EF4444" : "#10B981"; // Red vs Green
    const textColor = isAI ? "text-red-600" : "text-emerald-600";

    // Calculate needle rotation angle (-90deg at 0% pointing left, 0deg at 50% pointing up, +90deg at 100% pointing right)
    const rotationAngle = -90 + (clamped / 100) * 180;

    const isSmall = size === "small";

    return (
        <div
            className={`flex flex-col items-center justify-center select-none ${
                isSmall ? "p-2" : "p-4"
            }`}
            role="meter"
            aria-label="Probabilité d'intelligence artificielle"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${clamped}% ${isAI ? "détecté comme IA" : "détecté comme authentique"}`}
        >
            {/* SVG Semicircular Speedometer */}
            <div className={`relative ${isSmall ? "w-36 h-20" : "w-64 h-36"}`}>
                <svg
                    viewBox="0 0 200 120"
                    className="w-full h-full overflow-visible"
                    aria-hidden="true"
                >
                    {/* Subtle background arc track */}
                    <path
                        d="M 25 105 A 75 75 0 0 1 175 105"
                        fill="none"
                        stroke="#F1F3F5"
                        strokeWidth={isSmall ? "16" : "20"}
                        strokeLinecap="round"
                    />

                    {/* Active colored arc */}
                    <path
                        d="M 25 105 A 75 75 0 0 1 175 105"
                        fill="none"
                        stroke={arcColor}
                        strokeWidth={isSmall ? "16" : "20"}
                        strokeLinecap="round"
                    />

                    {/* Speedometer Needle */}
                    <g
                        style={{
                            transform: `rotate(${rotationAngle}deg)`,
                            transformOrigin: "100px 105px",
                            transition:
                                "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                    >
                        {/* Needle body (tapered pointer) */}
                        <polygon
                            points="96,105 104,105 101,36 99,36"
                            fill="#18181B"
                        />
                        {/* Center pivot hub */}
                        <circle cx="100" cy="105" r="9" fill="#18181B" />
                        <circle cx="100" cy="105" r="4" fill="#FFFFFF" />
                    </g>
                </svg>
            </div>

            {/* Percentage text */}
            <div
                className={`font-extrabold tracking-tight text-gray-900 ${
                    isSmall ? "text-xl mt-1" : "text-5xl mt-3"
                }`}
            >
                {clamped}%
            </div>

            {/* Decision label */}
            {showDescription && (
                <div
                    className={`text-center font-bold leading-snug mt-2 ${
                        isSmall
                            ? "text-xs max-w-[140px]"
                            : "text-2xl max-w-[320px]"
                    } ${textColor}`}
                >
                    {verdictLabel ? (
                        verdictLabel
                    ) : isAI ? (
                        <>
                            <div>Cet audio est</div>
                            <div>probablement de l’IA</div>
                        </>
                    ) : (
                        <>
                            <div>Cet audio n’est</div>
                            <div>probablement pas de</div>
                            <div>l’IA</div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
