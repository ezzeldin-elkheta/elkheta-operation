export interface Library {
  id: string;
  name: string;
  apiKey: string;
  collections: Collection[];
  StorageZoneId: string;
  PullZoneId: string;
  videoCount: number;
  trafficUsage: number;
  storageUsage: number;
  dateCreated: string;
  storageZoneId: number;
  pullZoneId: number;
  apiEndpoint?: string;
  pullZone?: string;
  storageUsed?: number;
  videos?: any[];
}

export interface Collection {
  id: string;
  name: string;
  date?: string;
  videoCount?: number;
  thumbnailCount?: number;
  totalSize?: number;
  status?: string;
}

export interface LibraryData {
  libraries: Library[];
  lastUpdated: string;
  mainApiKey: string;
}

export interface CollectionsResponse {
  items: Collection[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
} 