import { useState, useEffect } from 'react';
import { Library } from '../lib/types';

export function useSelectedLibrary() {
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);

  useEffect(() => {
    // Load selected library from localStorage on mount
    const storedLibrary = localStorage.getItem('selectedLibrary');
    if (storedLibrary) {
      try {
        const parsedLibrary = JSON.parse(storedLibrary);
        console.log('[useSelectedLibrary] Loaded library from storage:', parsedLibrary);
        setSelectedLibrary(parsedLibrary);
      } catch (error) {
        console.error('[useSelectedLibrary] Error parsing stored library:', error);
        localStorage.removeItem('selectedLibrary');
      }
    }
  }, []);

  const updateSelectedLibrary = (library: Library | null) => {
    console.log('[useSelectedLibrary] Updating selected library:', library);
    if (library) {
      // Ensure we have all required fields
      const libraryWithDefaults = {
        ...library,
        apiKey: library.apiKey || '',
        StorageZoneId: library.StorageZoneId || '0',
        PullZoneId: library.PullZoneId || '0',
        apiEndpoint: library.apiEndpoint || `https://video.bunnycdn.com/library/${library.id}`
      };
      console.log('[useSelectedLibrary] Setting library with defaults:', libraryWithDefaults);
      setSelectedLibrary(libraryWithDefaults);
      localStorage.setItem('selectedLibrary', JSON.stringify(libraryWithDefaults));
    } else {
      console.log('[useSelectedLibrary] Clearing selected library');
      setSelectedLibrary(null);
      localStorage.removeItem('selectedLibrary');
    }
  };

  return { selectedLibrary, setSelectedLibrary: updateSelectedLibrary };
} 