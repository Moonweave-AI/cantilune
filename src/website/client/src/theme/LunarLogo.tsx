/**
 * Lunar brand mark — moonlight disc, crescent bite, cyan silk.
 * Moonweave identity: 月光、丝线与工程. https://moonweave-ai.github.io/zh/home/
 */

import { useId } from "react";

export interface LunarLogoProps {
  readonly size?: number;
  readonly className?: string | undefined;
}

export function LunarLogo({ size = 28, className }: LunarLogoProps): JSX.Element {
  const raw = useId().replace(/:/g, "");
  const fill = `cln-mark-fill-${raw}`;
  const silk = `cln-mark-silk-${raw}`;
  const crescent = `cln-mark-crescent-${raw}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={fill} cx="34%" cy="30%" r="74%">
          <stop offset="0%" stopColor="oklch(97% 0.02 80)" />
          <stop offset="42%" stopColor="oklch(84% 0.13 292)" />
          <stop offset="100%" stopColor="oklch(16% 0.05 268)" />
        </radialGradient>
        <linearGradient id={silk} x1="18%" y1="88%" x2="86%" y2="12%">
          <stop offset="0%" stopColor="oklch(72% 0.1 210 / 0.15)" />
          <stop offset="45%" stopColor="oklch(88% 0.12 208)" />
          <stop offset="100%" stopColor="oklch(84% 0.13 292 / 0.2)" />
        </linearGradient>
        <mask id={crescent}>
          <rect width="32" height="32" fill="black" />
          <circle cx="16" cy="16" r="10.2" fill="white" />
          <circle cx="20.4" cy="13.2" r="8.4" fill="black" />
        </mask>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="13.4"
        fill="oklch(18% 0.055 268 / 0.92)"
        stroke="oklch(82% 0.12 285 / 0.38)"
        strokeWidth="1"
      />
      <circle cx="16" cy="16" r="10.2" fill={`url(#${fill})`} opacity="0.22" />
      <circle cx="16" cy="16" r="10.2" fill={`url(#${fill})`} mask={`url(#${crescent})`} />
      <path
        d="M9.2 23.6C14.8 26.4 23.6 22.8 25.4 12.4"
        fill="none"
        stroke={`url(#${silk})`}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
