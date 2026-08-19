import type { ReactNode } from "react";

interface IconProps {
  readonly size?: number;
  readonly className?: string | undefined;
}

/**
 * The Harness UI ships its own compact, currentColor SVG glyphs rather than
 * using an icon-font or raster/mask asset.  Keeping that model here makes
 * every icon share the same box, baseline and theme colour without any
 * external asset layer that can clip or combine paths unexpectedly.
 */
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
  strokeWidth: 1.45,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M8.65 1.5v5.85h5.85v1.3H8.65v5.85h-1.3V8.65H1.5v-1.3h5.85V1.5Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconSettings(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="m6.35 2.05.4 1.24a4.95 4.95 0 0 1 2.5 0l.4-1.24 1.56.65-.58 1.17c.65.4 1.2.95 1.6 1.6l1.17-.58.65 1.56-1.24.4a4.95 4.95 0 0 1 0 2.5l1.24.4-.65 1.56-1.17-.58a5.1 5.1 0 0 1-1.6 1.6l.58 1.17-1.56.65-.4-1.24a4.95 4.95 0 0 1-2.5 0l-.4 1.24-1.56-.65.58-1.17a5.1 5.1 0 0 1-1.6-1.6l-1.17.58-.65-1.56 1.24-.4a4.95 4.95 0 0 1 0-2.5l-1.24-.4.65-1.56 1.17.58a5.1 5.1 0 0 1 1.6-1.6l-.58-1.17 1.56-.65Z"
        {...stroke}
      />
      <circle cx="8" cy="8" r="2.05" {...stroke} />
    </Svg>
  );
}

export function IconSearch(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M13.25 6.65A6.63 6.63 0 1 1 6.62 0a6.63 6.63 0 0 1 6.63 6.65Zm-1.35 0a5.28 5.28 0 1 0-10.55 0 5.28 5.28 0 0 0 10.55 0Z"
        fill="currentColor"
      />
      <path d="m16 15.04-.96.96-3.51-3.53.96-.96L16 15.04Z" fill="currentColor" />
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

/** Harness-style filled up-arrow used by the composer primary action. */
export function IconSend(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M8.31.98c.36.08.67.23.95.45.23.18.47.43.72.68l4.73 4.73-1.41 1.41L9 3.96v11.08H7V3.96L2.71 8.25 1.29 6.83l4.73-4.72c.25-.25.49-.5.72-.68.24-.19.55-.39.95-.45.21-.03.42-.03.63 0Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconStop(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="10" height="10" rx="3" fill="currentColor" />
    </Svg>
  );
}

export function IconDownload(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="M8 2.7v7.15M5 7.2 8 10.2l3-3M3.2 13.1h9.6" {...stroke} />
    </Svg>
  );
}

