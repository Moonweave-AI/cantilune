import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { CatalogEntry } from "../persist/store";
import { IconCheck, IconChevronDown, IconPlus, IconSend, IconStop } from "../theme/icons";
import { ContextMeter } from "./ContextMeter";
import { PermissionSelect, type RunMode } from "./PermissionSelect";
import styles from "./Composer.module.css";

interface ComposerProps {
  readonly configured: boolean;
  readonly running: boolean;
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly catalog: readonly CatalogEntry[];
  readonly hero: boolean;
  readonly overlay: boolean;
  readonly mode: RunMode;
  readonly usedTokens: number;
  readonly contextWindowTokens: number;
  readonly outputReserveTokens: number;
  readonly contextEstimated: boolean;
  readonly contextEstimateSource?: "heuristic" | "provider_usage";
  readonly prunedToolResults: number;
  readonly summarizedMessages: number;
  readonly turns: number;
  readonly steps: number;
  readonly workspaceName: string;
  readonly onModeChange: (mode: RunMode) => void;
  readonly onSend: (instruction: string) => void;
  readonly onStop: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenModelSettings: () => void;
  readonly onSelectModel: (entry: CatalogEntry) => void;
  readonly onNewSession: () => void;
  readonly onDownloadLog: () => void;
}

const SLASH = [
  ["new", "新会话", "开启一条空白会话"],
  ["model", "模型", "打开模型与接口设置"],
  ["export", "导出", "导出会话日志"],
  ["plan", "Plan", "切换到 Plan 权限"],
  ["permission", "权限", "循环 Full access / Plan / Read only"],
] as const;

