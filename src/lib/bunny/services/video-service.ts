import { HttpClient } from '../http-client';
import { Video, DetailedVideo } from '../types';

export class VideoService {
  constructor(
    private httpClient: HttpClient,
    private videoBaseUrl: string
  ) {}

  async getVideos(
    libraryId: string,
    collectionId?: string,
    accessToken?: string,
  ): Promise<Video[]> {
    try {
      console.log(`[VideoService] Fetching videos for library ${libraryId}${collectionId ? ` and collection ${collectionId}` : ''}`);
      
      const url = `/library/${libraryId}/videos?page=1&itemsPerPage=1000${collectionId ? `&collection=${collectionId}` : ''}`;
      
      console.log(`[VideoService] Using URL: ${url}`);
      
      const response = await this.httpClient.fetchWithError(
        url,
        { 
          method: "GET"
        }
      );

      console.log(`[VideoService] Received response:`, response);

      if (!response) {
        console.warn('[VideoService] Empty response received');
        return [];
      }

      const videos = (response.items || []).map((video: any): Video => ({
        guid: video.guid || "",
        title: video.title || "",
        dateCreated: video.dateCreated || ""
      }));

      // Enhanced sorting function
      return videos.sort((a: Video, b: Video) => {
        // Extract lecture numbers with support for Arabic format "الحصة X"
        const getLectureNumber = (title: string) => {
          // Check for Arabic lecture number "الحصة X"
          const arabicMatch = title.match(/الحصة\s+(\d+)/i);
          if (arabicMatch) return parseInt(arabicMatch[1]);
          
          // Fall back to English format if needed
          const englishMatch = title.match(/Lecture\s+(\d+)/i);
          return englishMatch ? parseInt(englishMatch[1]) : 0;
        };

        // Extract question numbers with improved pattern
        const getQuestionNumber = (title: string) => {
          const match = title.match(/Q\s*(\d+)/i);
          return match ? parseInt(match[1]) : 0;
        };

        // Extract content type priority (regular content > homework > أهم أفكار)
        const getContentTypePriority = (title: string) => {
          if (title.includes('واجب')) return 2;
          if (title.includes('أهم أفكار')) return 3;
          return 1; // Regular content has highest priority
        };

        // Get lecture and question numbers for both videos
        const lectureA = getLectureNumber(a.title);
        const lectureB = getLectureNumber(b.title);
        const questionA = getQuestionNumber(a.title);
        const questionB = getQuestionNumber(b.title);
        const typeA = getContentTypePriority(a.title);
        const typeB = getContentTypePriority(b.title);

        // First group by course code prefix (J5-T1-U1 etc.)
        const prefixA = a.title.split('--')[0] || '';
        const prefixB = b.title.split('--')[0] || '';
        
        if (prefixA !== prefixB) {
          return prefixA.localeCompare(prefixB);
        }
        
        // Then sort by lecture number (ascending)
        if (lectureA !== lectureB) {
          return lectureA - lectureB;
        }
        
        // Then sort by content type
        if (typeA !== typeB) {
          return typeA - typeB;
        }

        // Then sort by question number (ascending)
        return questionA - questionB;
      });

    } catch (error) {
      console.error("Error fetching videos:", error);
      throw error;
    }
  }

