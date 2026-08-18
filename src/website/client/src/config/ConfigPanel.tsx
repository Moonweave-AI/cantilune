/**
 * ConfigPanel — ADR-0030 §3.3. The setup surface that replaces CLI /provider.
 * Lives in the sidebar. Sends `configure`; the server boots the OS.
 * API key is sent over WS to server memory only — never persisted here.
 *
 * Exposes the full CLI configuration surface: loop LLM (provider/model/baseUrl/
 * key), durability, max turns, plus an Advanced section for contract & judge
 * LLM adapters, search provider, MCP servers, termination thresholds, system
 * prompt, and principal id — so the website is a complete replacement for the
 * CLI, not a subset.
 */

import { useEffect, useState } from "react";
import type { ConfigureRequest } from "@shared/protocol";
import { LunarLogo } from "../theme/LunarLogo";
import type { ConnectionStatus } from "../ws/useBridge";
import styles from "./ConfigPanel.module.css";

export interface ProviderEntryWire {
  readonly slug: string;
  readonly tier: string;
  readonly defaultBaseUrl: string;
  readonly envKeyName: string;
}

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
}

const SEARCH_PROVIDERS = ["none", "tavily", "serper", "brave"] as const;

export function ConfigPanel({
  providers,
  configured,
  connectionStatus,
  onConfigure,
  onNewSession,
  workspacePath,
  showChrome = true,
  preset,
}: ConfigPanelProps): JSX.Element {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [durable, setDurable] = useState<"memory" | "file">("memory");
  const [storagePath, setStoragePath] = useState("./.cantilune/os");
  const [maxTurns, setMaxTurns] = useState("100");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Advanced: contract LLM (contract compilation), judge LLM (verification)
  const [contractProvider, setContractProvider] = useState("");
  const [contractModel, setContractModel] = useState("");
  const [judgeProvider, setJudgeProvider] = useState("");
  const [judgeModel, setJudgeModel] = useState("");

  // Advanced: tools
  const [searchProvider, setSearchProvider] = useState<string>("none");
  const [mcpServers, setMcpServers] = useState("");

  // Advanced: termination controller thresholds
  const [tauC, setTauC] = useState("");
  const [tauU, setTauU] = useState("");
  const [epsilon, setEpsilon] = useState("");
  const [lambda, setLambda] = useState("");
  const [mu, setMu] = useState("");
  const [hardGate, setHardGate] = useState("");

  // Advanced: misc
  const [principalId, setPrincipalId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxTimeMs, setMaxTimeMs] = useState("");
  const [maxContextMessages, setMaxContextMessages] = useState("");

  useEffect(() => {
    if (preset?.provider !== undefined && providers.some((item) => item.slug === preset.provider)) {
      setProvider(preset.provider);
    }
    if (preset?.model !== undefined) setModel(preset.model);
    if (preset?.maxTurns !== undefined) setMaxTurns(String(preset.maxTurns));
    if (preset?.systemPrompt !== undefined) setSystemPrompt(preset.systemPrompt);
  }, [preset, providers]);

  const selected = providers.find((p) => p.slug === provider);
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
      req.searchProvider = searchProvider as "tavily" | "serper" | "brave";
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
    if (workspacePath.length > 0 && workspacePath !== ".") req.workspace = workspacePath;

    onConfigure(req);
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

      <div className={styles.regionLabel}>Connection</div>

      <section className={styles.section}>
        <label className={styles.label}>Provider</label>
        <select
          className={styles.select}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          {providers.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.slug}
              {p.envKeyName.length > 0 ? ` · ${p.envKeyName}` : ""}
            </option>
          ))}
        </select>
      </section>

      <section className={styles.section}>
        <label className={styles.label}>Model</label>
        <input className={styles.input} value={model} onChange={(e) => setModel(e.target.value)} />
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
          API Key <span className={styles.hint}>(server-memory only; not stored)</span>
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
                {providers.map((p) => (
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
                {providers.map((p) => (
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
