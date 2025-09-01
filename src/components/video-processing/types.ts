import { Library } from '../../lib/types';
import { Collection } from '../../lib/bunny/types';

export interface LibraryInterface extends Library {
  StorageZoneId: string;
  PullZoneId: string;
}

export interface CollectionInterface extends Collection {}

export interface UploadGroup {
  id: string;
  files: File[];
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'paused';
  progress: number;
  error?: string;
  libraryId?: string;
  libraryName?: string;
  collectionId?: string;
  collectionName?: string;
}