export function IconChevron(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="m5.5 2.15.42.43 2.73 2.72c.26.26.48.49.65.69.17.21.32.46.37.77.03.16.03.33 0 .5-.05.3-.2.55-.37.76-.17.21-.39.44-.65.7l-2.73 2.72-.42.43L4.65 11l.43-.42L7.8 7.85c.27-.27.45-.45.56-.59.11-.13.12-.18.12-.2a.55.55 0 0 0 0-.12c0-.01-.01-.06-.12-.2-.11-.14-.29-.31-.56-.59L5.08 3.42 4.65 3l.85-.85Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconChevronDown(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="m11.85 5.5-.43.42-2.72 2.73c-.26.26-.49.48-.69.65-.21.17-.46.32-.77.37a1.55 1.55 0 0 1-.5 0c-.3-.05-.55-.2-.76-.37-.21-.17-.44-.39-.7-.65L2.58 5.92l-.43-.42L3 4.65l.42.43 2.73 2.72c.27.27.45.45.59.56.13.11.18.12.2.12.04.01.08.01.12 0 .01 0 .06-.01.2-.12.14-.11.31-.29.59-.56l2.73-2.72L11 4.65l.85.85Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconPanelLeft(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="1.15" y="1.15" width="13.7" height="13.7" rx="2.1" {...stroke} />
      <path d="M5.45 1.8v12.4" {...stroke} />
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
      <path
        d="m8 2.8 1.1 3.2 3.3.3-2.6 2.2.9 3.2L8 9.8l-2.7 1.9.9-3.2-2.6-2.2L6.9 6 8 2.8Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconFolder(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M5.19629 1.57104C5.81144 1.5711 6.38623 1.8786 6.72754 2.39038L7.19922 3.09839C7.28454 3.22635 7.42824 3.30344 7.58203 3.30347H12.1699C13.5039 3.30348 14.5859 4.38548 14.5859 5.71948V6.62671C15.2694 7.02689 15.6605 7.85012 15.4385 8.68726L14.3848 12.658C14.1037 13.7164 13.1449 14.4527 12.0498 14.4529H2.91699C1.51651 14.4529 0.451662 13.2814 0.501954 11.9519V3.98706C0.501954 2.65305 1.58396 1.57104 2.91797 1.57104H5.19629ZM3.7793 7.75562C3.30994 7.75562 2.89883 8.07153 2.77832 8.52515L1.91602 11.7722C1.74167 12.4291 2.23734 13.073 2.91699 13.073H12.0498C12.5191 13.0728 12.9304 12.757 13.0508 12.3035L14.1045 8.33374C14.1819 8.04202 13.9619 7.756 13.6602 7.75562H3.7793ZM2.91797 2.9519C2.34625 2.9519 1.88281 3.41534 1.88281 3.98706V7.2937C2.33068 6.7269 3.02249 6.37476 3.7793 6.37476H13.2051V5.71948C13.2051 5.14777 12.7416 4.68434 12.1699 4.68433H7.58203C6.96675 4.6843 6.39209 4.37595 6.05078 3.86401L5.5791 3.15601C5.49379 3.02821 5.34995 2.95196 5.19629 2.9519H2.91797Z"
        fill="currentColor"
      />
      <path
        opacity=".2"
        d="M13.6602 7.75525C13.9618 7.7556 14.1815 8.04179 14.1045 8.33337L13.0508 12.3031C12.9304 12.7567 12.5191 13.0725 12.0498 13.0726H2.91701C2.23744 13.0725 1.7417 12.4287 1.91603 11.7719L2.77834 8.52478C2.89898 8.07146 3.31018 7.75532 3.77931 7.75525H13.6602ZM5.1963 2.95154C5.34985 2.95159 5.49377 3.02803 5.57912 3.15564L6.0508 3.86365C6.39205 4.37553 6.96685 4.68385 7.58205 4.68396H12.1699C12.7416 4.68396 13.2049 5.14754 13.2051 5.71912V6.37439H3.77931C3.02267 6.37444 2.33067 6.72671 1.88283 7.29333V3.98669C1.88299 3.4152 2.34649 2.95168 2.91798 2.95154H5.1963Z"
        fill="currentColor"
      />
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
      <rect x="2.8" y="2.8" width="4" height="4" rx=".65" {...stroke} />
      <rect x="9.2" y="2.8" width="4" height="4" rx=".65" {...stroke} />
      <rect x="2.8" y="9.2" width="4" height="4" rx=".65" {...stroke} />
      <rect x="9.2" y="9.2" width="4" height="4" rx=".65" {...stroke} />
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
      <path d="m4.2 4.2 7.6 7.6m0-7.6-7.6 7.6" {...stroke} />
    </Svg>
  );
}

