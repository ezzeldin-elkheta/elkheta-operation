import type { Year } from "../../types/common";

export type UploadStatus = "pending" | "processing" | "completed" | "error" | "paused" | "cancelled";
export type SheetUpdateStatus = 'pending' | 'updated' | 'notFound' | 'skipped' | 'error' | 'processing';

export interface QueueItem {
  id: string;
  file: File;
  filename: string;
  status: "pending" | "processing" | "completed" | "error" | "paused" | "cancelled";
  progress: number;
  errorMessage?: string;
  uploadSpeed?: number;
  timeRemaining?: number;
  totalSize?: number;
  uploadedSize?: number;
  isPaused?: boolean;
  controller?: AbortController;
  startTime?: number;
  pausedAt?: number; // Timestamp when upload was paused
  lastBytesLoaded?: number; // Added property
  lastProgressUpdate?: number; // Added property
  lastLoggedPercent?: number; // For console logging optimization
  lastLoggedSpeed?: number; // For console logging optimization
  metadata: {
    library: string;
    collection: string;
    year: string;
    libraryName?: string;
    collectionName?: string;
    needsManualSelection?: boolean;
    reason?: string;
    suggestedCollection?: string;
    suggestedLibraryName?: string;
    confidence?: number;
    suggestedLibraries?: Array<{ id: string; name: string; score?: number }>;
    apiKey?: string;
    videoDurationSeconds?: number; // Store extracted video duration in seconds
  };
}

export interface UploadGroup {
  library: string; // Can be "Needs Manual Selection" or actual library name/ID
  collection: string; // Can be suggested or actual collection name
  items: QueueItem[];
  needsManualSelection?: boolean;
  suggestedLibraryName?: string; // Added for grouping manual items
}

export interface LibraryInfo {
  id: string;
  name: string;
  apiKey: string; // Changed from optional to required
  collections?: any[];
}

export interface LibraryMatch {
  library: LibraryInfo | null;
  confidence: number;
  alternatives: LibraryInfo[];
  libraryObject?: any;
}

export interface UploadSettings {
  // إعدادات الرفع الأساسية
  maxConcurrentUploads: number;
  useStreaming: boolean;
  
  // إعدادات TUS المتقدمة
  useTusThresholdMB?: number;     // حجم الملف بالميجابايت الذي يتم عنده استخدام TUS
  chunkSize?: number;             // حجم القطعة بالبايت
  timeoutMs?: number;             // مهلة الطلب بالمللي ثانية
  retryDelays?: number[];         // فترات إعادة المحاولة بالمللي ثانية
  retryAttempts?: number;         // عدد محاولات إعادة الرفع
  
  // إعدادات التخزين المؤقت
  enableResumableSessions?: boolean; // تمكين تخزين جلسات TUS
  sessionExpiryHours?: number;      // مدة صلاحية الجلسة بالساعات
  
  // إعدادات الاتصال
  enableAutoRetry?: boolean;        // إعادة المحاولة تلقائياً عند انقطاع الاتصال
  enableConnectionCheck?: boolean;   // فحص حالة الاتصال قبل الرفع
  
  // إعدادات طريقة الرفع
  uploadMethod?: 'auto' | 'tus' | 'chunked' | 'direct'; // طريقة الرفع المفضلة
  maxDirectUploadSizeMB?: number;   // أقصى حجم للرفع المباشر بالميجابايت
  enableAutoFallback?: boolean;     // التبديل التلقائي عند فشل طريقة الرفع
  
  // إعدادات الوكيل والشبكة
  enableProxyFallback?: boolean;    // استخدام الوكيل عند الحاجة
  proxyTimeoutMs?: number;          // مهلة الوكيل
  validateConnectionBeforeUpload?: boolean; // التحقق من الاتصال قبل البدء
  
  // Aliases للتوافق مع الكود القديم
  maxConcurrent?: number;          // مرادف لـ maxConcurrentUploads
  useStreamingUpload?: boolean;    // مرادف لـ useStreaming
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  bytesPerSecond: number;
  timeRemaining: number;
}

export interface Library {
  id: string;
  name: string;
  apiKey: string;
}

export interface Collection {
  id: string;
  name: string;
  libraryId: string;
}

export interface UploadResult {
  filename: string;
  status: string;
  message?: string;
  errorDetails?: string; 
  library?: string;
  collection?: string;
  details?: {
    uploadStatus: "success" | "error" | "skipped" | "duplicate";
    sheetStatus: SheetUpdateStatus;
    embedCode?: string;
    directPlayUrl?: string;
    videoGuid?: string;
    duration?: number;
    size?: number;
    errorDetails?: string;
    uploadSpeed?: number;
    uploadedSize?: number;
    timeRemaining?: number;
    uploadDuration?: number;
    sheetUpdateDetails?: {
      status: SheetUpdateStatus;
      message?: string;
      embedCode?: string;
      updateTime?: number;
    };
  };
}
