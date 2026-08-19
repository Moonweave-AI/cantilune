import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  clampWidth,
  computeColumns,
  DETAILS_DEFAULT,
  DETAILS_MAX,
  DETAILS_MIN,
  SIDEBAR_AUTO_COLLAPSE,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
} from "./columns";
import styles from "./AppFrame.module.css";

export interface AppFrameSidebarParams {
  readonly collapsed: boolean;
  readonly width: number;
  readonly onToggle: () => void;
}

interface AppFrameProps {
  readonly sidebar: (params: AppFrameSidebarParams) => ReactNode;
  readonly center: ReactNode;
  readonly details: ReactNode;
  readonly overlay?: ReactNode;
  readonly banner?: ReactNode;
  readonly detailsOpen: boolean;
}

function DragHandle({
  side,
  left,
  onStart,
  onDrag,
  onEnd,
}: {
  readonly side: "sidebar" | "details";
  readonly left: number;
  readonly onStart: () => void;
  readonly onDrag: (dx: number) => void;
  readonly onEnd: () => void;
}): JSX.Element {
  const [dragging, setDragging] = useState(false);
  const origin = useRef(0);
  const latest = useRef(0);
  const frame = useRef<number | null>(null);
  const callbacks = useRef({ onStart, onDrag, onEnd });
  callbacks.current = { onStart, onDrag, onEnd };

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    origin.current = event.clientX;
    latest.current = event.clientX;
    callbacks.current.onStart();
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    latest.current = event.clientX;
    frame.current ??= requestAnimationFrame(() => {
      frame.current = null;
      callbacks.current.onDrag(latest.current - origin.current);
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    callbacks.current.onDrag(latest.current - origin.current);
    setDragging(false);
    callbacks.current.onEnd();
  }, []);

  return (
    <div
      className={styles.handle}
      style={{ left }}
      data-side={side}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "sidebar" ? "调整侧边栏" : "调整详情面板"}
    />
  );
}

export function AppFrame({
  sidebar,
  center,
  details,
  overlay,
  banner,
  detailsOpen,
}: AppFrameProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState(
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [sidebarPref, setSidebarPref] = useState(SIDEBAR_DEFAULT);
  const [detailsPref, setDetailsPref] = useState(DETAILS_DEFAULT);
  const [narrowExpanded, setNarrowExpanded] = useState(false);
  const [wideCollapsed, setWideCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = frameRef.current;
    if (el === null) return;
    let raf: number | null = null;
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null;
        const width = el.getBoundingClientRect().width;
        if (width > 0) setViewport(width);
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
  const sidebarCollapsed = narrow ? !narrowExpanded : wideCollapsed;
  const sidebarPreference = sidebarCollapsed
    ? 0
    : sidebarPref === 0
      ? SIDEBAR_DEFAULT
      : sidebarPref;
  const cols = computeColumns(viewport, sidebarPreference, detailsOpen ? detailsPref : 0);
  const detailsDrawerOpen = detailsOpen && cols.details === 0;
  const colsRef = useRef(cols);
  colsRef.current = cols;

  const sidebarBase = useRef(0);
  const detailsBase = useRef(0);
  const onDragEnd = useCallback(() => setDragging(false), []);
  const onSidebarStart = useCallback(() => {
    sidebarBase.current = colsRef.current.sidebar;
    setDragging(true);
  }, []);
  const onDetailsStart = useCallback(() => {
    detailsBase.current = colsRef.current.details;
    setDragging(true);
  }, []);
  const onSidebarDrag = useCallback((dx: number) => {
    setSidebarPref(clampWidth(sidebarBase.current + dx, SIDEBAR_MIN, SIDEBAR_MAX));
  }, []);
  const onDetailsDrag = useCallback((dx: number) => {
    setDetailsPref(clampWidth(detailsBase.current - dx, DETAILS_MIN, DETAILS_MAX));
  }, []);

  const onToggle = useCallback(() => {
    if (narrow) setNarrowExpanded((value) => !value);
    else setWideCollapsed((value) => !value);
  }, [narrow]);

  return (
    <div
      ref={frameRef}
      className={styles.frame}
      style={{ gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px` }}
      data-sidebar-collapsed={sidebarCollapsed || undefined}
      data-details-collapsed={cols.details === 0 || undefined}
      data-dragging={dragging || undefined}
    >
      <div className={styles.sidebarCol}>
        {sidebar({ collapsed: sidebarCollapsed, width: cols.sidebar, onToggle })}
      </div>
      <div className={styles.centerCol}>
        {banner}
        {center}
      </div>
      <div className={styles.detailsCol}>{!detailsDrawerOpen && details}</div>
      {detailsDrawerOpen && <div className={styles.detailsDrawer}>{details}</div>}
      <div className={styles.overlayLayer} data-shell-overlay="">
        {overlay}
      </div>
      {!sidebarCollapsed && (
        <DragHandle
          side="sidebar"
          left={cols.sidebar}
          onStart={onSidebarStart}
          onDrag={onSidebarDrag}
          onEnd={onDragEnd}
        />
      )}
      {cols.details > 0 && (
        <DragHandle
          side="details"
          left={viewport - cols.details}
          onStart={onDetailsStart}
          onDrag={onDetailsDrag}
          onEnd={onDragEnd}
        />
      )}
    </div>
  );
}
