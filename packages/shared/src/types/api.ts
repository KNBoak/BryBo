export interface SyncMeta {
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError: string | null;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };
