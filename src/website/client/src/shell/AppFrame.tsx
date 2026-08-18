import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./AppFrame.module.css";

interface ColumnSizes {
  readonly sidebar: number;
  readonly details: number;
}
interface AppFrameProps {
  readonly sidebar: ReactNode;
  readonly center: ReactNode;
  readonly details: ReactNode;
  readonly detailsVisible: boolean;
}
const MIN_SIDEBAR = 264,
  MAX_SIDEBAR = 360,
  DEFAULT_SIDEBAR = 280,
  COLLAPSED_SIDEBAR = 52,
  MIN_DETAILS = 300,
  MAX_DETAILS = 480,
  DEFAULT_DETAILS = 340,
  CENTER_MIN = 620,
  NARROW_BREAKPOINT = 1040;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));
function columns(width: number, sizes: ColumnSizes, collapsed: boolean): ColumnSizes {
  const sidebar = collapsed ? COLLAPSED_SIDEBAR : clamp(sizes.sidebar, MIN_SIDEBAR, MAX_SIDEBAR);
  const details = clamp(sizes.details, MIN_DETAILS, MAX_DETAILS);
  if (sidebar + details + CENTER_MIN <= width) return { sidebar, details };
  return {
    sidebar,
    details: sidebar + CENTER_MIN < width ? Math.max(MIN_DETAILS, width - sidebar - CENTER_MIN) : 0,
  };
}

export function AppFrame({ sidebar, center, details, detailsVisible }: AppFrameProps): JSX.Element {
  const [sizes, setSizes] = useState<ColumnSizes>({
    sidebar: DEFAULT_SIDEBAR,
    details: DEFAULT_DETAILS,
  });
  const [width, setWidth] = useState(typeof window === "undefined" ? 1440 : window.innerWidth);
  const [collapsed, setCollapsed] = useState(
    typeof window === "undefined" ? false : window.innerWidth < NARROW_BREAKPOINT,
  );
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const resize = () => {
      if (raf.current !== null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setWidth(window.innerWidth);
      });
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);
  const computed = columns(width, sizes, collapsed);
  const tracks = detailsVisible ? computed : { ...computed, details: 0 };
  const drag = useCallback(
    (side: "sidebar" | "details") => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const target = event.currentTarget,
        x = event.clientX,
        start = side === "sidebar" ? sizes.sidebar : sizes.details;
      target.setPointerCapture(event.pointerId);
      const move = (next: PointerEvent) =>
        setSizes((previous) => ({
          ...previous,
          [side]: clamp(
            start + (side === "sidebar" ? next.clientX - x : x - next.clientX),
            side === "sidebar" ? MIN_SIDEBAR : MIN_DETAILS,
            side === "sidebar" ? MAX_SIDEBAR : MAX_DETAILS,
          ),
        }));
      const up = (next: PointerEvent) => {
        if (target.hasPointerCapture(next.pointerId)) target.releasePointerCapture(next.pointerId);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [sizes],
  );
  return (
    <div
      className={styles.frame}
      style={{ gridTemplateColumns: `${tracks.sidebar}px minmax(0, 1fr) ${tracks.details}px` }}
    >
      <aside className={styles.sidebar} data-collapsed={collapsed || undefined}>
        <div className={styles.sidebarContent}>{sidebar}</div>
        <button
          type="button"
          className={styles.sidebarToggle}
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? "›" : "‹"}
        </button>
        {!collapsed && (
          <div
            className={styles.dragHandle}
            onPointerDown={drag("sidebar")}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整侧边栏"
          />
        )}
      </aside>
      <main className={styles.center}>{center}</main>
      {tracks.details > 0 && (
        <aside className={styles.details}>
          <div
            className={styles.dragHandleLeft}
            onPointerDown={drag("details")}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整详情面板"
          />
          {details}
        </aside>
      )}
      {collapsed && <div className={styles.railMark}>C</div>}
    </div>
  );
}
