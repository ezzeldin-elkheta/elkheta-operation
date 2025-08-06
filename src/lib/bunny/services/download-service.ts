const DOWNLOAD_URL_PATTERNS = [
  // Primary CDN patterns based on Bunny.net documentation
  'https://vz-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4',
  'https://video-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4',
  
  // Alternative MP4 patterns
  'https://vz-{libraryId}.b-cdn.net/{videoGuid}/mp4/{quality}p.mp4',
  'https://video-{libraryId}.b-cdn.net/{videoGuid}/mp4/{quality}p.mp4',
  
  // Media delivery patterns
  'https://iframe.mediadelivery.net/play/{libraryId}/{videoGuid}/{quality}p.mp4',
  'https://cdn.mediadelivery.net/{libraryId}/{videoGuid}/{quality}p.mp4',
  
  // Direct library patterns
  'https://{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4',
  'https://library-{libraryId}.b-cdn.net/{videoGuid}/play_{quality}p.mp4'
];

const DOWNLOAD_ERROR_MESSAGES = {
  NOT_FOUND: 'Video file not found or has been removed',
  ACCESS_DENIED: 'Access denied - insufficient permissions',
  DOMAIN_SUSPENDED: 'CDN domain suspended or not configured',
  NETWORK_ERROR: 'Network connection error',
  UNKNOWN_ERROR: 'An unknown error occurred during download'
};

interface DownloadLink {
  quality: string;
  url: string;
  available: boolean;
}

interface VideoDownloadInfo {
  videoGuid: string;
  title: string;
  availableQualities: string[];
  downloadLinks: DownloadLink[];
  pullZoneUrl: string;
}

export class BunnyDownloadService {
  private static readonly SUPPORTED_QUALITIES = ['240p', '360p', '480p', '720p', '1080p', '1440p'];
  
