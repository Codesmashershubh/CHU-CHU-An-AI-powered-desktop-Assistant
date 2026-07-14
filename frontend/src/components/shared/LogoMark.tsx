interface LogoMarkProps {
  size?: number;
  animated?: boolean;
  className?: string;
}

/**
 * The twin-pulse mark: two beats on a baseline, echoing the two syllables of
 * "Chu Chu." Used as the static brand mark everywhere, and — with
 * `animated` — as the "Chu Chu is thinking" indicator (see ChatPanel).
 */
export function LogoMark({ size = 20, animated = false, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 20 H10 L13 9 L16 24 L19 9 L22 20 H28"
        stroke="var(--chu-brass)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        pathLength={1}
        style={
          animated
            ? {
                strokeDasharray: 1,
                strokeDashoffset: 0,
                animation: "chu-logo-pulse 1.4s var(--ease-out) infinite",
              }
            : undefined
        }
      />
      {animated && (
        <style>{`
          @keyframes chu-logo-pulse {
            0% { opacity: 0.35; }
            50% { opacity: 1; }
            100% { opacity: 0.35; }
          }
        `}</style>
      )}
    </svg>
  );
}
