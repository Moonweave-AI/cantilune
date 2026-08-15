import React, { useMemo } from "react";
import { Text } from "ink";
import { getProvider } from "@cantilune/adapter";
import type { AppStore } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { configPath } from "../config.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";

export interface ViewProps {
  readonly store: AppStore;
}

function describeApiKeyState(envKey: string): string {
  if (envKey.length === 0) return "n/a (provider needs no key)";
  const value = process.env[envKey];
  if (value !== undefined && value !== "") return `set via ${envKey}`;
  return `MISSING — export ${envKey}`;
}

export function renderConfigViewOutput(store: AppStore): string {
  const entry = getProvider(store.provider);
  const envKey = entry?.envKeyName ?? "";
  // Report only whether the key is present — never echo the value itself.
  const keyState = describeApiKeyState(envKey);

  const rows: string[][] = [
    ["provider", store.provider],
    ["model", store.model],
    ["baseUrl", store.baseUrl ?? entry?.defaultBaseUrl ?? "(provider default)"],
    ["api key", keyState],
    ["layout", store.layout],
    ["theme", store.theme ?? "auto (detected)"],
    ["runtime", store.connected ? "connected (memory)" : "not started"],
    ["config file", configPath()],
  ];

  return [
    renderTable(
      [
        { header: "Setting", width: 14 },
        { header: "Value", width: 58 },
      ],
      rows,
    ),
    "",
    "/provider <slug>   switch provider      /model <id>      switch model",
    "/base-url <url>    override endpoint    /theme <name>    switch palette",
    "/layout <mode>     focus | observe      /config save     persist to disk",
    "",
    "API keys are read from the environment and never written to the config file.",
  ].join("\n");
}

export function ConfigView({ store }: ViewProps): React.ReactElement {
  const output = useMemo(() => renderConfigViewOutput(store), [store]);

  return (
    <ViewFrame title="Configuration" tone="success">
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
}

export default function ConfigViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({ activeView: "config", viewArgs: props.viewArgs ?? {} });
  return <ConfigView store={store} />;
}
