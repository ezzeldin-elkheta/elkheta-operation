import { useState, useEffect, useCallback, useMemo } from 'react';
import { bunnyService } from '../lib/bunny-service';
import { dataStorage } from '../lib/data-storage';
import { Library, Collection } from '../lib/bunny/types';
import { useToast } from './use-toast';
import { cache } from '../lib/cache';
import { secureLog } from '../lib/crypto-utils';

export function useLibraries(initialLibraries: Library[] = [], initialCollections: Collection[] = []) {
  const [libraries, setLibraries] = useState<Library[]>(initialLibraries);
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLibraryData = useCallback(async () => {
    setIsLoading(true);
    secureLog("Fetching all library data from API...");
    try {
      // Get the default API key from cache
      const defaultApiKey = cache.get('default_api_key');
      if (defaultApiKey) {
        // Set the default API key in the bunnyService
        bunnyService.setDefaultApiKey(defaultApiKey);
      }
      
      const apiLibraries: Library[] = await bunnyService.getLibraries();
      secureLog(`Fetched ${apiLibraries.length} libraries from API`);

      // Create LibraryData object
      const libraryData = {
        lastUpdated: new Date().toISOString(),
        libraries: apiLibraries,
        mainApiKey: cache.get('default_api_key') || ""
      };

      // Store the data securely
      await dataStorage.saveLibraryData(libraryData);
      secureLog("Library data saved securely");

      setLibraries(libraryData.libraries);
      setCollections([]); // Set empty collections array

      toast({
        title: "✅ Library Data Updated",
        description: `${libraryData.libraries.length} libraries fetched successfully.`,
        variant: "success",
      });

    } catch (error) {
      secureLog("Error fetching library data", { error: error instanceof Error ? error.message : 'Unknown error' });
      toast({
        title: "❌ Library Update Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadCachedLibraries = useCallback(async () => {
    try {
      const cachedData = await dataStorage.getLibraryData();
      if (cachedData && cachedData.libraries.length > 0) {
        setLibraries(cachedData.libraries);
        secureLog("Loaded libraries from secure cache", { libraryCount: cachedData.libraries.length });
      }
    } catch (error) {
      secureLog("Error loading cached libraries", { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }, []);

  useEffect(() => {
    loadCachedLibraries();
  }, [loadCachedLibraries]);

  const clearLibraryData = useCallback(async () => {
    try {
      await dataStorage.clearLibraryData();
      setLibraries([]);
      setCollections([]);
      secureLog("Library data cleared");
      toast({
        title: "🗑️ Library Data Cleared",
        description: "All library data has been cleared.",
        variant: "default",
      });
    } catch (error) {
      secureLog("Error clearing library data", { error: error instanceof Error ? error.message : 'Unknown error' });
      toast({
        title: "❌ Clear Failed",
        description: "Failed to clear library data.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const selectedLibrary = useMemo(() => {
    return libraries.length > 0 ? libraries[0] : null;
  }, [libraries]);

  return {
    libraries,
    collections,
    isLoading,
    selectedLibrary,
    fetchLibraryData,
    clearLibraryData,
    loadCachedLibraries,
  };
}