  /**
   * Get detailed video information including available resolutions
   */
  async getVideoDetails(
    libraryId: string,
    videoGuid: string,
    accessToken?: string
  ): Promise<DetailedVideo | null> {
    try {
      console.log(`[VideoService] Fetching video details for ${videoGuid} in library ${libraryId}`);
      
      const url = `/library/${libraryId}/videos/${videoGuid}`;
      
      const response = await this.httpClient.fetchWithError(
        url,
        { 
          method: "GET",
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response) {
        console.warn(`[VideoService] No details found for video ${videoGuid}`);
        return null;
      }

      console.log(`[VideoService] Video details response:`, response);

      // Map the response to our detailed video interface
      const detailedVideo: DetailedVideo = {
        guid: response.guid || videoGuid,
        title: response.title || "",
        status: response.status || 0,
        length: response.length || 0,
        storageSize: response.storageSize || 0,
        collectionId: response.collectionId,
        width: response.width || 0,
        height: response.height || 0,
        framerate: response.framerate || 0,
        dateUploaded: response.dateUploaded || "",
        views: response.views || 0,
        isPublic: response.isPublic || false,
        thumbnailCount: response.thumbnailCount || 0,
        encodeProgress: response.encodeProgress || 0,
        hasMP4Fallback: response.hasMP4Fallback || false,
        availableResolutions: response.availableResolutions || null,
        outputCodecs: response.outputCodecs || null,
        dateCreated: response.dateCreated || ""
      };

      return detailedVideo;

    } catch (error) {
      console.error(`[VideoService] Error fetching video details for ${videoGuid}:`, error);
      return null;
    }
  }
  /**
   * Get available download qualities for a video
   */
  async getAvailableQualities(
    libraryId: string,
    videoGuid: string,
    accessToken?: string
  ): Promise<string[]> {
    const videoDetails = await this.getVideoDetails(libraryId, videoGuid, accessToken);
    
    if (!videoDetails?.availableResolutions) {
      // Return common default qualities if no specific data available
      return ['1080p', '720p', '480p', '360p', '240p'];
    }
    
    // Handle both string and array formats
    let qualities: string[];
    if (typeof videoDetails.availableResolutions === 'string') {
      // If it's a string, try to parse it as comma-separated values
      qualities = videoDetails.availableResolutions.split(',').map(q => q.trim());
    } else if (Array.isArray(videoDetails.availableResolutions)) {
      qualities = videoDetails.availableResolutions;
    } else {
      // Fallback to defaults
      return ['1080p', '720p', '480p', '360p', '240p'];
    }
    
    // Sort qualities from highest to lowest
    return qualities.sort((a, b) => {
      const getQualityValue = (quality: string) => {
        const match = quality.match(/(\d+)p?/);
        return match ? parseInt(match[1]) : 0;
      };
      return getQualityValue(b) - getQualityValue(a);
    });
  }  /**
   * Generate multiple potential download URLs for a video with specific quality
   * Returns an array of URLs ordered by likelihood of success
   */
  generateDownloadUrl(
    libraryId: string,
    videoGuid: string,
    quality?: string,
    useMP4Fallback: boolean = false
  ): string {
    const videoQuality = quality || '720p';
    
    // Return the most likely to work URL as the primary choice
    // Based on testing, the iframe.mediadelivery.net pattern seems most promising
    return `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${videoQuality}.mp4`;
  }

  /**
   * Generate multiple potential download URLs for testing
   * Returns an array of URLs ordered by likelihood of success
   */
  generateMultipleDownloadUrls(
    libraryId: string,
    videoGuid: string,
    quality?: string
  ): string[] {
    const videoQuality = quality || '720p';
    
    return [
      // Pattern 1: Direct API download endpoint (most official)
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download${quality ? `?resolution=${quality}` : ''}`,
      
      // Pattern 2: iframe player direct MP4 (most likely to work based on testing)
      `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${videoQuality}.mp4`,
      
      // Pattern 3: CDN direct access with quality folder
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/${videoQuality}/video.mp4`,
      
      // Pattern 4: Alternative CDN pattern
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/${videoQuality}/video.mp4`,
      
      // Pattern 5: Embed with download parameter
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?download=true&resolution=${videoQuality}`,
      
      // Pattern 6: Alternative CDN with mp4 folder
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/${videoQuality}.mp4`,
      
      // Pattern 7: Direct file access pattern
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/play_${videoQuality}.mp4`,
    ];
  }

  getEmbedCode(libraryId: string, videoGuid: string): string {
    // Generate embed code in the exact format from the Python backend, with autoplay=false
    return `
<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>
    `.trim();
  }
}
