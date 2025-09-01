export interface UploadSettings {
  chunkSize: number;
  maxConcurrentUploads: number;
  useStreaming: boolean;
  retryAttempts: number;
  retryDelay: number;
  useTusThresholdMB: number;
  timeoutMs: number;
  retryDelays: number[];
  enableResumableSessions: boolean;
  sessionExpiryHours: number;
  enableAutoRetry: boolean;
  enableConnectionCheck: boolean;
}

export interface UploadResponse {
  guid: string;
  title: string;
  embedCode?: string;
  duration?: number;
}

export interface LibraryData {
  libraries: Array<{
    id: string;
    name: string;
    // Add other library properties as needed
  }>;
} 