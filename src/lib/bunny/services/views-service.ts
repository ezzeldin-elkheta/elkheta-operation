import { HttpClient } from '../http-client';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface VideoStatistics {
  viewCount: number;
  viewsChart: { [key: string]: number };
  timeWatched: number;
  audienceChart: { [key: string]: number };
  engagementChart: { [key: string]: number };
}

interface Video {
  guid: string;
  title: string;
  status: number;
  dateUploaded: string;
  viewCount?: number;
}

interface Library {
  id: string;
  name: string;
}

export class ViewsService {
  constructor(private httpClient: HttpClient) {}

  /**
   * Get statistics for a specific video
   */
  async getVideoStatistics(
    libraryId: string, 
    videoGuid: string, 
    dateFrom?: string, 
    dateTo?: string
  ): Promise<VideoStatistics> {
    try {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);
      
      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      const response = await this.httpClient.fetchWithError<VideoStatistics>(
        `/api/proxy/video/library/${libraryId}/videos/${videoGuid}/statistics${query}`
      );

      return response;
    } catch (error) {
      console.error(`Error fetching statistics for video ${videoGuid}:`, error);
      return {
        viewCount: 0,
        viewsChart: {},
        timeWatched: 0,
        audienceChart: {},
        engagementChart: {}
      };
    }
  }

  /**
   * Get all videos from a library
   */
  async getVideosFromLibrary(libraryId: string): Promise<Video[]> {
    try {
      const response = await this.httpClient.fetchWithError<{
        items: Video[];
        currentPage: number;
        itemsPerPage: number;
        totalItems: number;
      }>(
        `/api/proxy/video/library/${libraryId}/videos?page=1&itemsPerPage=100&orderBy=date`
      );

      let allVideos = response.items || [];
      
      // If there are more pages, fetch them
      if (response.totalItems > response.itemsPerPage) {
        const totalPages = Math.ceil(response.totalItems / response.itemsPerPage);
        
        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageResponse = await this.httpClient.fetchWithError<{
              items: Video[];
            }>(
              `/api/proxy/video/library/${libraryId}/videos?page=${page}&itemsPerPage=100&orderBy=date`
            );
            
            if (pageResponse.items) {
              allVideos = allVideos.concat(pageResponse.items);
            }
          } catch (error) {
            console.warn(`Failed to fetch page ${page} for library ${libraryId}:`, error);
          }
        }
      }

      return allVideos;
    } catch (error) {
      console.error(`Error fetching videos from library ${libraryId}:`, error);
      return [];
    }
  }

  /**
   * Get all libraries
   */
  async getLibraries(): Promise<Library[]> {
    try {
      const response = await this.httpClient.fetchWithError<{
        items: Library[];
      }>('/api/proxy/base/videolibrary');

      return response.items || [];
    } catch (error) {
      console.error('Error fetching libraries:', error);
      return [];
    }
  }

  /**
   * Get views statistics for all libraries for the last 12 months
   */
  async getAllLibrariesViewsStats(): Promise<any> {
    try {
      // Calculate date range for last 12 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const libraries = await this.getLibraries();
      const libraryViewsData: { [key: string]: { [month: string]: number } } = {};

      // For each library
      for (const library of libraries) {
        libraryViewsData[library.name] = {};
        
        try {
          // Get all videos in the library
          const videos = await this.getVideosFromLibrary(library.id);
          
          // Generate month keys for the last 12 months
          const months: string[] = [];
          for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            months.push(date.toISOString().substring(0, 7)); // YYYY-MM format
          }

          // Initialize all months with 0
          months.forEach(month => {
            libraryViewsData[library.name][month] = 0;
          });

          // Get statistics for each video
          for (const video of videos) {
            try {
              const stats = await this.getVideoStatistics(
                library.id,
                video.guid,
                startDate.toISOString(),
                endDate.toISOString()
              );

              // Add views from viewsChart to monthly totals
              if (stats.viewsChart) {
                Object.entries(stats.viewsChart).forEach(([dateKey, views]) => {
                  try {
                    // Parse the date and get month
                    const viewDate = new Date(dateKey);
                    const month = viewDate.toISOString().substring(0, 7);
                    
                    if (libraryViewsData[library.name][month] !== undefined) {
                      libraryViewsData[library.name][month] += views;
                    }
                  } catch (dateError) {
                    console.warn(`Invalid date format: ${dateKey}`);
                  }
                });
              }
            } catch (error) {
              console.warn(`Failed to get stats for video ${video.guid}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Failed to process library ${library.name}:`, error);
        }
      }

      // Return the data instead of generating Excel
      return this.formatViewsData(libraryViewsData, 'آخر 12 شهر');

    } catch (error) {
      console.error("Error getting views stats:", error);
      throw error instanceof Error 
        ? error 
        : new Error("Failed to get views statistics");
    }
  }

  /**
   * Get views for a specific month across all libraries
   */
  async getMonthlyViewsForAllLibraries(year: number, month: number): Promise<any> {
    try {
      // Calculate date range for the specific month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of the month

      const libraries = await this.getLibraries();
      const libraryViewsData: { [key: string]: { [month: string]: number } } = {};
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;

      // For each library
      for (const library of libraries) {
        libraryViewsData[library.name] = { [monthKey]: 0 };
        
        try {
          // Get all videos in the library
          const videos = await this.getVideosFromLibrary(library.id);
          
          // Get statistics for each video
          for (const video of videos) {
            try {
              const stats = await this.getVideoStatistics(
                library.id,
                video.guid,
                startDate.toISOString(),
                endDate.toISOString()
              );

              // Add views from viewsChart to monthly total
              if (stats.viewsChart) {
                Object.entries(stats.viewsChart).forEach(([dateKey, views]) => {
                  try {
                    const viewDate = new Date(dateKey);
                    const viewMonth = viewDate.toISOString().substring(0, 7);
                    
                    if (viewMonth === monthKey) {
                      libraryViewsData[library.name][monthKey] += views;
                    }
                  } catch (dateError) {
                    console.warn(`Invalid date format: ${dateKey}`);
                  }
                });
              }
            } catch (error) {
              console.warn(`Failed to get stats for video ${video.guid}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Failed to process library ${library.name}:`, error);
        }
      }

      // Return the data instead of generating Excel
      const monthName = `${year}/${month.toString().padStart(2, '0')}`;
      return this.formatViewsData(libraryViewsData, monthName);

    } catch (error) {
      console.error("Error getting monthly views stats:", error);
      throw error instanceof Error 
        ? error 
        : new Error("Failed to get monthly views statistics");
    }
  }

  /**
   * Format views data for the report
   */
  private formatViewsData(data: { [key: string]: { [month: string]: number } }, selectedMonth: string): any {
    const libraries = Object.entries(data).map(([libraryName, monthlyData]) => {
      const totalViews = Object.values(monthlyData).reduce((sum, views) => sum + views, 0);
      
      return {
        id: libraryName.toLowerCase().replace(/\s+/g, '-'),
        name: libraryName,
        totalViews: totalViews,
        videoCount: 0, // سيتم حسابه لاحقاً إذا توفرت البيانات
        averageViews: totalViews, // مؤقت حتى نحصل على عدد الفيديوهات الفعلي
        topVideo: undefined // سيتم إضافته لاحقاً إذا توفرت البيانات
      };
    });

    const totalViews = libraries.reduce((sum, lib) => sum + lib.totalViews, 0);

    return {
      selectedMonth,
      totalViews,
      libraries,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate and download Excel file with views data
   */
  private async generateViewsExcel(data: { [key: string]: { [month: string]: number } }): Promise<void> {
    // Get unique months from all data
    const months = new Set<string>();
    Object.values(data).forEach(libraryData => {
      Object.keys(libraryData).forEach(month => months.add(month));
    });

    // Sort months in reverse chronological order
    const sortedMonths = Array.from(months).sort().reverse();

    // Create Excel data
    const excelData = [['Library Name', ...sortedMonths]];

    // Add library rows
    Object.entries(data).forEach(([libraryName, monthlyData]) => {
      const row = [libraryName];
      sortedMonths.forEach(month => {
        row.push((monthlyData[month] || 0).toString());
      });
      excelData.push(row);
    });

    // Add total row
    const totalRow = ['Total'];
    sortedMonths.forEach((_, columnIndex) => {
      const total = excelData
        .slice(1)
        .reduce((sum, row) => sum + Number(row[columnIndex + 1]), 0);
      totalRow.push(total.toString());
    });
    excelData.push(totalRow);

    // Create Excel workbook with same styling as bandwidth
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Add column widths
    ws['!cols'] = [
      { wch: 30 },
      ...sortedMonths.map(() => ({ wch: 12 }))
    ];

    // Style header and total rows
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
      // Bold header row
      const headerAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[headerAddress]) ws[headerAddress] = {};
      ws[headerAddress].s = { font: { bold: true } };

      // Bold total row
      const totalRowIndex = excelData.length - 1;
      const totalAddress = XLSX.utils.encode_cell({ r: totalRowIndex, c: C });
      if (!ws[totalAddress]) ws[totalAddress] = {};
      ws[totalAddress].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, ws, "Video Views Statistics");

    // Save file
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const fileName = `video_views_stats_${new Date().toISOString().split('T')[0]}.xlsx`;
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, fileName);
  }
} 