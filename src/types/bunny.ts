export interface VideoMetadata {
  type: "RE" | "QV" | "FULL";
  year: "2023" | "2024" | "2025" | "2026" | "2027" | "2028" | "2029" | "2030" | "2031" | "2032" | "2033";
  term?: string;
  branch?: string;
  teacherCode?: string;
}

export interface VideoRule {
  pattern: RegExp;
  collection: string;
}

export const VIDEO_RULES: VideoRule[] = [
  { pattern: /^RE_/, collection: "Revision Collection" },
  { pattern: /^Q\d+/, collection: "Questions Collection" },
  { pattern: /.*/, collection: "Full Videos Collection" },
];

export const VALID_YEARS = ["2023", "2024", "2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033"] as const;
export type Year = typeof VALID_YEARS[number];

export interface ProcessingStatus {
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  error?: string;
}

export interface VideoUploadConfig {
  maxConcurrent: number;
  retryAttempts: number;
  chunkSize: number;
  timeoutMs: number;
  useTusThresholdMB?: number;
  useStreaming?: boolean;
  retryDelays?: number[];
  enableResumableSessions?: boolean;
  sessionExpiryHours?: number;
  enableAutoRetry?: boolean;
  enableConnectionCheck?: boolean;
}

export const DEFAULT_UPLOAD_CONFIG: VideoUploadConfig = {
  maxConcurrent: 1,
  retryAttempts: 5,
  chunkSize: 1024 * 1024 * 10,
  timeoutMs: 120000,
  useTusThresholdMB: 100,
  useStreaming: true,
  retryDelays: [0, 5000, 10000, 30000, 60000, 120000],
  enableResumableSessions: true,
  sessionExpiryHours: 48,
  enableAutoRetry: true,
  enableConnectionCheck: true
};
