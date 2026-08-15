export interface RevocationStore {
  readonly checkpoint: string;
  readonly isRevoked: (certificateId: string) => Promise<boolean>;
}