export function IconCopy(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5.4" y="5.4" width="7" height="7" rx="1.1" {...stroke} />
      <path d="M3.6 10.2V3.8a1 1 0 0 1 1-1h6.4" {...stroke} />
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
      <path
        transform="translate(1.292 1.3)"
        d="M10.3232 9.18164C11.2868 9.18164 12.0985 9.82833 12.3506 10.7109L13.415 10.7109L13.415 11.8711L12.3496 11.8711C12.0971 12.7532 11.2864 13.3994 10.3232 13.3994C9.36031 13.3992 8.55012 12.7531 8.29785 11.8711L0 11.8711L0 10.7109L8.29688 10.7109C8.54876 9.82845 9.35988 9.18186 10.3232 9.18164ZM10.3232 10.3418C9.7999 10.3421 9.37534 10.7667 9.375 11.29C9.375 11.8137 9.79969 12.239 10.3232 12.2393C10.847 12.2393 11.2725 11.8138 11.2725 11.29C11.2721 10.7666 10.8468 10.3418 10.3232 10.3418ZM12.4326 11.291C12.4326 11.3549 12.4284 11.418 12.4229 11.4805C12.4287 11.4181 12.4326 11.355 12.4326 11.291ZM8.21484 11.2832C8.21484 11.2856 8.21484 11.2886 8.21484 11.291L8.21484 11.29C8.21484 11.2878 8.21484 11.2855 8.21484 11.2832ZM3.08301 4.59082C4.04605 4.59095 4.85696 5.23717 5.10938 6.11914L13.415 6.11914L13.415 7.2793L5.11035 7.2793C4.85833 8.16202 4.04648 8.80846 3.08301 8.80859C2.11972 8.80843 1.30963 8.16179 1.05762 7.2793L0 7.2793L0 6.11914L1.05762 6.11914C1.30994 5.23728 2.12006 4.59098 3.08301 4.59082ZM3.08301 5.75098C2.55962 5.75117 2.13512 6.17587 2.13477 6.69922C2.13477 7.22287 2.5594 7.64824 3.08301 7.64844C3.60665 7.64828 4.03223 7.2229 4.03223 6.69922C4.03187 6.17585 3.60643 5.75113 3.08301 5.75098ZM5.19238 6.69922C5.19238 6.763 5.18816 6.82633 5.18262 6.88867C5.18846 6.82629 5.19238 6.76313 5.19238 6.69922C5.19236 6.63495 5.18853 6.57152 5.18262 6.50879C5.18826 6.57154 5.19236 6.635 5.19238 6.69922ZM0.982422 6.52344C0.977382 6.58136 0.97463 6.63999 0.974609 6.69922C0.974609 6.75775 0.977496 6.81579 0.982422 6.87305C0.977758 6.81579 0.974609 6.75767 0.974609 6.69922C0.974628 6.64 0.977618 6.58142 0.982422 6.52344ZM10.3232 0C11.2869 0 12.0986 0.646596 12.3506 1.5293L13.415 1.5293L13.415 2.68945L12.3496 2.68945C12.363 2.64266 12.3754 2.59488 12.3857 2.54688C12.1838 3.50118 11.3376 4.21777 10.3232 4.21777C9.36037 4.21756 8.55018 3.57139 8.29785 2.68945L0 2.68945L0 1.5293L8.29688 1.5293C8.5487 0.646717 9.35981 0.00021854 10.3232 0ZM10.3232 1.16016C9.79984 1.16042 9.37524 1.58499 9.375 2.1084C9.375 2.63201 9.79969 3.05735 10.3232 3.05762C10.847 3.05762 11.2725 2.63217 11.2725 2.1084C11.2722 1.58483 10.8469 1.16016 10.3232 1.16016ZM12.4229 2.29883C12.4287 2.23641 12.4326 2.17331 12.4326 2.10938C12.4326 2.17327 12.4284 2.23638 12.4229 2.29883ZM8.21484 2.10938L8.21484 2.1084L8.21484 2.10938ZM8.22266 1.93359C8.21785 1.98897 8.21506 2.04499 8.21484 2.10156C8.21503 2.04501 8.2181 1.98902 8.22266 1.93359ZM8.22266 11.1162C8.2179 11.1713 8.21507 11.227 8.21484 11.2832C8.21504 11.227 8.21814 11.1713 8.22266 11.1162Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconCheck(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m3.4 8.2 3 3 6.2-6.4" {...stroke} />
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

/** Matches the Harness sidebar's circular New Session glyph. */
export function IconChatPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M8 .32a7.68 7.68 0 0 0-6.94 10.97l.29.61 1.22-.58-.29-.61A6.3 6.3 0 1 1 8 14.33c-.72 0-1.24-.05-1.7-.18-.46-.12-.9-.34-1.42-.7-.76-.53-1.85-.72-2.74-.15l-.8.56.45 1.33 1.06-.75c.33-.21.82-.18 1.25.12.62.43 1.19.72 1.83.9.63.17 1.29.23 2.06.23A7.68 7.68 0 1 0 8 .32ZM7.35 4.83v2.5h-2.5v1.35h2.5v2.5h1.35v-2.5h2.5V7.33h-2.5v-2.5H7.35Z"
        fill="currentColor"
      />
    </Svg>
  );
}

export function IconFolderPlus(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        transform="translate(9.52 2.52)"
        d="M3.55246 0L3.55246 2.44252L6 2.44252L6 3.55748L3.55246 3.55748L3.55246 6L2.43834 6L2.43834 3.55748L0 3.55748L0 2.44252L2.43834 2.44252L2.43834 0L3.55246 0Z"
        fill="currentColor"
      />
      <path
        transform="translate(.35 2.35)"
        d="M4.76367 0C5.36861 1.80598e-05 5.93113 0.310294 6.25488 0.821289L6.78027 1.64941C6.79685 1.67558 6.81791 1.69775 6.83887 1.71973C6.72186 2.15521 6.65702 2.61192 6.65137 3.08301C6.25601 2.96045 5.90909 2.70478 5.68164 2.3457L5.15723 1.5166C5.07183 1.38189 4.92318 1.3008 4.76367 1.30078L2.32422 1.30078C1.7589 1.30078 1.30078 1.7589 1.30078 2.32422L1.30078 10.1338C1.30078 10.6991 1.7589 11.1572 2.32422 11.1572L11.9766 11.1572C12.5419 11.1572 13 10.6991 13 10.1338L13 8.58398C13.4545 8.5135 13.8903 8.38748 14.3008 8.21289L14.3008 10.1338C14.3008 11.4171 13.2598 12.458 11.9766 12.458L2.32422 12.458C1.04093 12.458 0 11.4171 0 10.1338L0 2.32422C0 1.04093 1.04093 0 2.32422 0L4.76367 0Z"
        fill="currentColor"
      />
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
      <path d="m9.2 3.8 3 3L6 13H3v-3l6.2-6.2Z" {...stroke} />
    </Svg>
  );
}

export function IconLayers(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path d="m8 3.2 5.2 2.8L8 8.8 2.8 6 8 3.2Z" {...stroke} />
      <path d="M3.2 8.4 8 11l4.8-2.6M3.2 10.8 8 13.4l4.8-2.6" {...stroke} />
    </Svg>
  );
}

export function IconPuzzle(props: IconProps): JSX.Element {
  return (
    <Svg {...props}>
      <path
        d="M6 3.4h4V5a1.4 1.4 0 1 0 0 2.8v1.6H8.4a1.4 1.4 0 1 0-2.8 0H4V6.2h1.6A1.4 1.4 0 1 0 6 3.4Z"
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
