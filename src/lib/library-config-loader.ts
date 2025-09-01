import { cache } from './cache';
import { dataStorage } from './data-storage';

/**
 * Loads library configuration from the server and stores it in cache and localStorage
 */
export async function loadLibraryConfig(): Promise<void> {
  try {
    console.log('[LibraryConfig] Loading library configuration from server...');
    
    // Fetch library data from the server
    const response = await fetch('/api/load-config');
    
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.status} ${response.statusText}`);
    }
    
    const libraryData = await response.json();
    console.log('[LibraryConfig] Library data loaded:', {
      itemCount: libraryData.Items?.length || 0,
      totalCount: libraryData.TotalItems || 0
    });
    
    // Transform the data to match our internal format
    const transformedData = {
      lastUpdated: new Date().toISOString(),
      mainApiKey: process.env.VITE_BUNNY_API_KEY || '',
      libraries: libraryData.Items?.map((item: any) => ({
        id: item.Id.toString(),
        name: item.Name,
        apiKey: item.ApiKey,
        readOnlyApiKey: item.ReadOnlyApiKey,
        videoCount: item.VideoCount || 0,
        storageUsage: item.StorageUsage || 0,
        trafficUsage: item.TrafficUsage || 0,
        dateCreated: item.DateCreated,
        storageZoneId: item.StorageZoneId || 0,
        pullZoneId: item.PullZoneId || 0,
        replicationRegions: item.ReplicationRegions || [],
        hasWatermark: item.HasWatermark || false,
        enabledResolutions: item.EnabledResolutions || [],
        allowDirectPlay: item.AllowDirectPlay || false,
        enableMP4Fallback: item.EnableMp4Fallback || false,
        keepOriginalFiles: item.KeepOriginalFiles || false,
        playerKeyColor: item.PlayerKeyColor || '#000000',
        fontFamily: item.FontFamily || 'Arial',
        collections: [] // Will be loaded separately
      })) || []
    };
    
    // Store in localStorage for dataStorage
    localStorage.setItem('library_data', JSON.stringify(transformedData));
    
    // Store in cache for quick access
    cache.set('library_data', transformedData);
    
    // Cache individual library API keys
    transformedData.libraries.forEach(lib => {
      if (lib.apiKey) {
        cache.set(`library_${lib.id}_data`, { apiKey: lib.apiKey });
        console.log(`[LibraryConfig] Cached API key for library ${lib.id} (${lib.name})`);
      }
    });
    
    console.log(`[LibraryConfig] ✅ Successfully loaded and cached ${transformedData.libraries.length} libraries`);
    
    // List some key libraries for debugging
    const keyLibraries = transformedData.libraries.filter(lib => 
      lib.id === '372434' || lib.name.includes('Mina') || lib.name.includes('J6')
    );
    keyLibraries.forEach(lib => {
      console.log(`[LibraryConfig] Key library: ${lib.name} (ID: ${lib.id}) - API Key: ${lib.apiKey?.substring(0, 8)}...`);
    });
    
  } catch (error) {
    console.error('[LibraryConfig] ❌ Failed to load library configuration:', error);
    throw error;
  }
}

/**
 * Gets a library's API key from cache
 */
export function getLibraryApiKey(libraryId: string): string | null {
  // Try cache first
  const libraryData = cache.get(`library_${libraryId}_data`);
  if (libraryData?.apiKey) {
    return libraryData.apiKey;
  }
  
  // Try from the main library data
  const allLibraries = cache.get('library_data');
  if (allLibraries?.libraries) {
    const library = allLibraries.libraries.find(l => l.id === libraryId);
    if (library?.apiKey) {
      // Cache it for future use
      cache.set(`library_${libraryId}_data`, { apiKey: library.apiKey });
      return library.apiKey;
    }
  }
  
  return null;
}
