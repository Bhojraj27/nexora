import { cn } from "@/lib/utils";

interface NexoraLogoProps {
  size?: number;
  className?: string;
}

export function NexoraLogo({ size = 24, className }: NexoraLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-label="NEXORA logo"
    >
      <defs>
        <linearGradient id="nexora-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="nexora-accent" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id="nexora-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="url(#nexora-grad)"
        opacity="0.15"
      />
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        stroke="url(#nexora-grad)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.4"
      />

      {/* Abstract N mark */}
      <g filter="url(#nexora-glow)">
        {/* Left vertical stroke */}
        <path
          d="M14 36V12"
          stroke="url(#nexora-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Diagonal connector */}
        <path
          d="M14 12L34 36"
          stroke="url(#nexora-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Right vertical stroke */}
        <path
          d="M34 12V36"
          stroke="url(#nexora-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </g>

      {/* Neural network nodes */}
      <circle cx="14" cy="12" r="3" fill="#818cf8" opacity="0.9" />
      <circle cx="34" cy="36" r="3" fill="#a78bfa" opacity="0.9" />
      <circle cx="24" cy="24" r="2.5" fill="#c4b5fd" opacity="0.7" />
      <circle cx="34" cy="12" r="2" fill="#6366f1" opacity="0.6" />
      <circle cx="14" cy="36" r="2" fill="#6366f1" opacity="0.6" />
    </svg>
  );
}
