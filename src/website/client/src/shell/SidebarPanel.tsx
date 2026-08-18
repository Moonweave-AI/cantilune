import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconChatPlus,
  IconCheck,
  IconChevronDown,
  IconDots,
  IconFolder,
  IconFolderPlus,
  IconPanelLeft,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSliders,
  IconTrash,
} from "../theme/icons";
import { LunarLogo } from "../theme/LunarLogo";
import type { ConnectionStatus } from "../ws/useBridge";
import { formatRelativeTime } from "../persist/time";
import type { GroupBy, OrderBy, SessionSummary, WorkspaceSummary } from "../persist/store";
import styles from "./SidebarPanel.module.css";

export type { SessionSummary, WorkspaceSummary };

interface SidebarPanelProps {
  readonly collapsed: boolean;
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly sessions: readonly SessionSummary[];
  readonly activeSessionId: string;
  readonly workspaces: readonly WorkspaceSummary[];
  readonly activeWorkspaceId: string;
  readonly groupBy: GroupBy;
  readonly orderBy: OrderBy;
  readonly collapsedWorkspaceIds: readonly string[];
  readonly onToggle: () => void;
  readonly onNewSession: (workspaceId?: string) => void;
  readonly onSelectSession: (id: string) => void;
  readonly onSettings: () => void;
  readonly onRenameWorkspace: (id: string, name: string) => void;
  readonly onDeleteWorkspace: (id: string) => void;
  readonly onSelectWorkspace: (id: string) => void;
  readonly onToggleWorkspace: (id: string) => void;
  readonly onGroupByChange: (mode: GroupBy) => void;
  readonly onOrderByChange: (mode: OrderBy) => void;
  readonly onDeleteSession: (id: string) => void;
  readonly onPickDirectory: () => void;
}

const SETTLE_MS = 150;

