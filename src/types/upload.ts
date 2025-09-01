export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
export type SheetStatus = 'pending' | 'processing' | 'updated' | 'notFound' | 'skipped' | 'error';

export interface UploadResult {
  filename: string;
  status: UploadStatus;
  message?: string;
  libraryId?: string;
  collectionId?: string;
  sheetStatus?: SheetStatus;
  sheetMessage?: string;
}

export interface UploadReportProps {
  open: boolean;
  onClose: () => void;
  results: UploadResult[];
  duration?: string;
}