export interface ProviderEntry {
  readonly slug: string;
  readonly tier: "openai-compatible" | "native";
  readonly defaultBaseUrl: string;
  readonly envKeyName: string;
}

export interface AdapterOptions {
  readonly timeout?: number;
  readonly retries?: number;
  readonly headers?: Record<string, string>;
}