  /**
   * Check if video has MP4 Fallback enabled and get available qualities
   */
  static async getVideoDownloadInfo(
    videoGuid: string,
    libraryId: string,
    apiKey?: string
  ): Promise<{
    hasMP4Fallback: boolean;
    availableQualities: string[];
    originalResolution?: string;
    canDownload: boolean;
    errorMessage?: string;
  }> {
    try {
      const videoDetailsUrl = `/api/proxy/video/library/${libraryId}/videos/${videoGuid}`;
      const response = await fetch(videoDetailsUrl, {
        headers: apiKey ? { 'AccessKey': apiKey } : undefined
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video details: ${response.status}`);
      }
      
      const videoData = await response.json();
      
      console.log(`[DownloadService] Video details for ${videoGuid}:`, {
        hasMP4Fallback: videoData.hasMP4Fallback,
        availableResolutions: videoData.availableResolutions,
        status: videoData.status,
        dateCreated: videoData.dateCreated
      });
      
      // Check if video has MP4 Fallback
      if (!videoData.hasMP4Fallback) {
        return {
          hasMP4Fallback: false,
          availableQualities: [],
          canDownload: false,
          errorMessage: 'هذا الفيديو لا يدعم التحميل المباشر. يجب تفعيل MP4 Fallback في المكتبة قبل رفع الفيديو.'
        };
      }
      
      // Determine available qualities based on original resolution
      const availableQualities = this.determineAvailableQualities(
        videoData.availableResolutions,
        videoData.width,
        videoData.height
      );
      
      return {
        hasMP4Fallback: true,
        availableQualities,
        originalResolution: this.getResolutionFromDimensions(videoData.width, videoData.height),
        canDownload: availableQualities.length > 0,
        errorMessage: availableQualities.length === 0 ? 'لا توجد جودات متاحة للتحميل' : undefined
      };
      
    } catch (error) {
      console.error(`[DownloadService] Error getting video info:`, error);
      return {
        hasMP4Fallback: false,
        availableQualities: [],
        canDownload: false,
        errorMessage: `خطأ في الحصول على معلومات الفيديو: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Determine available qualities based on video data
   */
  private static determineAvailableQualities(
    availableResolutions?: string[],
    width?: number,
    height?: number
  ): string[] {
    // If we have explicit available resolutions from API, use them
    if (availableResolutions && availableResolutions.length > 0) {
      return availableResolutions.filter(res => this.SUPPORTED_QUALITIES.includes(res));
    }
    
    // Otherwise, determine based on original dimensions
    if (height) {
      const maxQuality = this.getResolutionFromDimensions(width, height);
      return this.SUPPORTED_QUALITIES.filter(quality => {
        const qualityHeight = parseInt(quality.replace('p', ''));
        return qualityHeight <= height;
      });
    }
    
    // Fallback to common qualities
    return ['480p', '720p'];
  }
  
  /**
   * Get resolution string from dimensions
   */
  private static getResolutionFromDimensions(width?: number, height?: number): string {
    if (!height) return 'unknown';
    
    if (height >= 2160) return '2160p';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return '240p';
  }

  /**
   * Enhanced download with MP4 Fallback checking
   */
  static async downloadVideo(
    videoGuid: string,
    libraryId: string,
    videoTitle: string,
    quality: string = '720p',
    apiKey?: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      console.log(`[DownloadService] Starting enhanced download for ${videoTitle} (${quality})`);
      
      // First, check if video supports download and get available qualities
      const videoInfo = await this.getVideoDownloadInfo(videoGuid, libraryId, apiKey);
      
      if (!videoInfo.canDownload) {
        throw new Error(videoInfo.errorMessage || 'Video cannot be downloaded');
      }
      
      // Check if requested quality is available
      if (!videoInfo.availableQualities.includes(quality)) {
        const suggestedQuality = videoInfo.availableQualities[0] || '480p';
        throw new Error(
          `الجودة المطلوبة (${quality}) غير متاحة لهذا الفيديو. الجودات المتاحة: ${videoInfo.availableQualities.join(', ')}. سنحاول تحميل ${suggestedQuality} بدلاً من ذلك.`
        );
      }
      
      // Try proxy method first
      await this.tryProxyDownload(videoGuid, libraryId, videoTitle, quality, apiKey, onProgress);
      
    } catch (error) {
      console.error(`[DownloadService] Enhanced download failed:`, error);
      
      // Provide more specific error messages
      if (error instanceof Error && error.message.includes('غير متاحة')) {
        // Quality not available - try with available quality
        const videoInfo = await this.getVideoDownloadInfo(videoGuid, libraryId, apiKey);
        if (videoInfo.availableQualities.length > 0) {
          const fallbackQuality = videoInfo.availableQualities[0];
          console.log(`[DownloadService] Retrying with available quality: ${fallbackQuality}`);
          await this.tryProxyDownload(videoGuid, libraryId, videoTitle, fallbackQuality, apiKey, onProgress);
          return;
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Try proxy download method
   */
  private static async tryProxyDownload(
    videoGuid: string,
    libraryId: string,
    videoTitle: string,
    quality: string,
    apiKey?: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const proxyUrl = `/api/proxy/video/download/${libraryId}/${videoGuid}?quality=${quality}`;
    
    console.log(`[DownloadService] Attempting proxy download: ${proxyUrl}`);
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: apiKey ? { 'AccessKey': apiKey } : undefined
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DownloadService] Proxy failed (${response.status}):`, errorText);
        
        // Try to parse error for better messaging
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message && errorData.message.includes('suspended')) {
            throw new Error('النطاق المستخدم للتحميل معلق أو غير مكون بشكل صحيح. يرجى التواصل مع الدعم الفني.');
          }
        } catch (parseError) {
          // If we can't parse, use generic message
        }
        
        // Try alternative methods
        await this.tryAlternativeDownloadMethods(videoGuid, libraryId, videoTitle, quality);
        return;
      }
      
      // Handle successful proxy response
      await this.handleDownloadResponse(response, videoTitle, quality, onProgress);
      
    } catch (error) {
      console.error(`[DownloadService] Proxy download error:`, error);
      throw error;
    }
  }
  
  /**
   * Try alternative download methods when proxy fails
   */
  private static async tryAlternativeDownloadMethods(
    videoGuid: string,
    libraryId: string,
    videoTitle: string,
    quality: string
  ): Promise<void> {
    console.log(`[DownloadService] Trying alternative download methods`);
    
    // Method 1: Try HLS manifest parsing
    try {
      await this.tryHLSManifestDownload(videoGuid, libraryId, videoTitle, quality);
      return;
    } catch (hlsError) {
      console.log(`[DownloadService] HLS method failed:`, hlsError);
    }
    
    // Method 2: Try direct iframe approach
    try {
      await this.tryDirectIframeDownload(videoGuid, libraryId, videoTitle, quality);
      return;
    } catch (iframeError) {
      console.log(`[DownloadService] Iframe method failed:`, iframeError);
    }
    
    // If all methods fail, throw comprehensive error
    throw new Error(`
      فشل تحميل الفيديو بجميع الطرق المتاحة. الأسباب المحتملة:
      1. الفيديو لا يدعم MP4 Fallback (يجب تفعيلها قبل الرفع)
      2. الجودة المطلوبة غير متاحة
      3. مشكلة في إعدادات CDN أو الصلاحيات
      
      يرجى التأكد من:
      • تفعيل MP4 Fallback في إعدادات المكتبة
      • رفع الفيديو بعد تفعيل الخاصية
      • استخدام جودة متاحة للفيديو
    `);
  }
  
  /**
   * Try downloading via HLS manifest parsing
   */
  private static async tryHLSManifestDownload(
    videoGuid: string,
    libraryId: string,
    videoTitle: string,
    quality: string
  ): Promise<void> {
    console.log(`[DownloadService] Attempting HLS manifest download`);
    
    const hlsUrl = `https://vz-${libraryId}.b-cdn.net/${videoGuid}/playlist.m3u8`;
    
    try {
      const response = await fetch(hlsUrl);
      if (response.ok) {
        const manifest = await response.text();
        console.log(`[DownloadService] Got HLS manifest, length: ${manifest.length}`);
        
        // Parse manifest to find MP4 URLs
        const mp4Urls = this.parseHLSManifestForMP4(manifest, videoGuid, libraryId, quality);
        
        if (mp4Urls.length > 0) {
          console.log(`[DownloadService] Found ${mp4Urls.length} MP4 URLs in manifest`);
          
          // Try each MP4 URL
          for (const url of mp4Urls) {
            try {
              await this.initiateDirectDownload(url, `${this.sanitizeFilename(videoTitle)}_${quality}.mp4`);
              console.log(`[DownloadService] ✅ HLS-based download successful: ${url}`);
              return;
            } catch (urlError) {
              console.log(`[DownloadService] HLS URL failed: ${url}`, urlError);
            }
          }
        }
      }
    } catch (error) {
      console.log(`[DownloadService] HLS manifest fetch failed:`, error);
      throw error;
    }
    
    throw new Error('No working MP4 URLs found in HLS manifest');
  }
  
  /**
   * Parse HLS manifest to extract potential MP4 URLs
   */
  private static parseHLSManifestForMP4(
    manifest: string,
    videoGuid: string,
    libraryId: string,
    quality: string
  ): string[] {
    const urls: string[] = [];
    const cleanQuality = quality.replace('p', '');
    
    // Look for segment URLs that might indicate MP4 availability
    const lines = manifest.split('\n');
    
    // Check if manifest indicates MP4 segments
    const hasMP4Segments = lines.some(line => line.includes('.mp4') || line.includes('mp4'));
    
    if (hasMP4Segments) {
      // Generate potential MP4 URLs based on segment patterns
      urls.push(
        `https://vz-${libraryId}.b-cdn.net/${videoGuid}/play_${cleanQuality}p.mp4`,
        `https://video-${libraryId}.b-cdn.net/${videoGuid}/play_${cleanQuality}p.mp4`,
        `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`
      );
    }
    
    return urls;
  }
  
  /**
   * Handle download response and create file
   */
  private static async handleDownloadResponse(
    response: Response,
    videoTitle: string,
    quality: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const contentLength = response.headers.get('Content-Length');
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response reader');
    }
    
    const chunks: Uint8Array[] = [];
    let downloadedSize = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        downloadedSize += value.length;
        
        if (onProgress && totalSize > 0) {
          const progress = (downloadedSize / totalSize) * 100;
          onProgress(progress);
        }
      }
      
      // Create and download file
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const downloadUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${this.sanitizeFilename(videoTitle)}_${quality}.mp4`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(downloadUrl);
      
      console.log(`[DownloadService] ✅ Download completed: ${videoTitle}`);
      
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Initiate direct download via link
   */
  private static async initiateDirectDownload(url: string, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Add error handling
      link.onerror = () => reject(new Error('Direct download failed'));
      link.onload = () => resolve();
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Resolve after a short delay since onload might not fire for downloads
      setTimeout(resolve, 1000);
    });
  }
}
