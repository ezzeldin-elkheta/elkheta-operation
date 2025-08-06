import React, { useEffect } from 'react';
import { Year } from '../../types/common';
import LibrarySelector from '../LibrarySelector';
import CollectionSelector from '../CollectionSelector';
import ManualUploadZone from '../ManualUploadZone';
import SelectedFilesPreview from '../SelectedFilesPreview';
import { Library, FolderOpen } from 'lucide-react';
import { useSelectedCollection } from "../../hooks/useSelectedCollection";
import { Collection } from '../../lib/bunny/types';

interface LibrarySettingsProps {
  libraries: Array<{ id: string; name: string }>;
  collections: Array<Collection>;
  selectedLibrary: string;
  selectedCollection: string;
  selectedYear: Year;
  onLibraryChange: (value: string) => void;
  onCollectionChange: (value: string) => void;
  onYearChange: (value: Year) => void;
  isUploading: boolean; // Specific to manual upload
  selectedFiles: File[];
  uploadInProgress: boolean; // General upload progress flag
  onFileSelect: (files: FileList) => void;
  onStartUpload: () => Promise<void>;
  onRemoveFile: (index: number) => void; // Changed to index
  disabled?: boolean;
}

const LibrarySettings: React.FC<LibrarySettingsProps> = ({
  libraries,
  collections,
  selectedLibrary,
  selectedCollection,
  selectedYear,
  onLibraryChange,
  onCollectionChange,
  onYearChange,
  isUploading,
  selectedFiles,
  uploadInProgress,
  onFileSelect,
  onStartUpload,
  onRemoveFile,
  disabled
}) => {
  // Use the hook to persist collection selection
  const { selectedCollection: persistedCollection, setSelectedCollection, selectedCollectionId } = useSelectedCollection();

  // When collection changes, update both the parent state and persisted state
  const handleCollectionChange = (collectionId: string) => {
    console.log('[LibrarySettings] Collection change requested:', {
      collectionId,
      currentSelectedCollection: selectedCollection,
      availableCollections: collections.length
    });

    const collection = collections.find(c => (c.id === collectionId || c.guid === collectionId));
    if (collection) {
      console.log('[LibrarySettings] Found collection to select:', collection);
      
      // Update parent state first
      onCollectionChange(collectionId);
      
      // Then update persisted state
      const collectionToStore = {
        id: collection.id || collection.guid,
        guid: collection.guid,
        name: collection.name,
        videoCount: collection.videoCount || 0,
        totalSize: collection.totalSize || 0,
        dateCreated: collection.dateCreated || new Date().toISOString(),
        previewVideoIds: collection.previewVideoIds || null,
        previewImageUrls: collection.previewImageUrls || []
      };
      
      console.log('[LibrarySettings] Storing collection data:', collectionToStore);
      setSelectedCollection(collectionToStore);
    } else {
      console.warn('[LibrarySettings] Collection not found:', {
        collectionId,
        availableCollections: collections.map(c => ({ id: c.id, guid: c.guid, name: c.name }))
      });
    }
  };

  // When library changes, clear the collection selection
  const handleLibraryChange = (libraryId: string) => {
    console.log('[LibrarySettings] Library change requested:', {
      libraryId,
      currentLibrary: selectedLibrary,
      hasCollections: collections.length > 0
    });
    
    onLibraryChange(libraryId);
    
    // Clear collection selection in both parent and persisted state
    console.log('[LibrarySettings] Clearing collection selection');
    onCollectionChange("");
    setSelectedCollection(null);
  };

  // Initialize collection selection from persisted state
  useEffect(() => {
    // Check and restore persisted collection if available
    if (persistedCollection && !selectedCollection && collections.length > 0) {
      const collection = collections.find(c => (
        c.id === persistedCollection.id || 
        c.guid === persistedCollection.guid
      ));
      if (collection) {
        onCollectionChange(collection.id || collection.guid);
      } else {
        setSelectedCollection(null);
      }
    }
  }, [persistedCollection, selectedCollection, collections, onCollectionChange]);

  return (
    <section className="space-y-4 pt-6 border-t animate-fade-in">
      <div className="flex items-center gap-2">
        <Library className="h-5 w-5 text-blue-500 animate-pulse-slow" />
        <h3 className="text-lg font-semibold">Library Settings & Manual Upload</h3>
      </div>

      {/* Grid container for Library and Collection selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="w-full hover-lift p-3 rounded-lg transition-all duration-200">
          <LibrarySelector
            libraries={libraries}
            selectedLibrary={selectedLibrary}
            onLibraryChange={handleLibraryChange}
            disabled={disabled}
          />
        </div>
        <div className="w-full hover-lift p-3 rounded-lg transition-all duration-200">
          <CollectionSelector
            collections={collections}
            selectedCollection={selectedCollectionId}
            onCollectionChange={handleCollectionChange}
            disabled={disabled || !selectedLibrary}
          />
        </div>
      </div>

      {/* Year selector removed - now handled in ToolbarSection */}

      {/* Manual upload zone */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="h-5 w-5 text-blue-500" />
          <h4 className="font-medium">Manual Upload</h4>
        </div>
        <ManualUploadZone
          onFileSelect={onFileSelect}
          disabled={!selectedLibrary || !selectedCollectionId || uploadInProgress}
          files={selectedFiles}
          onStartUpload={onStartUpload}
          isUploading={isUploading}
        />
      </div>

      {/* Show selected files preview ONLY if not uploading */}
      {!uploadInProgress && selectedFiles.length > 0 && (
        <div className="mt-4 animate-slide-in">
          <SelectedFilesPreview
            files={selectedFiles}
            onRemove={onRemoveFile}
            className="mt-2"
          />
        </div>
      )}
    </section>
  );
};

export default LibrarySettings;