export function SidebarPanel(props: SidebarPanelProps): JSX.Element {
  const {
    collapsed,
    configured,
    connectionStatus,
    sessions,
    activeSessionId,
    workspaces,
    activeWorkspaceId,
    groupBy,
    orderBy,
    collapsedWorkspaceIds,
    onToggle,
    onNewSession,
    onSelectSession,
    onSettings,
    onRenameWorkspace,
    onDeleteWorkspace,
    onSelectWorkspace,
    onToggleWorkspace,
    onGroupByChange,
    onOrderByChange,
    onDeleteSession,
    onPickDirectory,
  } = props;
  const [settled, setSettled] = useState(collapsed);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) {
      setSettled(false);
      return;
    }
    const timer = window.setTimeout(() => setSettled(true), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [collapsed]);

  useEffect(() => {
    if (!sortOpen && menuId === null) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (sortRef.current?.contains(target) === true) return;
      if (target instanceof Element && target.closest("[data-workspace-menu]") !== null) return;
      setSortOpen(false);
      setMenuId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuId, sortOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const wide = !collapsed || !settled;
  const needle = query.trim().toLowerCase();
  const visibleSessions = useMemo(() => {
    const filtered =
      needle.length === 0
        ? [...sessions]
        : sessions.filter((session) => session.title.toLowerCase().includes(needle));
    if (orderBy === "updated") {
      filtered.sort((a, b) => b.updatedAtMs - a.updatedAtMs || (a.id < b.id ? -1 : 1));
    }
    return filtered;
  }, [needle, orderBy, sessions]);

  const expandThen = (action: () => void) => {
    if (collapsed) onToggle();
    action();
  };

  return (
    <aside
      className={`${styles.root}${wide ? "" : ` ${styles.collapsed ?? ""}`}${collapsed && wide ? ` ${styles.fading ?? ""}` : ""}`}
      aria-label="会话与工作区"
      data-collapsed={wide ? undefined : true}
    >
      <div className={styles.logoRow}>
        {wide && (
          <button
            type="button"
            className={styles.brand}
            onClick={() => onNewSession()}
            aria-label="新建会话"
          >
            <LunarLogo size={22} />
            <span>Cantilune</span>
            <em>HARNESS</em>
          </button>
        )}
        <button
          type="button"
          className={styles.toggle}
          onClick={onToggle}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {!wide && <LunarLogo size={22} />}
          <IconPanelLeft className={styles.panelIcon} size={wide ? 16 : 18} />
        </button>
      </div>

      <button
        type="button"
        className={styles.newSession}
        onClick={() => onNewSession()}
        aria-label="新会话"
      >
        {wide ? <IconPlus size={14} /> : <IconChatPlus size={18} />}
        {wide && <span>新会话</span>}
      </button>

      {!wide && (
        <div className={styles.railActions}>
          <button
            type="button"
            className={styles.railBtn}
            aria-label="添加工作区"
            title="Select Workspace Directory"
            onClick={() => onPickDirectory()}
          >
            <IconFolderPlus size={18} />
          </button>
          <button
            type="button"
            className={styles.railBtn}
            aria-label="搜索会话"
            title="搜索会话"
            onClick={() =>
              expandThen(() => {
                setSearchOpen(true);
              })
            }
          >
            <IconSearch size={18} />
          </button>
        </div>
      )}

      <div className={styles.region}>
        {wide && (
          <>
            <section className={styles.workspaceSection}>
              <header className={styles.sectionHead}>
                <span>工作区</span>
                <div>
                  <button
                    type="button"
                    className={searchOpen ? styles.iconBtnActive : styles.iconBtn}
                    aria-label="搜索会话"
                    title="搜索会话"
                    aria-pressed={searchOpen}
                    onClick={() => setSearchOpen((value) => !value)}
                  >
                    <IconSearch size={14} />
                  </button>
                  <div ref={sortRef} className={styles.sortWrap}>
                    <button
                      type="button"
                      className={sortOpen ? styles.iconBtnActive : styles.iconBtn}
                      aria-label="分组与排序"
                      title="分组与排序"
                      aria-expanded={sortOpen}
                      onClick={() => setSortOpen((value) => !value)}
                    >
                      <IconSliders size={14} />
                    </button>
                    {sortOpen && (
                      <div className={styles.sortMenu} role="menu">
                        <p>分组方式</p>
                        <SortItem
                          label="按工作区"
                          selected={groupBy === "workspace"}
                          onClick={() => onGroupByChange("workspace")}
                        />
                        <SortItem
                          label="单列表"
                          selected={groupBy === "flat"}
                          onClick={() => onGroupByChange("flat")}
                        />
                        <hr />
                        <p>排序方式</p>
                        <SortItem
                          label="手动排序"
                          selected={orderBy === "manual"}
                          onClick={() => onOrderByChange("manual")}
                        />
                        <SortItem
                          label="最近更新"
                          selected={orderBy === "updated"}
                          onClick={() => onOrderByChange("updated")}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label="添加工作区"
                    title="Select Workspace Directory"
                    onClick={onPickDirectory}
                  >
                    <IconFolderPlus size={14} />
                  </button>
                </div>
              </header>
              {searchOpen && (
                <label className={styles.search}>
                  <IconSearch size={14} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索会话…"
                    aria-label="搜索会话"
                  />
                  {query.length > 0 && (
                    <button type="button" aria-label="清除" onClick={() => setQuery("")}>
                      ×
                    </button>
                  )}
                </label>
              )}
            </section>
            <section className={styles.sessionSection}>
              <div className={styles.sessionList} role="listbox" aria-label="会话列表">
                {groupBy === "flat"
                  ? visibleSessions.map((session) => (
                      <SessionRow
                        key={session.id}
                        session={session}
                        active={session.id === activeSessionId}
                        onSelect={onSelectSession}
                        onDelete={onDeleteSession}
                      />
                    ))
                  : workspaces.map((item) => {
                      const open = !collapsedWorkspaceIds.includes(item.id);
                      const owned = visibleSessions.filter(
                        (session) => session.workspaceId === item.id,
                      );
                      return (
                        <div key={item.id} className={styles.group}>
                          <div
                            className={
                              item.id === activeWorkspaceId
                                ? styles.workspaceActive
                                : styles.workspace
                            }
                          >
                            <button
                              type="button"
                              className={styles.workspaceMain}
                              onClick={() => {
                                onSelectWorkspace(item.id);
                                onToggleWorkspace(item.id);
                              }}
                            >
                              <span
                                className={open ? styles.groupChevronOpen : styles.groupChevron}
                              >
                                <IconChevronDown size={12} />
                              </span>
                              <span className={styles.folder}>
                                <IconFolder size={15} />
                              </span>
                              {renameId === item.id ? (
                                <input
                                  className={styles.rename}
                                  value={renameValue}
                                  autoFocus
                                  onChange={(event) => setRenameValue(event.target.value)}
                                  onClick={(event) => event.stopPropagation()}
                                  onBlur={() => {
                                    const next = renameValue.trim();
                                    if (next.length > 0) onRenameWorkspace(item.id, next);
                                    setRenameId(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") event.currentTarget.blur();
                                    if (event.key === "Escape") setRenameId(null);
                                  }}
                                />
                              ) : (
                                <span className={styles.workspaceName}>{item.name}</span>
                              )}
                            </button>
                            <button
                              type="button"
                              className={styles.rowIcon}
                              aria-label={`在 ${item.name} 新建会话`}
                              onClick={() => onNewSession(item.id)}
                            >
                              <IconPlus size={14} />
                            </button>
                            <button
                              type="button"
                              className={styles.rowIcon}
                              data-workspace-menu=""
                              aria-label={`${item.name} 菜单`}
                              onClick={() => setMenuId((current) => (current === item.id ? null : item.id))}
                            >
                              <IconDots size={14} />
                            </button>
                            {menuId === item.id && (
                              <div className={styles.contextMenu} data-workspace-menu="" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setRenameId(item.id);
                                    setRenameValue(item.name);
                                    setMenuId(null);
                                  }}
                                >
                                  <IconPencil size={14} />
                                  重命名
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className={styles.danger}
                                  disabled={workspaces.length <= 1}
                                  onClick={() => {
                                    onDeleteWorkspace(item.id);
                                    setMenuId(null);
                                  }}
                                >
                                  <IconTrash size={14} />
                                  删除工作区
                                </button>
                              </div>
                            )}
                          </div>
                          {open &&
                            owned.map((session) => (
                              <SessionRow
                                key={session.id}
                                session={session}
                                active={session.id === activeSessionId}
                                nested
                                onSelect={onSelectSession}
                                onDelete={onDeleteSession}
                              />
                            ))}
                        </div>
                      );
                    })}
              </div>
            </section>
          </>
        )}
      </div>

      <div className={styles.foot}>
        {wide && (
          <span
            className={styles.runtime}
            data-ready={configured || undefined}
            data-status={connectionStatus}
          >
            <i />
            {configured ? "运行时已连接" : "尚未连接模型"}
          </span>
        )}
        <button
          type="button"
          className={wide ? styles.settings : styles.settingsRail}
          onClick={onSettings}
          aria-label="设置"
          aria-haspopup="dialog"
        >
          <IconSettings size={wide ? 14 : 16} />
          {wide && <span>设置</span>}
        </button>
      </div>
    </aside>
  );
}

function SortItem({
  label,
  selected,
  onClick,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" role="menuitem" className={styles.sortItem} onClick={onClick}>
      <span>{label}</span>
      {selected && <IconCheck size={14} />}
    </button>
  );
}

function SessionRow({
  session,
  active,
  nested = false,
  onSelect,
  onDelete,
}: {
  readonly session: SessionSummary;
  readonly active: boolean;
  readonly nested?: boolean;
  readonly onSelect: (id: string) => void;
  readonly onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <div
      className={`${active ? styles.sessionActive : styles.session}${nested ? ` ${styles.sessionNested ?? ""}` : ""}`}
    >
      <button
        type="button"
        role="option"
        aria-selected={active}
        className={styles.sessionMain}
        onClick={() => onSelect(session.id)}
        title={session.title}
      >
        <span className={styles.sessionTitle}>{session.title}</span>
        <small>{formatRelativeTime(session.updatedAtMs)}</small>
      </button>
      <button
        type="button"
        className={styles.sessionDelete}
        aria-label={`删除 ${session.title}`}
        title="删除会话"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(session.id);
        }}
      >
        <IconTrash size={13} />
      </button>
    </div>
  );
}
