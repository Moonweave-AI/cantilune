/**
 * Provider cards for Settings → Models. One configured provider is one card
 * (DeepSeek Harness ModelsSection structure): collapsed row + Edit expands
 * key/endpoint/model list. Cantilune tokens, no DSH copy.
 */

import { useMemo, useState } from "react";
import type { ConfigureRequest } from "@shared/protocol";
import type { CatalogEntry } from "../persist/store";
import { BUILTIN_PROVIDER_ENTRIES, type ProviderEntryWire } from "./ConfigPanel";
import styles from "./ModelsBoard.module.css";

interface ModelsBoardProps {
  readonly providers: readonly ProviderEntryWire[];
  readonly catalog: readonly CatalogEntry[];
  readonly defaults: Partial<ConfigureRequest> | undefined;
  readonly configured: boolean;
  readonly workspacePath: string;
  readonly onCatalogChange: (entries: readonly CatalogEntry[]) => void;
  readonly onConfigure: (request: ConfigureRequest) => void;
}

interface ProviderGroup {
  readonly provider: string;
  readonly custom: boolean;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly models: readonly CatalogEntry[];
}

function displayName(provider: string): string {
  const known: Record<string, string> = {
    deepseek: "DeepSeek",
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    azure: "Azure",
    dashscope: "DashScope",
    zhipu: "智谱",
    baichuan: "百川",
  };
  return known[provider] ?? provider;
}

function groupsOf(
  catalog: readonly CatalogEntry[],
  defaults: Partial<ConfigureRequest> | undefined,
): ProviderGroup[] {
  const map = new Map<string, CatalogEntry[]>();
  for (const entry of catalog) {
    const list = map.get(entry.provider) ?? [];
    list.push(entry);
    map.set(entry.provider, list);
  }
  const groups = [...map.entries()].map(([provider, models]) => {
    const fromDefaults = defaults?.provider === provider;
    return {
      provider,
      custom: models.some((item) => item.custom === true),
      apiKey:
        models.find((item) => (item.apiKey ?? "").length > 0)?.apiKey ??
        (fromDefaults ? (defaults?.apiKey ?? "") : ""),
      baseUrl:
        models.find((item) => (item.baseUrl ?? "").length > 0)?.baseUrl ??
        (fromDefaults ? (defaults?.baseUrl ?? "") : ""),
      models,
    };
  });
  if (groups.length > 0) return groups;
  if (defaults?.provider === undefined) return [];
  const model = defaults.model ?? "";
  return [
    {
      provider: defaults.provider,
      custom: false,
      apiKey: defaults.apiKey ?? "",
      baseUrl: defaults.baseUrl ?? "",
      models:
        model.length > 0
          ? [
              {
                id: `${defaults.provider}:${model}`,
                provider: defaults.provider,
                model,
                label: model,
                ...(defaults.apiKey !== undefined ? { apiKey: defaults.apiKey } : {}),
                ...(defaults.baseUrl !== undefined ? { baseUrl: defaults.baseUrl } : {}),
              },
            ]
          : [],
    },
  ];
}

function withShared(
  models: readonly CatalogEntry[],
  patch: Partial<Pick<CatalogEntry, "apiKey" | "baseUrl" | "custom" | "provider">>,
): CatalogEntry[] {
  return models.map((item) => ({ ...item, ...patch }));
}

