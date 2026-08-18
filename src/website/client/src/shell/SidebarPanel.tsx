import { useState } from "react";
import { LunarLogo } from "../theme/LunarLogo";
import type { ConnectionStatus } from "../ws/useBridge";
import styles from "./SidebarPanel.module.css";

export interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface WorkspaceSummary {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

interface SidebarPanelProps {
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly sessions: readonly SessionSummary[];
  readonly activeSessionId: string;
  readonly workspace: WorkspaceSummary;
  readonly onNewSession: () => void;
  readonly onSelectSession: (id: string) => void;
  readonly onSettings: () => void;
  readonly onAddWorkspace: (name: string, path: string) => void;
}

export function SidebarPanel({
  configured,
  connectionStatus,
  sessions,
  activeSessionId,
  workspace,
  onNewSession,
  onSelectSession,
  onSettings,
  onAddWorkspace,
}: SidebarPanelProps): JSX.Element {
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspacePath, setWorkspacePath] = useState("");
  const addWorkspace = () => {
    const name = workspaceName.trim();
    const path = workspacePath.trim();
    if (name.length === 0 || path.length === 0) return;
    onAddWorkspace(name, path);
    setWorkspaceName("");
    setWorkspacePath("");
    setAddingWorkspace(false);
  };

  return (
    <aside className={styles.root} aria-label="会话与工作区">
      <header className={styles.brandRow}>
        <button type="button" className={styles.brand} onClick={onNewSession} aria-label="新建会话">
          <LunarLogo size={22} />
          <span>Cantilune</span>
          <em>HARNESS</em>
        </button>
        <span className={styles.status} data-status={connectionStatus} title={connectionStatus} />
      </header>

      <button type="button" className={styles.newSession} onClick={onNewSession}>
        <span>⊕</span> 新会话
      </button>

      <section className={styles.workspaceSection}>
        <header className={styles.sectionHead}>
          <span>工作区</span>
          <div>
            <button type="button" aria-label="搜索工作区" title="搜索工作区">
              ⌕
            </button>
            <button
              type="button"
              aria-label="添加工作区"
              title="添加工作区"
              onClick={() => setAddingWorkspace((value) => !value)}
            >
              ＋
            </button>
          </div>
        </header>
        <button
          type="button"
          className={styles.workspace}
          onClick={() => setAddingWorkspace((value) => !value)}
        >
          <span className={styles.folder}>⌁</span>
          <span className={styles.workspaceName}>{workspace.name}</span>
        </button>
        {addingWorkspace && (
          <div className={styles.workspaceForm}>
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              placeholder="名称"
              aria-label="Workspace name"
            />
            <input
              value={workspacePath}
              onChange={(event) => setWorkspacePath(event.target.value)}
              placeholder="绝对路径"
              aria-label="Workspace path"
            />
            <button type="button" onClick={addWorkspace}>
              添加并在下次连接时使用
            </button>
          </div>
        )}
      </section>

      <section className={styles.sessionSection}>
        <div className={styles.sessionList} role="listbox" aria-label="会话列表">
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              role="option"
              aria-selected={session.id === activeSessionId}
              className={session.id === activeSessionId ? styles.sessionActive : styles.session}
              onClick={() => onSelectSession(session.id)}
              title={session.title}
            >
              <span className={styles.sessionTitle}>{session.title}</span>
              <small>{session.updatedAt}</small>
            </button>
          ))}
        </div>
      </section>

      <div className={styles.foot}>
        <span className={styles.runtime} data-ready={configured || undefined}>
          <i />
          {configured ? "运行时已连接" : "尚未连接模型"}
        </span>
        <button type="button" className={styles.settings} onClick={onSettings}>
          <span>⚙</span> 设置
        </button>
      </div>
    </aside>
  );
}
