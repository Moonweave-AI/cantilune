/**
 * ConfigPanel — ADR-0030 §3.3. The setup surface that replaces CLI /provider.
 * Lives in Settings. Sends `configure`; the server boots the OS. API keys are
 * held only in the current browser process and server configuration request.
 */

import { useEffect, useState } from "react";
import type { ConfigureRequest } from "@shared/protocol";
import type { CatalogEntry } from "../persist/store";
import { LunarLogo } from "../theme/LunarLogo";
import type { ConnectionStatus } from "../ws/useBridge";
import styles from "./ConfigPanel.module.css";

export interface ProviderEntryWire {
  readonly slug: string;
  readonly tier: string;
  readonly defaultBaseUrl: string;
  readonly envKeyName: string;
}

/** Used while the bridge's ready frame is still arriving or reconnecting. */
export const BUILTIN_PROVIDER_ENTRIES: readonly ProviderEntryWire[] = [
  {
    slug: "openai",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    envKeyName: "OPENAI_API_KEY",
  },
  {
    slug: "deepseek",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    envKeyName: "DEEPSEEK_API_KEY",
  },
  {
    slug: "anthropic",
    tier: "native",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    envKeyName: "ANTHROPIC_API_KEY",
  },
  {
    slug: "google",
    tier: "native",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    envKeyName: "GOOGLE_API_KEY",
  },
  {
    slug: "azure",
    tier: "openai-compatible",
    defaultBaseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}",
    envKeyName: "AZURE_OPENAI_API_KEY",
  },
  {
    slug: "groq",
    tier: "openai-compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    envKeyName: "GROQ_API_KEY",
  },
  {
    slug: "openrouter",
    tier: "openai-compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    envKeyName: "OPENROUTER_API_KEY",
  },
  {
    slug: "ollama",
    tier: "openai-compatible",
    defaultBaseUrl: "http://localhost:11434/v1",
    envKeyName: "",
  },
];

export interface ConfigPresetDefaults {
  readonly provider?: string;
  readonly model?: string;
  readonly maxTurns?: number;
  readonly systemPrompt?: string;
}

interface ConfigPanelProps {
  readonly providers: readonly ProviderEntryWire[];
  readonly configured: boolean;
  readonly connectionStatus: ConnectionStatus;
  readonly onConfigure: (request: ConfigureRequest) => void;
  readonly onNewSession: () => void;
  readonly workspacePath: string;
  readonly showChrome?: boolean;
  readonly preset: ConfigPresetDefaults | undefined;
  readonly defaults?: Partial<ConfigureRequest> | undefined;
  readonly catalog: readonly CatalogEntry[];
  readonly onCatalogChange: (entries: readonly CatalogEntry[]) => void;
  readonly runtimeOnly?: boolean;
}

const SEARCH_PROVIDERS = ["cloakbrowser", "tavily", "serper", "brave", "none"] as const;

function numStr(value: number | undefined): string {
  return value !== undefined ? String(value) : "";
}

