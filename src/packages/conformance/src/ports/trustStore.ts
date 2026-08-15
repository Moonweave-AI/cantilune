export interface TrustRootEntry {
  readonly keyId: string;
  readonly publicKey: Uint8Array;
  readonly scope: readonly string[];
  readonly notBefore: string;
  readonly expiresAt: string;
}

export interface TrustStore {
  readonly version: string;
  readonly getRoots: (scope: string) => readonly TrustRootEntry[];
}
