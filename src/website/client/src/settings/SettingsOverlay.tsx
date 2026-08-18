import { useState, type ReactNode } from "react";
import type { ConfigureRequest } from "@shared/protocol";
import {
  ConfigPanel,
  type ConfigPresetDefaults,
  type ProviderEntryWire,
} from "../config/ConfigPanel";
import type { ConnectionStatus } from "../ws/useBridge";
import styles from "./SettingsOverlay.module.css";

export type SettingsTab = "general" | "models" | "plugins" | "presets";
type ThemePreference = "dark" | "light" | "system";

interface SettingsOverlayProps {
  readonly providers: readonly ProviderEntryWire[];
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly theme: ThemePreference;
  readonly activeTab: SettingsTab;
  readonly preset: ConfigPresetDefaults | undefined;
  readonly workspacePath: string;
  readonly onTabChange: (tab: SettingsTab) => void;
  readonly onClose: () => void;
  readonly onThemeChange: (theme: ThemePreference) => void;
  readonly onConfigure: (request: ConfigureRequest) => void;
  readonly onNewSession: () => void;
  readonly onDownloadLog: () => void;
  readonly onApplyPreset: (preset: ConfigPresetDefaults) => void;
}

const TEXT = {
  settings: "\u8bbe\u7f6e",
  general: "\u901a\u7528\u8bbe\u7f6e",
  models: "\u6a21\u578b",
  plugins: "\u63d2\u4ef6",
  presets: "Agent \u9884\u8bbe",
  exportLog: "\u5bfc\u51fa\u4f1a\u8bdd\u65e5\u5fd7",
  standard: "\u6807\u51c6\u6a21\u5f0f",
  light: "\u6d45\u8272",
  dark: "\u6df1\u8272",
  system: "\u8ddf\u968f\u7cfb\u7edf",
  current: "\u5f53\u524d\u4f7f\u7528",
  apply: "\u5e94\u7528",
} as const;

const tabs: readonly { readonly id: SettingsTab; readonly label: string; readonly icon: string }[] =
  [
    { id: "general", label: TEXT.general, icon: "[ ]" },
    { id: "models", label: TEXT.models, icon: "( )" },
    { id: "plugins", label: TEXT.plugins, icon: "=" },
    { id: "presets", label: TEXT.presets, icon: "*" },
  ];

const presets = [
  [
    TEXT.standard,
    "\u529f\u80fd\u5b8c\u6574\u7684\u901a\u7528 Agent\uff0c\u652f\u6301\u6587\u4ef6\u7f16\u8f91\u3001Shell\u3001\u7f51\u9875\u641c\u7d22\u548c\u591a\u8f6e\u5de5\u5177\u8c03\u7528\u3002",
    "openai",
    "gpt-4o",
    100,
  ],
  [
    "DeepSeek \u5feb\u901f",
    "\u4ee5 DeepSeek OpenAI-compatible \u63a5\u53e3\u4e3a\u9ed8\u8ba4\u76ee\u6807\uff0c\u9002\u5408\u4f4e\u5ef6\u8fdf\u7684\u4efb\u52a1\u6267\u884c\u3002",
    "deepseek",
    "deepseek-chat",
    80,
  ],
  [
    "\u96c6\u7fa4\u534f\u8c03",
    "\u4e3a\u591a Agent \u89c4\u5212\u3001\u9a8c\u8bc1\u548c\u53cd\u9988\u73af\u9884\u7559\u66f4\u9ad8\u7684\u56de\u5408\u9884\u7b97\u3002",
    "openai",
    "gpt-4o",
    180,
  ],
  [
    "\u6781\u7b80\u6a21\u5f0f",
    "\u9650\u5236\u53ef\u7528\u5de5\u5177\uff0c\u4fdd\u7559\u4e00\u6b21\u6e05\u6670\u7684\u4efb\u52a1\u5faa\u73af\u3002",
    "deepseek",
    "deepseek-chat",
    40,
  ],
] as const;