export function ConfigPanel({
  providers,
  configured,
  connectionStatus,
  onConfigure,
  onNewSession,
  workspacePath,
  showChrome = true,
  preset,
  defaults,
  catalog,
  onCatalogChange,
  runtimeOnly = false,
}: ConfigPanelProps): JSX.Element {
  const availableProviders = providers.length > 0 ? providers : BUILTIN_PROVIDER_ENTRIES;
  const [provider, setProvider] = useState(defaults?.provider ?? "openai");
  const [model, setModel] = useState(defaults?.model ?? "gpt-4o");
  const [baseUrl, setBaseUrl] = useState(defaults?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(defaults?.apiKey ?? "");
  const [durable, setDurable] = useState<"memory" | "file">(defaults?.durable ?? "memory");
  const [storagePath, setStoragePath] = useState(defaults?.storagePath ?? "./.cantilune/os");
  const [maxTurns, setMaxTurns] = useState(
    defaults?.maxTurns !== undefined ? String(defaults.maxTurns) : "100",
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced: contract LLM (contract compilation), judge LLM (verification)
  const [contractProvider, setContractProvider] = useState(defaults?.contractProvider ?? "");
  const [contractModel, setContractModel] = useState(defaults?.contractModel ?? "");
  const [judgeProvider, setJudgeProvider] = useState(defaults?.judgeProvider ?? "");
  const [judgeModel, setJudgeModel] = useState(defaults?.judgeModel ?? "");

  // Advanced: tools
  const [searchProvider, setSearchProvider] = useState<string>(
    defaults?.searchProvider ?? "cloakbrowser",
  );
  const [mcpServers, setMcpServers] = useState(defaults?.mcpServers?.join("\n") ?? "");

  // Advanced: termination controller thresholds
  const [tauC, setTauC] = useState(numStr(defaults?.thresholds?.tauC));
  const [tauU, setTauU] = useState(numStr(defaults?.thresholds?.tauU));
  const [epsilon, setEpsilon] = useState(numStr(defaults?.thresholds?.epsilon));
  const [lambda, setLambda] = useState(numStr(defaults?.thresholds?.lambda));
  const [mu, setMu] = useState(numStr(defaults?.thresholds?.mu));
  const [hardGate, setHardGate] = useState(numStr(defaults?.thresholds?.hardGate));

  // Advanced: misc
  const [principalId, setPrincipalId] = useState(defaults?.principalId ?? "");
  const [systemPrompt, setSystemPrompt] = useState(defaults?.systemPrompt ?? "");
  const [maxTimeMs, setMaxTimeMs] = useState(numStr(defaults?.maxTimeMs));
  const [maxContextMessages, setMaxContextMessages] = useState(
    numStr(defaults?.maxContextMessages),
  );
  const [maxContextTokens, setMaxContextTokens] = useState(
    numStr(defaults?.maxContextTokens ?? 128_000),
  );
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    numStr(defaults?.maxOutputTokens ?? 4_096),
  );

  useEffect(() => {
    if (
      preset?.provider !== undefined &&
      availableProviders.some((item) => item.slug === preset.provider)
    ) {
      setProvider(preset.provider);
    }
    if (preset?.model !== undefined) setModel(preset.model);
    if (preset?.maxTurns !== undefined) setMaxTurns(String(preset.maxTurns));
    if (preset?.systemPrompt !== undefined) setSystemPrompt(preset.systemPrompt);
  }, [preset, availableProviders]);

  const selected = availableProviders.find((p) => p.slug === provider);
  const effectiveBaseUrl = baseUrl.length > 0 ? baseUrl : (selected?.defaultBaseUrl ?? "");

  const num = (v: string): number | undefined =>
    v.length > 0 && Number.isFinite(Number(v)) ? Number(v) : undefined;

  const submit = () => {
    const mcpList = mcpServers
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const thresholds: {
      -readonly [K in keyof NonNullable<ConfigureRequest["thresholds"]>]: NonNullable<
        ConfigureRequest["thresholds"]
      >[K];
    } = {};
    const tauCNum = num(tauC);
    const tauUNum = num(tauU);
    const epsilonNum = num(epsilon);
    const lambdaNum = num(lambda);
    const muNum = num(mu);
    const hardGateNum = num(hardGate);
    const maxTimeMsNum = num(maxTimeMs);
    const maxContextNum = num(maxContextMessages);
    const maxContextTokensNum = num(maxContextTokens);
    const maxOutputTokensNum = num(maxOutputTokens);

    // Build with a mutable-local helper, then hand the completed object to
    // onConfigure. Conditional spreads under exactOptionalPropertyTypes widen
    // to `T | undefined`, which is not assignable to a readonly `T?`; assembling
    // the optional fields imperatively avoids that.
    const req: { -readonly [K in keyof ConfigureRequest]: ConfigureRequest[K] } = {
      type: "configure",
      provider,
      model,
      durable,
    };
    if (effectiveBaseUrl.length > 0) req.baseUrl = effectiveBaseUrl;
    if (apiKey.length > 0) req.apiKey = apiKey;
    if (durable === "file") req.storagePath = storagePath;
    if (maxTurns.length > 0) req.maxTurns = Number(maxTurns);
    if (contractProvider.length > 0) req.contractProvider = contractProvider;
    if (contractModel.length > 0) req.contractModel = contractModel;
    if (judgeProvider.length > 0) req.judgeProvider = judgeProvider;
    if (judgeModel.length > 0) req.judgeModel = judgeModel;
    if (searchProvider !== "none")
      req.searchProvider = searchProvider as "cloakbrowser" | "tavily" | "serper" | "brave";
    if (mcpList.length > 0) req.mcpServers = mcpList;
    if (tauCNum !== undefined) thresholds.tauC = tauCNum;
    if (tauUNum !== undefined) thresholds.tauU = tauUNum;
    if (epsilonNum !== undefined) thresholds.epsilon = epsilonNum;
    if (lambdaNum !== undefined) thresholds.lambda = lambdaNum;
    if (muNum !== undefined) thresholds.mu = muNum;
    if (hardGateNum !== undefined) thresholds.hardGate = hardGateNum;
    if (Object.keys(thresholds).length > 0) req.thresholds = thresholds;
    if (principalId.length > 0) req.principalId = principalId;
    if (systemPrompt.length > 0) req.systemPrompt = systemPrompt;
    if (maxTimeMsNum !== undefined) req.maxTimeMs = maxTimeMsNum;
    if (maxContextNum !== undefined) req.maxContextMessages = maxContextNum;
    if (maxContextTokensNum !== undefined) req.maxContextTokens = maxContextTokensNum;
    if (maxOutputTokensNum !== undefined) req.maxOutputTokens = maxOutputTokensNum;
    if (workspacePath.length > 0 && workspacePath !== ".") req.workspace = workspacePath;

    onConfigure(req);
    const exists = catalog.some((item) => item.provider === provider && item.model === model);
    if (!exists) {
      onCatalogChange([
        ...catalog,
        { id: `${provider}:${model}:${Date.now()}`, provider, model, label: model },
      ]);
    }
  };

  return (
    <div className={`${styles.panel} ${showChrome ? "" : styles.settingsPanel}`}>
      <header className={styles.head}>
        <button
          type="button"
          className={styles.brand}
          onClick={onNewSession}
          aria-label="New Cantilune session"
        >
          <LunarLogo size={24} />
          <span className={styles.title}>Cantilune</span>
          <span className={styles.wordmarkBadge}>OS</span>
        </button>
        <span
          className={styles.connectionDot}
          data-status={connectionStatus}
          aria-label={`Connection ${connectionStatus}`}
        />
      </header>

      <button type="button" className={styles.newSession} onClick={onNewSession}>
        <span className={styles.newSessionIcon}>+</span>
        New session
      </button>

      {!runtimeOnly && (
        <>
          <div className={styles.regionLabel}>Connection</div>

          <section className={styles.section}>
            <label className={styles.label}>Provider</label>
            <select
              className={styles.select}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {availableProviders.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.slug}
                  {p.envKeyName.length > 0 ? ` · ${p.envKeyName}` : ""}
                </option>
              ))}
            </select>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>当前模型</label>
            <input
              className={styles.input}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </section>

          <section className={styles.section}>
            <label className={styles.label}>
              模型目录 <span className={styles.hint}>(可同时保存多个，供输入框切换)</span>
            </label>
            <div className={styles.catalog}>
              {catalog.map((item) => {
                const active = item.provider === provider && item.model === model;
                return (
                  <div key={item.id} className={styles.catalogRow}>
                    <select
                      className={styles.select}
                      value={item.provider}
                      aria-label="供应商"
                      onChange={(event) => {
                        const next = event.target.value;
                        onCatalogChange(
                          catalog.map((row) =>
                            row.id === item.id ? { ...row, provider: next } : row,
                          ),
                        );
                        if (active) setProvider(next);
                      }}
                    >
                      {[item.provider, ...availableProviders.map((entry) => entry.slug)]
                        .filter(
                          (slug, index, list) => slug.length > 0 && list.indexOf(slug) === index,
                        )
                        .map((slug) => (
                          <option key={slug} value={slug}>
                            {slug}
                          </option>
                        ))}
                    </select>
                    <input
                      className={styles.input}
                      value={item.model}
                      aria-label="模型 id"
                      onChange={(event) => {
                        const next = event.target.value;
                        onCatalogChange(
                          catalog.map((row) =>
                            row.id === item.id
                              ? {
                                  ...row,
                                  model: next,
                                  label: row.label === row.model ? next : row.label,
                                }
                              : row,
                          ),
                        );
                        if (active) setModel(next);
                      }}
                    />
                    <input
                      className={styles.input}
                      value={item.label}
                      aria-label="显示名"
                      placeholder="显示名"
                      onChange={(event) => {
                        const next = event.target.value;
                        onCatalogChange(
                          catalog.map((row) =>
                            row.id === item.id ? { ...row, label: next } : row,
                          ),
                        );
                      }}
                    />
                    <button
                      type="button"
                      className={active ? styles.catalogUseActive : styles.catalogUse}
                      onClick={() => {
                        setProvider(item.provider);
                        setModel(item.model);
                      }}
                    >
                      {active ? "使用中" : "使用"}
                    </button>
                    <button
                      type="button"
                      className={styles.catalogRemove}
                      aria-label={`删除 ${item.label || item.model}`}
                      onClick={() => onCatalogChange(catalog.filter((row) => row.id !== item.id))}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className={styles.catalogAdd}
                onClick={() =>
                  onCatalogChange([
                    ...catalog,
                    {
                      id: `${provider}:model:${Date.now()}`,
                      provider,
                      model: "",
                      label: "",
                    },
                  ])
                }
              >
                + 添加模型
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>
              Base URL <span className={styles.hint}>(default shown)</span>
            </label>
            <input
              className={styles.input}
              value={baseUrl}
              placeholder={selected?.defaultBaseUrl ?? ""}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </section>

          <section className={styles.section}>
            <label className={styles.label}>
              API Key{" "}
              <span className={styles.hint}>(仅本次会话保留，不写入浏览器存储；刷新后需重输)</span>
            </label>
            <input
              className={styles.input}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                selected?.envKeyName.length ? `paste ${selected.envKeyName}` : "no key needed"
              }
            />
          </section>
        </>
      )}

      <section className={styles.section}>
        <label className={styles.label}>Durability</label>
        <div className={styles.seg}>
          <button
            type="button"
            className={durable === "memory" ? styles.segActive : styles.segBtn}
            onClick={() => setDurable("memory")}
          >
            Memory
          </button>
          <button
            type="button"
            className={durable === "file" ? styles.segActive : styles.segBtn}
            onClick={() => setDurable("file")}
          >
            File
          </button>
        </div>
        {durable === "file" && (
          <input
            className={styles.input}
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="storage path"
          />
        )}
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Max turns</label>
        <input
          className={styles.input}
          type="number"
          value={maxTurns}
          onChange={(e) => setMaxTurns(e.target.value)}
        />
      </section>

      <button
        type="button"
        className={styles.advancedToggle}
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((v) => !v)}
      >
        <span className={advancedOpen ? styles.chevronOpen : styles.chevron}>▸</span>
        Advanced
      </button>

      {advancedOpen && (
        <div className={styles.advanced}>
          <div className={styles.subhead}>Termination controller</div>
          <div className={styles.grid2}>
            <label className={styles.miniLabel}>
              τ_C (completion)
              <input
                className={styles.input}
                value={tauC}
                onChange={(e) => setTauC(e.target.value)}
                placeholder="0.8"
              />
            </label>
            <label className={styles.miniLabel}>
              τ_U (uncertainty)
              <input
                className={styles.input}
                value={tauU}
                onChange={(e) => setTauU(e.target.value)}
                placeholder="0.2"
              />
            </label>
            <label className={styles.miniLabel}>
              ε (VOC*)
              <input
                className={styles.input}
                value={epsilon}
                onChange={(e) => setEpsilon(e.target.value)}
                placeholder="0.05"
              />
            </label>
            <label className={styles.miniLabel}>
              λ (lambda)
              <input
                className={styles.input}
                value={lambda}
                onChange={(e) => setLambda(e.target.value)}
                placeholder="0.1"
              />
            </label>
            <label className={styles.miniLabel}>
              μ (mu)
              <input
                className={styles.input}
                value={mu}
                onChange={(e) => setMu(e.target.value)}
                placeholder="0.2"
              />
            </label>
            <label className={styles.miniLabel}>
              hard gate
              <input
                className={styles.input}
                value={hardGate}
                onChange={(e) => setHardGate(e.target.value)}
                placeholder="1"
              />
            </label>
          </div>

          <div className={styles.subhead}>
            Auxiliary LLMs <span className={styles.hint}>(optional; defaults to loop LLM)</span>
          </div>
          <div className={styles.grid2}>
            <label className={styles.miniLabel}>
              Contract provider
              <select
                className={styles.select}
                value={contractProvider}
                onChange={(e) => setContractProvider(e.target.value)}
              >
                <option value="">— same as loop —</option>
                {availableProviders.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.slug}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.miniLabel}>
              Contract model
              <input
                className={styles.input}
                value={contractModel}
                onChange={(e) => setContractModel(e.target.value)}
                placeholder="model id"
              />
            </label>
            <label className={styles.miniLabel}>
              Judge provider
              <select
                className={styles.select}
                value={judgeProvider}
                onChange={(e) => setJudgeProvider(e.target.value)}
              >
                <option value="">— same as loop —</option>
                {availableProviders.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.slug}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.miniLabel}>
              Judge model
              <input
                className={styles.input}
                value={judgeModel}
                onChange={(e) => setJudgeModel(e.target.value)}
                placeholder="model id"
              />
            </label>
          </div>

          <div className={styles.subhead}>Tools</div>
          <label className={styles.miniLabel}>
            Search provider
            <select
              className={styles.select}
              value={searchProvider}
              onChange={(e) => setSearchProvider(e.target.value)}
            >
              {SEARCH_PROVIDERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.miniLabel}>
            MCP servers <span className={styles.hint}>(one per line or comma)</span>
            <textarea
              className={styles.textarea}
              value={mcpServers}
              onChange={(e) => setMcpServers(e.target.value)}
              placeholder={"name@command args"}
              rows={2}
            />
          </label>

          <div className={styles.subhead}>Runtime</div>
          <label className={styles.miniLabel}>
            Principal id
            <input
              className={styles.input}
              value={principalId}
              onChange={(e) => setPrincipalId(e.target.value)}
              placeholder="auto"
            />
          </label>
          <label className={styles.miniLabel}>
            Max time (ms)
            <input
              className={styles.input}
              type="number"
              value={maxTimeMs}
              onChange={(e) => setMaxTimeMs(e.target.value)}
              placeholder="unset"
            />
          </label>
          <label className={styles.miniLabel}>
            Max context messages
            <input
              className={styles.input}
              type="number"
              value={maxContextMessages}
              onChange={(e) => setMaxContextMessages(e.target.value)}
              placeholder="unset"
            />
          </label>
          <label className={styles.miniLabel}>
            Context window (tokens)
            <input
              className={styles.input}
              type="number"
              min="2"
              value={maxContextTokens}
              onChange={(e) => setMaxContextTokens(e.target.value)}
              placeholder="128000"
            />
          </label>
          <label className={styles.miniLabel}>
            Output reserve (tokens)
            <input
              className={styles.input}
              type="number"
              min="1"
              value={maxOutputTokens}
              onChange={(e) => setMaxOutputTokens(e.target.value)}
              placeholder="4096"
            />
          </label>
          <label className={styles.miniLabel}>
            System prompt <span className={styles.hint}>(optional override)</span>
            <textarea
              className={styles.textarea}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="leave blank for default"
              rows={3}
            />
          </label>
        </div>
      )}

      <button type="button" className={styles.configureBtn} onClick={submit}>
        {configured ? "Reconfigure" : "Configure & connect"}
      </button>

      <footer className={styles.footer}>
        <span className={styles.footerStatus}>
          {configured ? "Runtime ready" : "Awaiting provider"}
        </span>
        <span className={styles.footerMeta}>{connectionStatus}</span>
      </footer>
    </div>
  );
}
