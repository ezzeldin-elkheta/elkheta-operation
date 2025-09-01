export interface Library {
  id: string;
  name: string;
  videoCount: number;
  storageUsage: number;
  trafficUsage: number;
  dateCreated: string;
  apiKey: string;
  replicationRegions: string[];
  enabledResolutions: string[];
  bitrate240p: number;
  bitrate360p: number;
  bitrate480p: number;
  bitrate720p: number;
  bitrate1080p: number;
  bitrate1440p: number;
  bitrate2160p: number;
  allowDirectPlay: boolean;
  enableMP4Fallback: boolean;
  keepOriginalFiles: boolean;
  playerKeyColor: string;
  fontFamily: string;
  collections?: Collection[];
  StorageZoneId?: string;
  PullZoneId?: string;
  storageZoneId?: number;
  pullZoneId?: number;
  apiEndpoint?: string;
  pullZone?: string;
  storageUsed?: number;
  videos?: any[];
}

export interface Collection {
  id: string;           // The collection's unique identifier
  guid: string;         // The collection's GUID (used in API calls)
  name: string;
  videoCount: number;
  totalSize: number;
  previewVideoIds: string | null;
  previewImageUrls: string[];
  dateCreated: string;
  pullZoneId?: number;  // Optional pull zone ID associated with the collection
  storageZoneId?: number; // Optional storage zone ID associated with the collection
}

export interface Video {
  guid: string;
  title: string;
  thumbnailUrl?: string;
  status?: string;
  dateCreated?: string;
  views?: number;
  totalStorageSize?: number;
  collection?: string;
}

export interface DetailedVideo extends Video {
  availableResolutions?: string;
  mp4Video240p?: string;
  mp4Video360p?: string;
  mp4Video480p?: string;
  mp4Video720p?: string;
  mp4Video1080p?: string;
  mp4Video1440p?: string;
  mp4Video2160p?: string;
  length?: number;
  width?: number;
  height?: number;
  averageWatchTime?: number;
  totalWatchTime?: number;
  category?: string;
  chapters?: any[];
  moments?: any[];
  metaTags?: any[];
  // Additional properties found in API response
  storageSize?: number;
  collectionId?: string;
  framerate?: number;
  dateUploaded?: string;
  isPublic?: boolean;
  thumbnailCount?: number;
  encodeProgress?: number;
  hasMP4Fallback?: boolean;
  outputCodecs?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  bytesPerSecond?: number;
  timeRemaining?: number;
  isPaused?: boolean;
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