export function SettingsOverlay(props: SettingsOverlayProps): JSX.Element {
  const {
    providers,
    configured,
    connectionStatus,
    theme,
    activeTab,
    preset,
    workspacePath,
    onTabChange,
    onClose,
    onThemeChange,
    onConfigure,
    onNewSession,
    onDownloadLog,
    onApplyPreset,
  } = props;
  return (
    <div className={styles.overlay} role="presentation">
      <section className={styles.panel} role="dialog" aria-modal="true" aria-label={TEXT.settings}>
        <aside className={styles.nav}>
          <h1>{TEXT.settings}</h1>
          <nav role="tablist">
            {tabs.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? styles.navActive : styles.navItem}
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className={styles.content}>
          <header className={styles.contentHead}>
            <div />
            <div className={styles.headerActions}>
              <button type="button" className={styles.export} onClick={onDownloadLog}>
                {TEXT.exportLog}
              </button>
              <button type="button" className={styles.close} onClick={onClose} aria-label="close">
                x
              </button>
            </div>
          </header>
          <div className={styles.options}>
            {activeTab === "general" && (
              <General
                theme={theme}
                configured={configured}
                connectionStatus={connectionStatus}
                onThemeChange={onThemeChange}
                onNewSession={onNewSession}
              />
            )}
            {activeTab === "models" && (
              <Models
                providers={providers}
                configured={configured}
                connectionStatus={connectionStatus}
                onConfigure={onConfigure}
                onNewSession={onNewSession}
                workspacePath={workspacePath}
                preset={preset}
              />
            )}
            {activeTab === "plugins" && <Plugins />}
            {activeTab === "presets" && <Presets onApply={onApplyPreset} />}
          </div>
        </main>
      </section>
    </div>
  );
}

