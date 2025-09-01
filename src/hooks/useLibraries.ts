import { useState, useEffect, useCallback, useMemo } from 'react';
import { bunnyService } from '../lib/bunny-service';
import { dataStorage } from '../lib/data-storage';
import { Library, Collection } from '../lib/bunny/types';
import { useToast } from './use-toast';
import { cache } from '../lib/cache';

export function useLibraries(initialLibraries: Library[] = [], initialCollections: Collection[] = []) {
  const [libraries, setLibraries] = useState<Library[]>(initialLibraries);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLibraryData = useCallback(async () => {
    setIsLoading(true);
    console.log("Fetching all library data from API...");
    try {
      // Get the default API key from cache
      const defaultApiKey = cache.get('default_api_key');
      if (defaultApiKey) {
        // Set the default API key in the bunnyService
        bunnyService.setDefaultApiKey(defaultApiKey);
      }
      
      const apiLibraries: Library[] = await bunnyService.getLibraries();
      console.log(`Fetched ${apiLibraries.length} libraries from API.`);

      // Create LibraryData object
      const libraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: apiLibraries,
        mainApiKey: cache.get('default_api_key') || ""
      };

      // Store the data
      await dataStorage.saveLibraryData(libraryData);
      console.log("Library data saved successfully.");

      setLibraries(libraryData.libraries);
      setCollections([]); // Set empty collections array

      toast({
        title: "✅ Library Data Updated",
        description: `${libraryData.libraries.length} libraries fetched successfully.`,
        variant: "success",
      });

    } catch (error) {
      console.error('Error fetching library data:', error);
      toast({
        title: "❌ Error Fetching Libraries",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    console.log("useLibraries: Initializing - attempting to load from storage.");
    const loadLibraryData = async () => {
      try {
        const libraryData = await dataStorage.getLibraryData();
        if (libraryData && libraryData.libraries) {
          console.log(`useLibraries: Loaded ${libraryData.libraries.length} libraries from storage.`);
          
          // Convert storage libraries to Library type
          const librariesWithCollections: Library[] = libraryData.libraries.map(lib => ({
            id: lib.id,
            name: lib.name,
            apiKey: lib.apiKey || '',
            videoCount: lib.videoCount || 0,
            storageUsage: lib.storageUsage || 0,
            trafficUsage: lib.trafficUsage || 0,
            dateCreated: lib.dateCreated || new Date().toISOString(),
            replicationRegions: lib.replicationRegions || [],
            enabledResolutions: lib.enabledResolutions || [],
            bitrate240p: lib.bitrate240p || 0,
            bitrate360p: lib.bitrate360p || 0,
            bitrate480p: lib.bitrate480p || 0,
            bitrate720p: lib.bitrate720p || 0,
            bitrate1080p: lib.bitrate1080p || 0,
            bitrate1440p: lib.bitrate1440p || 0,
            bitrate2160p: lib.bitrate2160p || 0,
            allowDirectPlay: lib.allowDirectPlay || false,
            enableMP4Fallback: lib.enableMP4Fallback || false,
            keepOriginalFiles: lib.keepOriginalFiles || false,
            playerKeyColor: lib.playerKeyColor || '#ffffff',
            fontFamily: lib.fontFamily || '',
            collections: lib.collections || [],
            StorageZoneId: lib.StorageZoneId || '0',
            PullZoneId: lib.PullZoneId || '0',
            storageZoneId: lib.storageZoneId || 0,
            pullZoneId: lib.pullZoneId || 0,
            apiEndpoint: lib.apiEndpoint || `https://video.bunnycdn.com/library/${lib.id}`,
            pullZone: lib.pullZone || '',
            storageUsed: lib.storageUsed || 0,
            videos: lib.videos || []
          }));
          
          setLibraries(librariesWithCollections);
          
          // Get collections for the selected library if one exists
          const selectedLibrary = cache.get('selectedLibrary');
          if (selectedLibrary) {
            const library = librariesWithCollections.find(lib => lib.id === selectedLibrary.id);
            if (library?.collections) {
              console.log(`useLibraries: Loaded ${library.collections.length} collections for library ${selectedLibrary.id}`);
              setCollections(library.collections);
            }
          }
        } else {
          console.log("useLibraries: No library data in storage, fetching from API...");
          fetchLibraryData();
        }
      } catch (error) {
        console.error("Error loading library data from storage:", error);
        fetchLibraryData();
      }
    };
    
    loadLibraryData();
  }, [fetchLibraryData]);

  const filteredLibraries = useMemo(() => {
    return libraries.sort((a, b) => a.name.localeCompare(b.name));
  }, [libraries]);

  const getCollectionsForLibrary = useCallback((libraryId: string): Collection[] => {
    const library = libraries.find(lib => lib.id === libraryId);
    return library?.collections?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  }, [libraries]);

  return {
    libraries,
    collections,
    filteredLibraries,
    getCollectionsForLibrary,
    fetchLibraryData,
    isLoading,
  };
}
