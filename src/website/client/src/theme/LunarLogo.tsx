/**
 * Lunar-phase (月相) logo — ADR-0030 §5. Pure SVG, theme-aware.
 * A crescent over a full disc: the purple body with a cyan-lit limb.
 */

export interface LunarLogoProps {
  readonly size?: number;
  readonly className?: string | undefined;
}

export function LunarLogo({ size = 28, className }: LunarLogoProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="cln-logo-glow" cx="38%" cy="38%" r="70%">
          <stop offset="0%" stopColor="var(--cln-static-lunar-400)" />
          <stop offset="60%" stopColor="var(--cln-static-lunar-600)" />
          <stop offset="100%" stopColor="var(--cln-static-lunar-800)" />
        </radialGradient>
        <mask id="cln-logo-crescent">
          <rect width="32" height="32" fill="white" />
          <circle cx="20" cy="16" r="11" fill="black" />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="13" fill="url(#cln-logo-glow)" />
      <g mask="url(#cln-logo-crescent)">
        <circle cx="16" cy="16" r="13" fill="url(#cln-logo-glow)" />
      </g>
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="var(--cln-static-cyan-400)"
        strokeWidth="1.5"
        opacity="0.7"
      />
    </svg>
  );
}