function General({
  theme,
  configured,
  connectionStatus,
  onThemeChange,
  onNewSession,
}: {
  readonly theme: ThemePreference;
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly onThemeChange: (theme: ThemePreference) => void;
  readonly onNewSession: () => void;
}): JSX.Element {
  const rows = [
    [
      "Agent \u9884\u8bbe",
      "\u5bf9\u4e4b\u540e\u65b0\u5efa\u7684\u4f1a\u8bdd\u751f\u6548\u3002",
      TEXT.standard,
    ],
    [
      "\u6743\u9650",
      "\u9009\u62e9\u65b0\u4f1a\u8bdd\u9ed8\u8ba4\u7684\u6743\u9650\u6a21\u5f0f\u3002",
      "Full access",
    ],
    ["\u8bed\u8a00", undefined, "\u4e2d\u6587"],
  ] as const;
  return (
    <section className={styles.section}>
      <h2>{TEXT.general}</h2>
      <div className={styles.rows}>
        {rows.map(([label, hint, value]) => (
          <SettingRow key={label} label={label} hint={hint}>
            <button type="button" className={styles.selectLike}>
              {value} <span>v</span>
            </button>
          </SettingRow>
        ))}
        <div className={styles.appearance}>
          <strong>{"\u5916\u89c2"}</strong>
          <div className={styles.themeChoices}>
            {(
              [
                ["light", "o", TEXT.light],
                ["dark", "*", TEXT.dark],
                ["system", "-", TEXT.system],
              ] as const
            ).map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                className={theme === value ? styles.themeActive : styles.themeChoice}
                onClick={() => onThemeChange(value)}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
        <SettingRow
          label={"\u8fd0\u884c\u65f6\u8fde\u63a5"}
          hint={
            configured
              ? "\u5f53\u524d\u8fd0\u884c\u65f6\u5df2\u8fde\u63a5\uff0c\u53ef\u4ee5\u6267\u884c\u4efb\u52a1\u3002"
              : "\u5c1a\u672a\u8fde\u63a5\u6a21\u578b\uff1b\u8bf7\u5728\u6a21\u578b\u9875\u9762\u5b8c\u6210\u914d\u7f6e\u3002"
          }
        >
          <span className={styles.connection} data-status={connectionStatus}>
            {connectionStatus}
          </span>
        </SettingRow>
        <SettingRow
          label={"\u5f00\u59cb\u65b0\u7684\u4f1a\u8bdd"}
          hint={
            "\u4fdd\u7559\u5f53\u524d\u6a21\u578b\u914d\u7f6e\uff0c\u6e05\u7a7a\u8fd9\u4e2a\u4f1a\u8bdd\u7684\u6d88\u606f\u3002"
          }
        >
          <button type="button" className={styles.selectLike} onClick={onNewSession}>
            {"\u65b0\u4f1a\u8bdd"}
          </button>
        </SettingRow>
      </div>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className={styles.settingRow}>
      <div>
        <strong>{label}</strong>
        {hint !== undefined && <p>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Models({
  providers,
  configured,
  connectionStatus,
  onConfigure,
  onNewSession,
  workspacePath,
  preset,
}: {
  readonly providers: readonly ProviderEntryWire[];
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly onConfigure: (request: ConfigureRequest) => void;
  readonly onNewSession: () => void;
  readonly workspacePath: string;
  readonly preset: ConfigPresetDefaults | undefined;
}): JSX.Element {
  return (
    <section className={styles.section}>
      <h2>{TEXT.models}</h2>
      <p className={styles.lead}>
        {
          "\u586b\u5199\u6a21\u578b\u670d\u52a1\u5546\u7684 API \u5bc6\u94a5\u540e\uff0c\u5373\u53ef\u5728\u4f1a\u8bdd\u4e2d\u4f7f\u7528\u8be5\u6a21\u578b\u3002"
        }
      </p>
      <div className={styles.providerIntro}>
        <strong>{"\u5f53\u524d\u5de5\u4f5c\u533a"}</strong>
        <span>{workspacePath}</span>
      </div>
      <div className={styles.modelEditor}>
        <ConfigPanel
          providers={providers}
          configured={configured}
          connectionStatus={connectionStatus}
          onConfigure={onConfigure}
          onNewSession={onNewSession}
          workspacePath={workspacePath}
          showChrome={false}
          preset={preset}
        />
      </div>
    </section>
  );
}

function Plugins(): JSX.Element {
  const [tab, setTab] = useState<"config" | "list">("config");
  const cards = [
    ["\u7ec8\u7aef", "\u9650\u5236 Agent \u8fd0\u884c\u7684\u6bcf\u4e00\u6761\u547d\u4ee4\u3002"],
    [
      "Agent \u5faa\u73af",
      "Agent \u5982\u4f55\u6d3e\u53d1\u4e0e\u6062\u590d\u5de5\u5177\u8c03\u7528\u3002",
    ],
    [
      "\u7f51\u9875\u641c\u7d22",
      "\u4e3a\u8054\u7f51\u641c\u7d22\u914d\u7f6e\u670d\u52a1\u5546\u3002",
    ],
  ] as const;
  const list = [
    "filesystem",
    "shell",
    "web-search",
    "mcp",
    "content-store",
    "cluster",
    "swarm",
    "session-log",
    "runtime-observer",
    "tool-approval",
  ];
  return (
    <section className={styles.section}>
      <h2>{TEXT.plugins}</h2>
      <p className={styles.lead}>
        {"\u914d\u7f6e\u548c\u67e5\u770b\u672c\u5730\u90e8\u7f72\u7684\u63d2\u4ef6\u3002"}
      </p>
      <div className={styles.pluginTabs}>
        <button
          type="button"
          className={tab === "config" ? styles.pluginTabActive : styles.pluginTab}
          onClick={() => setTab("config")}
        >
          {"\u63d2\u4ef6\u914d\u7f6e"}
        </button>
        <button
          type="button"
          className={tab === "list" ? styles.pluginTabActive : styles.pluginTab}
          onClick={() => setTab("list")}
        >
          {"\u63d2\u4ef6\u5217\u8868"} <span>{list.length}</span>
        </button>
      </div>
      {tab === "config" ? (
        <div className={styles.pluginCards}>
          {cards.map(([name, text]) => (
            <details className={styles.pluginCard} key={name}>
              <summary>
                <div>
                  <strong>{name}</strong>
                  <p>{text}</p>
                </div>
                <span>v</span>
              </summary>
              <div className={styles.pluginDetails}>
                {
                  "\u6b64\u63d2\u4ef6\u7684\u6267\u884c\u7b56\u7565\u968f\u5f53\u524d runtime \u914d\u7f6e\u751f\u6548\u3002"
                }
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className={styles.pluginList}>
          {list.map((item) => (
            <div key={item}>
              <strong>{item}</strong>
              <span>
                <i /> {"\u5df2\u542f\u7528"}
              </span>
              <button type="button" aria-label={`${item} settings`}>
                v
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Presets({
  onApply,
}: {
  readonly onApply: (preset: ConfigPresetDefaults) => void;
}): JSX.Element {
  const [active, setActive] = useState<string>(TEXT.standard);
  return (
    <section className={styles.section}>
      <h2>{TEXT.presets}</h2>
      <p className={styles.lead}>
        {
          "\u9884\u8bbe\u5b9a\u4e49\u4e00\u6bb5\u4f1a\u8bdd\u7684 Agent \u6240\u8fd0\u884c\u7684\u63d2\u4ef6\u7ec4\u5408\u3001\u5de5\u5177\u3001\u63d0\u793a\u8bcd\u4e0e\u80fd\u529b\u3002"
        }
      </p>
      <div className={styles.presetCards}>
        {presets.map(([name, description, provider, model, maxTurns]) => (
          <article className={active === name ? styles.presetActive : styles.presetCard} key={name}>
            <div>
              <strong>{name}</strong>
              {active === name && <em>{TEXT.current}</em>}
            </div>
            <p>{description}</p>
            <small>
              {provider} - {model} - {maxTurns} turns
            </small>
            <footer>
              <code>{name.toLowerCase().replace(/\s+/g, "-")}</code>
              <button
                type="button"
                onClick={() => {
                  setActive(name);
                  onApply({ provider, model, maxTurns });
                }}
              >
                {TEXT.apply}
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
