import { HttpClient } from '../http-client';
import { Library } from '../types';
import { cache } from '../../cache';

export class LibraryService {
  constructor(private httpClient: HttpClient) {}

  async getLibraries(): Promise<Library[]> {
    try {
      let allLibraries: Library[] = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`Fetching libraries page ${currentPage}...`);
        const response = await this.httpClient.fetchWithError(
          `/videolibrary?page=${currentPage}&perPage=100&orderBy=name`,
          { method: "GET" }
        );

        if (!response.Items || !Array.isArray(response.Items)) {
          console.warn('No Items array in response:', response);
          break;
        }

        const libraries = response.Items.map((lib: any): Library => ({
          id: lib.Id?.toString() || "",
          name: lib.Name || "Unnamed Library",
          videoCount: lib.VideoCount || 0,
          storageUsage: lib.StorageUsage || 0,
          trafficUsage: lib.TrafficUsage || 0,
          dateCreated: lib.DateCreated || "",
          apiKey: lib.ApiKey || "",
          regions: lib.ReplicationRegions || [],
          resolutions: (lib.EnabledResolutions || "").split(",").filter(Boolean),
          bitrates: {
            "240p": lib.Bitrate240p || 0,
            "360p": lib.Bitrate360p || 0,
            "480p": lib.Bitrate480p || 0,
            "720p": lib.Bitrate720p || 0,
            "1080p": lib.Bitrate1080p || 0,
            "1440p": lib.Bitrate1440p || 0,
            "2160p": lib.Bitrate2160p || 0,
          },
          settings: {
            allowDirectPlay: lib.AllowDirectPlay || false,
            enableMP4Fallback: lib.EnableMP4Fallback || false,
            keepOriginalFiles: lib.KeepOriginalFiles || false,
            playerKeyColor: lib.PlayerKeyColor || "#ffffff",
            fontFamily: lib.FontFamily || "",
          }
        }));

        allLibraries = [...allLibraries, ...libraries];
        console.log(`Added ${libraries.length} libraries from page ${currentPage}. Total so far: ${allLibraries.length}`);
        
        // Check if we should fetch next page (Got 100 items on this page)
        if (response.Items.length < 100) {
          hasMorePages = false;
          console.log(`Last page reached. Total libraries fetched: ${allLibraries.length}`);
        } else {
          currentPage++;
        }
      }

      // Cache library API keys
      allLibraries.forEach(lib => {
        if (lib.apiKey) {
          cache.set(`library_${lib.id}_api`, lib.apiKey);
        }
      });

      return allLibraries;

    } catch (error) {
      console.error("Error fetching libraries:", error);
      throw error;
    }
  }

  async getLibrary(id: string): Promise<Library | null> {
    try {
      const response = await this.httpClient.fetchWithError(
        `/videolibrary/${id}`,
        { method: "GET" }
      );

      if (!response) return null;

      return {
        id: response.Id?.toString() || "",
        name: response.Name || "Unnamed Library",
        videoCount: response.VideoCount || 0,
        storageUsage: response.StorageUsage || 0,
        trafficUsage: response.TrafficUsage || 0,
        dateCreated: response.DateCreated || "",
        apiKey: response.ApiKey || "",
        regions: response.ReplicationRegions || [],
        resolutions: (response.EnabledResolutions || "").split(",").filter(Boolean),
        bitrates: {
          "240p": response.Bitrate240p || 0,
          "360p": response.Bitrate360p || 0,
          "480p": response.Bitrate480p || 0,
          "720p": response.Bitrate720p || 0,
          "1080p": response.Bitrate1080p || 0,
          "1440p": response.Bitrate1440p || 0,
          "2160p": response.Bitrate2160p || 0,
        },
        settings: {
          allowDirectPlay: response.AllowDirectPlay || false,
          enableMP4Fallback: response.EnableMP4Fallback || false,
          keepOriginalFiles: response.KeepOriginalFiles || false,
          playerKeyColor: response.PlayerKeyColor || "#ffffff",
          fontFamily: response.FontFamily || "",
        }
      };
    } catch (error) {
      console.error(`Error fetching library ${id}:`, error);
      throw error;
    }
  }
}
