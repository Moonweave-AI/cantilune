import type { ReactNode } from "react";

interface IconProps {
  readonly size?: number;
  readonly className?: string | undefined;
}

function Svg({
  size = 16,
  className,
  children,
}: IconProps & { readonly children: ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 3v10M3 8h10" {...stroke} />
    </Svg>
  );
}

export function IconSettings(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.2" {...stroke} />
      <path
        d="M8 2.4v1.4M8 12.2v1.4M2.4 8h1.4M12.2 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1"
        {...stroke}
      />
    </Svg>
  );
}

export function IconSearch(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="3.4" {...stroke} />
      <path d="M10 10.2 13.2 13.4" {...stroke} />
    </Svg>
  );
}

export function IconSun(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.4" {...stroke} />
      <path
        d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M4 4l1 1M11 11l1 1M12 4l-1 1M5 11l-1 1"
        {...stroke}
      />
    </Svg>
  );
}

export function IconMoon(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M11.6 10.2A4.6 4.6 0 0 1 6 4.2a4.7 4.7 0 1 0 5.6 6Z" {...stroke} />
    </Svg>
  );
}

export function IconSystem(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.4" y="3.2" width="11.2" height="8" rx="1.4" {...stroke} />
      <path d="M6 13h4M8 11.2V13" {...stroke} />
    </Svg>
  );
}

export function IconSend(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 12.4V3.6M4.6 7.2 8 3.6l3.4 3.6" {...stroke} />
    </Svg>
  );
}

export function IconStop(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="4.4" y="4.4" width="7.2" height="7.2" rx="1.2" fill="currentColor" />
    </Svg>
  );
}

export function IconDownload(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 3.2v7.2M5 8.2 8 11.4 11 8.2M3.4 13h9.2" {...stroke} />
    </Svg>
  );
}

export function IconChevron(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M6 3.6 10.4 8 6 12.4" {...stroke} />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.6 6 8 10.4 12.4 6" {...stroke} />
    </Svg>
  );
}

export function IconPanelLeft(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.4" {...stroke} />
      <path d="M6.2 3.2v9.6" {...stroke} />
    </Svg>
  );
}

export function IconTool(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M10.6 3.4a2.4 2.4 0 0 1 2 2L9.2 8.8l-2-2 3.4-3.4Z" {...stroke} />
      <path d="M7 7.2 3.6 12.4l5.2-3.4" {...stroke} />
    </Svg>
  );
}

export function IconThink(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 2.8 9.1 6l3.3.3-2.6 2.2.9 3.2L8 9.8 5.3 11.7l.9-3.2L3.6 6.3 6.9 6Z" {...stroke} />
    </Svg>
  );
}

export function IconFolder(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M2.6 5.2h4L8 6.6h5.4v6.2H2.6V5.2Z" {...stroke} />
      <path d="M2.6 5.2V4.2h3.2l.8 1" {...stroke} />
    </Svg>
  );
}

export function IconClock(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="5.2" {...stroke} />
      <path d="M8 5.2V8l2 1.6" {...stroke} />
    </Svg>
  );
}

export function IconGrid(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.8" y="2.8" width="4" height="4" rx="0.6" {...stroke} />
      <rect x="9.2" y="2.8" width="4" height="4" rx="0.6" {...stroke} />
      <rect x="2.8" y="9.2" width="4" height="4" rx="0.6" {...stroke} />
      <rect x="9.2" y="9.2" width="4" height="4" rx="0.6" {...stroke} />
    </Svg>
  );
}

export function IconBars(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 12.2V8.4M8 12.2V3.8M13 12.2V6.2" {...stroke} />
    </Svg>
  );
}

export function IconClose(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" {...stroke} />
    </Svg>
  );
}

export function IconCopy(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5.4" y="5.4" width="7" height="7" rx="1.1" {...stroke} />
      <path d="M3.6 10.2V3.8A1 1 0 0 1 4.6 2.8h6.4" {...stroke} />
    </Svg>
  );
}

export function IconShield(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M8 2.6 3.4 4.4v3.4c0 3.1 2 5.1 4.6 5.8 2.6-.7 4.6-2.7 4.6-5.8V4.4L8 2.6Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconSliders(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3 5.2h10M3 10.8h10" {...stroke} />
      <circle cx="6.2" cy="5.2" r="1.3" {...stroke} />
      <circle cx="10.2" cy="10.8" r="1.3" {...stroke} />
    </Svg>
  );
}

export function IconCheck(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.4 8.2 6.4 11.2 12.6 4.8" {...stroke} />
    </Svg>
  );
}

export function IconTerminal(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="2.4" y="3.4" width="11.2" height="9.2" rx="1.4" {...stroke} />
      <path d="M4.6 6.4 6.8 8 4.6 9.6M8.2 10.2h3" {...stroke} />
    </Svg>
  );
}

export function IconChatPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M3.2 4.2h9.6v7.2H7.2L3.2 14V4.2Z" {...stroke} />
      <path d="M8 6.4v3.2M6.4 8h3.2" {...stroke} />
    </Svg>
  );
}

export function IconFolderPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M2.6 5.2h4L8 6.6h5.4v6.2H2.6V5.2Z" {...stroke} />
      <path d="M2.6 5.2V4.2h3.2l.8 1M10.2 9.2v2.4M9 10.4h2.4" {...stroke} />
    </Svg>
  );
}

export function IconDots(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="4" cy="8" r="1" fill="currentColor" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </Svg>
  );
}

export function IconTrash(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 5.2h8M6.2 5.2V3.8h3.6v1.4M5.2 5.2l.6 7h4.4l.6-7" {...stroke} />
    </Svg>
  );
}

export function IconPencil(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M9.2 3.8 12.2 6.8 6 13H3v-3L9.2 3.8Z" {...stroke} />
    </Svg>
  );
}

export function IconLayers(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 3.2 13.2 6 8 8.8 2.8 6 8 3.2Z" {...stroke} />
      <path d="M3.2 8.4 8 11l4.8-2.6M3.2 10.8 8 13.4l4.8-2.6" {...stroke} />
    </Svg>
  );
}

export function IconPuzzle(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M6 3.4h4v1.6a1.4 1.4 0 1 0 0 2.8V9.4H8.4a1.4 1.4 0 1 0-2.8 0H4V6.2h1.6A1.4 1.4 0 1 0 6 3.4Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconBrain(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M6.2 3.6a2 2 0 0 0-2 2.4 1.8 1.8 0 0 0 .2 3.4v1.8c0 .8.8 1.4 1.6 1.4h4c.8 0 1.6-.6 1.6-1.4V9.4a1.8 1.8 0 0 0 .2-3.4 2 2 0 0 0-2-2.4 2.2 2.2 0 0 0-3.6 0Z"
        {...stroke}
      />
    </Svg>
  );
}