export function ModelsBoard({
  providers,
  catalog,
  defaults,
  configured,
  workspacePath,
  onCatalogChange,
  onConfigure,
}: ModelsBoardProps): JSX.Element {
  const availableProviders = providers.length > 0 ? providers : BUILTIN_PROVIDER_ENTRIES;
  const groups = useMemo(() => groupsOf(catalog, defaults), [catalog, defaults]);
  const [editing, setEditing] = useState<string | null>(() => {
    const initial = groupsOf(catalog, defaults);
    const first = initial[0];
    return first !== undefined && first.apiKey.length === 0 ? first.provider : null;
  });
  const [adding, setAdding] = useState<"builtin" | "custom" | null>(null);
  const [draftProvider, setDraftProvider] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const taken = new Set(groups.map((group) => group.provider));
  const addable = availableProviders.filter((item) => !taken.has(item.slug));
  const activeProvider = defaults?.provider;
  const activeModel = defaults?.model;

  const applyGroup = (group: ProviderGroup, modelId?: string) => {
    const chosen =
      group.models.find((item) => item.model === modelId && item.model.length > 0) ??
      group.models.find((item) => item.model.length > 0);
    if (chosen === undefined) return;
    const req: { -readonly [K in keyof ConfigureRequest]: ConfigureRequest[K] } = {
      type: "configure",
      provider: group.provider,
      model: chosen.model,
      durable: defaults?.durable ?? "file",
    };
    const key = group.apiKey.length > 0 ? group.apiKey : (defaults?.apiKey ?? "");
    const url =
      group.baseUrl.length > 0
        ? group.baseUrl
        : (defaults?.baseUrl ??
          availableProviders.find((item) => item.slug === group.provider)?.defaultBaseUrl ??
          "");
    if (key.length > 0) req.apiKey = key;
    if (url.length > 0) req.baseUrl = url;
    if (defaults?.storagePath !== undefined) req.storagePath = defaults.storagePath;
    if (defaults?.maxTurns !== undefined) req.maxTurns = defaults.maxTurns;
    if (workspacePath.length > 0 && workspacePath !== ".") req.workspace = workspacePath;
    onCatalogChange(
      catalog.map((item) =>
        item.provider === group.provider
          ? { ...item, apiKey: key, baseUrl: url, custom: group.custom }
          : item,
      ),
    );
    onConfigure(req);
    setEditing(null);
  };

  const patchGroup = (provider: string, nextModels: readonly CatalogEntry[]) => {
    onCatalogChange([...catalog.filter((item) => item.provider !== provider), ...nextModels]);
  };

  const startBuiltin = () => {
    const first = addable[0];
    setAdding("builtin");
    setDraftProvider(first?.slug ?? "");
    setDraftKey("");
    setDraftUrl(first?.defaultBaseUrl ?? "");
    setDraftModel("");
    setEditing(null);
  };

  const startCustom = () => {
    setAdding("custom");
    setDraftProvider("");
    setDraftKey("");
    setDraftUrl("");
    setDraftModel("");
    setEditing(null);
  };

  const commitDraft = () => {
    const provider = draftProvider.trim();
    const model = draftModel.trim();
    if (provider.length === 0 || model.length === 0) return;
    const entry: CatalogEntry = {
      id: `${provider}:${model}:${Date.now()}`,
      provider,
      model,
      label: model,
      ...(draftKey.trim().length > 0 ? { apiKey: draftKey.trim() } : {}),
      ...(draftUrl.trim().length > 0 ? { baseUrl: draftUrl.trim() } : {}),
      ...(adding === "custom" ? { custom: true } : {}),
    };
    onCatalogChange([...catalog, entry]);
    setAdding(null);
    setEditing(provider);
  };

  return (
    <div className={styles.board}>
      <ul className={styles.rows}>
        {groups.map((group) => {
          const open = editing === group.provider;
          const hasKey = group.apiKey.length > 0;
          const active = group.provider === activeProvider;
          return (
            <li key={group.provider} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.identity}>
                  <strong>{displayName(group.provider)}</strong>
                  {group.custom && <em>自定义</em>}
                  <i
                    className={hasKey ? styles.dotOk : styles.dotMissing}
                    title={hasKey ? "已配置密钥" : "缺少密钥"}
                  />
                </span>
                <span className={styles.actions}>
                  <button
                    type="button"
                    className={styles.edit}
                    onClick={() => setEditing(open ? null : group.provider)}
                  >
                    编辑
                  </button>
                  {group.custom && (
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() =>
                        onCatalogChange(catalog.filter((item) => item.provider !== group.provider))
                      }
                    >
                      删除
                    </button>
                  )}
                </span>
              </div>
              {open && (
                <div className={styles.editor}>
                  <label>
                    Base URL
                    <input
                      value={group.baseUrl}
                      placeholder={
                        availableProviders.find((item) => item.slug === group.provider)
                          ?.defaultBaseUrl ?? ""
                      }
                      onChange={(event) =>
                        patchGroup(
                          group.provider,
                          withShared(group.models, { baseUrl: event.target.value }),
                        )
                      }
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="password"
                      value={group.apiKey}
                      placeholder="保存在本机浏览器"
                      onChange={(event) =>
                        patchGroup(
                          group.provider,
                          withShared(group.models, { apiKey: event.target.value }),
                        )
                      }
                    />
                  </label>
                  <div className={styles.models}>
                    {group.models.map((item) => (
                      <div key={item.id} className={styles.modelRow}>
                        <input
                          value={item.model}
                          aria-label="模型 id"
                          placeholder="模型 id"
                          onChange={(event) => {
                            const next = event.target.value;
                            patchGroup(
                              group.provider,
                              group.models.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      model: next,
                                      label: row.label === row.model ? next : row.label,
                                    }
                                  : row,
                              ),
                            );
                          }}
                        />
                        <input
                          value={item.label}
                          aria-label="显示名"
                          placeholder="显示名"
                          onChange={(event) =>
                            patchGroup(
                              group.provider,
                              group.models.map((row) =>
                                row.id === item.id ? { ...row, label: event.target.value } : row,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          className={
                            active && item.model === activeModel ? styles.useActive : styles.use
                          }
                          onClick={() => applyGroup(group, item.model)}
                        >
                          {active && item.model === activeModel ? "使用中" : "使用"}
                        </button>
                        <button
                          type="button"
                          className={styles.x}
                          aria-label={`删除 ${item.label || item.model}`}
                          onClick={() =>
                            patchGroup(
                              group.provider,
                              group.models.filter((row) => row.id !== item.id),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.addModel}
                      onClick={() =>
                        patchGroup(group.provider, [
                          ...group.models,
                          {
                            id: `${group.provider}:model:${Date.now()}`,
                            provider: group.provider,
                            model: "",
                            label: "",
                            apiKey: group.apiKey,
                            baseUrl: group.baseUrl,
                            custom: group.custom,
                          },
                        ])
                      }
                    >
                      + 添加模型
                    </button>
                  </div>
                  <div className={styles.footer}>
                    <button type="button" className={styles.ghost} onClick={() => setEditing(null)}>
                      取消
                    </button>
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => applyGroup(group)}
                    >
                      {configured && active ? "保存并重连" : "应用并连接"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {adding !== null && (
        <div className={styles.card}>
          <div className={styles.head}>
            <strong>{adding === "custom" ? "自定义提供方" : "添加提供方"}</strong>
          </div>
          <div className={styles.editor}>
            {adding === "builtin" ? (
              <label>
                提供方
                <select
                  value={draftProvider}
                  onChange={(event) => {
                    const slug = event.target.value;
                    setDraftProvider(slug);
                    const meta = availableProviders.find((item) => item.slug === slug);
                    if (meta !== undefined && draftUrl.length === 0)
                      setDraftUrl(meta.defaultBaseUrl);
                  }}
                >
                  {addable.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.slug}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                路由 id
                <input
                  value={draftProvider}
                  placeholder="例如 my-gateway"
                  onChange={(event) => setDraftProvider(event.target.value)}
                />
              </label>
            )}
            <label>
              Base URL
              <input
                value={draftUrl}
                placeholder="https://"
                onChange={(event) => setDraftUrl(event.target.value)}
              />
            </label>
            <label>
              API Key
              <input
                type="password"
                value={draftKey}
                onChange={(event) => setDraftKey(event.target.value)}
              />
            </label>
            <label>
              模型 id
              <input
                value={draftModel}
                placeholder="例如 deepseek-chat"
                onChange={(event) => setDraftModel(event.target.value)}
              />
            </label>
            <div className={styles.footer}>
              <button type="button" className={styles.ghost} onClick={() => setAdding(null)}>
                取消
              </button>
              <button type="button" className={styles.primary} onClick={commitDraft}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={styles.addRow}>
        <button
          type="button"
          className={styles.addProvider}
          onClick={startBuiltin}
          disabled={addable.length === 0}
        >
          + 添加提供方
        </button>
        <button type="button" className={styles.addProvider} onClick={startCustom}>
          + 添加自定义提供方
        </button>
      </div>
    </div>
  );
}
