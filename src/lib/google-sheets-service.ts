interface VideoData {
  name: string;
  embed_code: string;
}

interface UpdateResponse {
  message: string;
  not_found_videos?: string[];
  skippedVideos?: string[]; // Add this property to fix the TypeScript error
  details?: string;
  stats?: {
    total: number;
    updated: number;
    notFound: number;
    skipped: number;
  };
}

interface BatchUpdateResult {
  rowIndex?: number;
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped';
}

interface ApiResponse {
  success: boolean;
  message: string;
  results?: BatchUpdateResult[];
  notFoundVideos?: string[];
  stats?: {
    updated: number;
    notFound: number;
    skipped: number;
  };
}

interface BandwidthData {
  Date: string;
  'Bandwidth (GB)': string;
  'Cost ($)': string;
}

class GoogleSheetsService {
  private baseUrl = '/api/sheets';
  private lastNotFoundVideos: string[] = [];
  private lastSkippedVideos: string[] = [];

  async updateEmbedsInSheet(videos: VideoData[]): Promise<UpdateResponse> {
    try {
      if (!Array.isArray(videos) || videos.length === 0) {
        throw new Error('No videos selected for update');
      }

          const response = await fetch('/api/update-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videos })
      });

      const data = await response.json() as ApiResponse;

      // Store detailed video information for reporting
      const notFoundVideos = data.notFoundVideos || [];
      
      // Get skipped videos from results
      const skippedVideos = data.results
        ?.filter(r => r.status === 'skipped')
        .map(r => r.videoName) || [];
      
      this.lastNotFoundVideos = notFoundVideos;
      this.lastSkippedVideos = skippedVideos;

      // Create detailed message based on results
      let message = '';
      const updated = data.stats?.updated || 0;
      const notFound = data.stats?.notFound || 0;
      const skipped = data.stats?.skipped || 0;
      
      if (updated > 0 && notFound === 0 && skipped === 0) {
        message = `✅ Successfully updated all ${updated} videos in the sheet`;
      } else {
        const parts = [];
        if (updated > 0) parts.push(`${updated} updated`);
        if (notFound > 0) parts.push(`${notFound} not found`);
        if (skipped > 0) parts.push(`${skipped} skipped`);
        message = `Sheet update completed: ${parts.join(', ')}`;
      }

      console.log('Sheet update result:', {
        message,
        notFound: notFoundVideos,
        skipped: skippedVideos,
        stats: {
          total: videos.length,
          updated,
          notFound,
          skipped,
        }
      });

      return {
        message,
        not_found_videos: notFoundVideos,
        skippedVideos: skippedVideos,
        stats: {
          total: videos.length,
          updated: updated,
          notFound: notFound,
          skipped: skipped,
        }
      };
    } catch (error) {
      console.error('Error updating embeds in sheet:', error);
      throw error;
    }
  }

  async updateBandwidthStats(data: BandwidthData[]): Promise<void> {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No bandwidth data to update');
      }

      const response = await fetch(`${this.baseUrl}/update-bandwidth-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update bandwidth statistics');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Update failed');
      }

    } catch (error) {
      console.error('Error updating bandwidth stats:', error);
      throw error;
    }
  }

  private generateSummaryMessage(stats: { total: number; updated: number; notFound: number; skipped: number }): string {
    const summary = [];

    // Always show total attempted
    summary.push(`Total videos processed: ${stats.total}`);

    // Add update status
    if (stats.updated > 0) {
      summary.push(`✅ Updated: ${stats.updated} videos`);
    }

    // Add not found details
    if (this.lastNotFoundVideos.length > 0) {
      summary.push('\n❌ Not Found Videos:');
      summary.push(this.lastNotFoundVideos.map(name => `• ${name}`).join('\n'));
    }

    // Add skipped details
    if (this.lastSkippedVideos.length > 0) {
      summary.push('\n⚠️ Already Had Links:');
      summary.push(this.lastSkippedVideos.map(name => `• ${name}`).join('\n'));
    }

    return summary.join('\n');
  }
}

export const googleSheetsService = new GoogleSheetsService();
