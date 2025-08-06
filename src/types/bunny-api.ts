export interface Library {
  id: string;
  name: string;
  videoCount: number;
  storageUsage: number;
  trafficUsage: number;
  dateCreated: string;
  apiKey?: string;
  regions: string[];
  resolutions: string[];
  bitrates: {
    [key: string]: number;
  };
  settings: {
    allowDirectPlay: boolean;
    enableMP4Fallback: boolean;
    keepOriginalFiles: boolean;
    playerKeyColor: string;
    fontFamily: string;
  };
}

export interface LibraryInfo extends Library {
  collections: Collection[];
}

export interface Collection {
  guid: string;
  name: string;
  videoCount?: number;
}

export interface Video {
  guid: string;
  title: string;
  collectionId?: string;
}

export interface UploadProgress {
  percentage: number;
  loaded: number;
  total: number;
  bytesPerSecond: number;
}

export interface UploadStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export interface EmbedOptions {
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: boolean;
  responsive?: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  detail?: string;
}
