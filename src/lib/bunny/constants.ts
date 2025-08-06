export const BASE_URL = "https://api.bunny.net";
export const VIDEO_BASE_URL = "https://video.bunnycdn.com";
export const DEFAULT_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
export const DEFAULT_MAX_CONCURRENT = 4;
export const DEFAULT_PROGRESS_UPDATE_INTERVAL = 100; // 100ms

// Add proxy base URLs for development if needed
export const PROXY_BASE_URL = "/api/proxy/base";
export const PROXY_VIDEO_URL = "/api/proxy/video";

// Download URL patterns (ordered by reliability)
export const DOWNLOAD_URL_PATTERNS = [
  // Primary Bunny Stream format
  "https://vz-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4",

  // Alternative CDN patterns
  "https://video-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4",
  "https://media-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4",
  "https://library-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4",

  // MP4 fallback patterns
  "https://vz-{libraryId}.b-cdn.net/{videoGuid}/mp4/{quality}p.mp4",
  "https://video-{libraryId}.b-cdn.net/{videoGuid}/mp4/{quality}p.mp4",
  "https://vz-{libraryId}.b-cdn.net/{videoGuid}/mp4/video.mp4",
  "https://video-{libraryId}.b-cdn.net/{videoGuid}/mp4/video.mp4",

  // Media delivery patterns
  "https://iframe.mediadelivery.net/play/{libraryId}/{videoGuid}/{quality}p.mp4",
  "https://cdn.mediadelivery.net/{libraryId}/{videoGuid}/{quality}p.mp4",
  
  // HLS patterns for potential extraction
  "https://vz-{libraryId}.b-cdn.net/{videoGuid}/playlist.m3u8",
  "https://video-{libraryId}.b-cdn.net/{videoGuid}/playlist.m3u8"
];

// Error messages for better user feedback
export const DOWNLOAD_ERROR_MESSAGES = {
  DOMAIN_SUSPENDED: "Video domain appears to be suspended or not properly configured",
  ACCESS_DENIED: "Access denied - insufficient permissions to download this video",
  NOT_FOUND: "Video file not found or has been removed",
  NETWORK_ERROR: "Network connection error occurred during download",
  UNKNOWN_ERROR: "An unknown error occurred during download"
};

export const DEFAULT_QUALITIES = ["240p", "360p", "480p", "720p", "1080p", "1440p"];

export const CDN_DOMAINS = {
  PRIMARY: "vz-{libraryId}.b-cdn.net",
  ALTERNATIVE: "video-{libraryId}.b-cdn.net",
  MEDIA_DELIVERY: "iframe.mediadelivery.net"
};
