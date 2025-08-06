import { Library, Collection } from '../lib/bunny/types';

export interface CollectionInfo extends Collection {}

// Rename to match expected interface name
export interface LibraryInfo extends Library {
  StorageZoneId: string; // Make this required
  PullZoneId: string;  // Also make this required since it's used together
}

// Update UI-specific interfaces
export interface LibraryInterface extends LibraryInfo {
  StorageZoneId: string; // Make explicitly required
  PullZoneId: string;   // Make explicitly required
}

export interface LibraryData {
  lastUpdated?: string;
  date?: Date;
  libraries: Library[];
}

export interface CollectionInterface extends CollectionInfo {}