export function Composer(props: ComposerProps): JSX.Element {
  const {
    configured,
    running,
    provider,
    model,
    catalog,
    hero,
    overlay,
    mode,
    usedTokens,
    contextWindowTokens,
    outputReserveTokens,
    contextEstimated,
    contextEstimateSource,
    prunedToolResults,
    summarizedMessages,
    turns,
    steps,
    workspaceName,
    onModeChange,
    onSend,
    onStop,
    onOpenSettings,
    onOpenModelSettings,
    onSelectModel,
    onNewSession,
    onDownloadLog,
  } = props;
  const [value, setValue] = useState("");
  const [composing, setComposing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inert = !configured;
  const empty = value.trim().length === 0;
  const slashQuery = value.startsWith("/") ? value.slice(1).trim().toLowerCase() : null;
  const slashItems = useMemo(() => {
    if (slashQuery === null) return [];
    return SLASH.filter(
      ([id, label]) =>
        slashQuery.length === 0 || id.includes(slashQuery) || label.includes(slashQuery),
    );
  }, [slashQuery]);
  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, CatalogEntry[]>();
    for (const entry of catalog) {
      if (entry.model.trim().length === 0) continue;
      const list = groups.get(entry.provider) ?? [];
      list.push(entry);
      groups.set(entry.provider, list);
    }
    return [...groups.entries()];
  }, [catalog]);
  const modelLabel =
    catalog.find((entry) => entry.provider === provider && entry.model === model)?.label ??
    model ??
    provider ??
    "选择模型";

  useEffect(() => {
    setSlashIndex(0);
  }, [slashQuery]);

  useEffect(() => {
    if (!menuOpen && !modelOpen) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) === true) return;
      if (modelRef.current?.contains(target) === true) return;
      setMenuOpen(false);
      setModelOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen, modelOpen]);

  const runSlash = (id: (typeof SLASH)[number][0]) => {
    setValue("");
    setMenuOpen(false);
    if (id === "new") onNewSession();
    if (id === "model") onOpenModelSettings();
    if (id === "export") onDownloadLog();
    if (id === "plan") onModeChange("plan");
    if (id === "permission") {
      const next = mode === "execute" ? "plan" : mode === "plan" ? "observe" : "execute";
      onModeChange(next);
    }
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const instruction = value.trim();
    if (slashItems.length > 0 && instruction.startsWith("/")) {
      const picked = slashItems[slashIndex] ?? slashItems[0];
      if (picked !== undefined) runSlash(picked[0]);
      return;
    }
    if (composing || instruction.length === 0 || running || inert) return;
    onSend(instruction);
    setValue("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (inert) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpenSettings();
      }
      return;
    }
    if (slashItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSlashIndex((index) => (index + 1) % slashItems.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSlashIndex((index) => (index - 1 + slashItems.length) % slashItems.length);
        return;
      }
      if (
        event.key === "Tab" ||
        (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey)
      ) {
        event.preventDefault();
        const picked = slashItems[slashIndex] ?? slashItems[0];
        if (picked !== undefined) runSlash(picked[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setValue("");
        return;
      }
    }
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    const composingNow =
      composing || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
    if (composingNow) return;
    event.preventDefault();
    if (!event.repeat) submit();
  };

  return (
    <div
      className={`${styles.root} ${hero ? styles.hero : ""}`}
      data-composer-overlay={overlay || undefined}
    >
      {slashItems.length > 0 && (
        <div className={styles.slash} role="listbox" aria-label="命令">
          <p>命令</p>
          {slashItems.map(([id, label, hint], index) => (
            <button
              type="button"
              key={id}
              role="option"
              aria-selected={index === slashIndex}
              className={index === slashIndex ? styles.slashActive : styles.slashItem}
              onMouseEnter={() => setSlashIndex(index)}
              onClick={() => runSlash(id)}
            >
              <code>/{id}</code>
              <span>{hint.length > 0 ? hint : label}</span>
            </button>
          ))}
        </div>
      )}
      <form
        className={`${styles.card} ${inert ? styles.cardInert : ""}`}
        data-composer-card=""
        onSubmit={submit}
        onClick={inert ? onOpenSettings : undefined}
      >
        <textarea
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          onKeyDown={onKeyDown}
          placeholder={
            inert ? "请先在设置中连接模型" : hero ? "描述你想要构建的内容" : "给智能体发送消息"
          }
          disabled={false}
          readOnly={inert || running}
          rows={2}
          aria-label={inert ? "连接模型" : "Instruction input"}
        />
        <div className={styles.row}>
          <div className={styles.tools}>
            <div ref={menuRef} className={styles.menuWrap}>
              <button
                type="button"
                className={styles.add}
                aria-label="命令"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={inert}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <IconPlus size={14} />
              </button>
              {menuOpen && (
                <div className={styles.menu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setValue("/");
                      inputRef.current?.focus();
                    }}
                  >
                    命令
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNewSession();
                    }}
                  >
                    新会话
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings();
                    }}
                  >
                    设置
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDownloadLog();
                    }}
                  >
                    导出会话日志
                  </button>
                </div>
              )}
            </div>
            <PermissionSelect value={mode} locked={inert} onChange={onModeChange} />
          </div>
          <div className={styles.trailing}>
            <div ref={modelRef} className={styles.menuWrap}>
              <button
                type="button"
                className={styles.modelSeat}
                title={workspaceName}
                disabled={inert}
                aria-haspopup="listbox"
                aria-expanded={modelOpen}
                onClick={() => {
                  if (groupedCatalog.length === 0) {
                    onOpenModelSettings();
                    return;
                  }
                  setModelOpen((open) => !open);
                }}
              >
                <span>{modelLabel}</span>
                <IconChevronDown size={12} />
              </button>
              {modelOpen && (
                <div className={styles.modelMenu} role="listbox" aria-label="模型目录">
                  {groupedCatalog.map(([group, entries]) => (
                    <div key={group}>
                      <p className={styles.modelGroup}>{group}</p>
                      {entries.map((entry) => {
                        const active = entry.provider === provider && entry.model === model;
                        return (
                          <button
                            type="button"
                            key={entry.id}
                            role="option"
                            aria-selected={active}
                            className={active ? styles.modelItemActive : styles.modelItem}
                            onClick={() => {
                              setModelOpen(false);
                              onSelectModel(entry);
                            }}
                          >
                            <span>{entry.label.length > 0 ? entry.label : entry.model}</span>
                            {active && <IconCheck size={14} />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.modelManage}
                    onClick={() => {
                      setModelOpen(false);
                      onOpenModelSettings();
                    }}
                  >
                    管理模型目录…
                  </button>
                </div>
              )}
            </div>
            <ContextMeter
              usedTokens={usedTokens}
              contextWindowTokens={contextWindowTokens}
              outputReserveTokens={outputReserveTokens}
              estimated={contextEstimated}
              {...(contextEstimateSource === undefined
                ? {}
                : { estimateSource: contextEstimateSource })}
              prunedToolResults={prunedToolResults}
              summarizedMessages={summarizedMessages}
            />
            {running ? (
              <button
                type="button"
                className={styles.primary}
                onClick={onStop}
                aria-label="停止运行"
              >
                <IconStop size={18} />
              </button>
            ) : (
              <button
                type="submit"
                className={styles.primary}
                disabled={empty || inert}
                aria-label="发送消息"
              >
                <IconSend size={20} />
              </button>
            )}
          </div>
        </div>
      </form>
      {!hero && (
        <div className={styles.dock}>
          {running
            ? "Agent 正在运行…"
            : `${Math.max(turns, 0)} 轮 · ${steps} 步 · Shift+Enter 换行 · Ctrl+Enter 发送`}
        </div>
      )}
    </div>
  );
}
