import { HttpClient } from '../http-client';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

interface StatisticsResponse {
  Statistics: Array<{
    Date: string;
    TotalBytes: number;
    TotalRequests: number;
    CacheHits: number;
  }>;
  From: string;
  To: string;
}

export class BandwidthService {
  constructor(private httpClient: HttpClient) {}

  async getBandwidthStats(): Promise<void> {
    try {
      // Calculate date range for last 6 months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 6);

      // Construct query parameters
      const queryParams = new URLSearchParams({
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
        pullZone: "-1",
        serverZoneId: "-1",
        loadErrors: "false",
        hourly: "false"
      });

      // Get statistics using fetchWithError
      const response = await this.httpClient.fetchWithError<StatisticsResponse>(
        `/statistics?${queryParams.toString()}`
      );

      // Transform data for Excel
      const data = response.Statistics.map(stat => ({
        Date: new Date(stat.Date).toLocaleDateString(),
        'Total Bandwidth (GB)': (stat.TotalBytes / (1024 * 1024 * 1024)).toFixed(2),
        'Total Requests': stat.TotalRequests,
        'Cache Hit Rate (%)': ((stat.CacheHits / stat.TotalRequests) * 100).toFixed(2)
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Add headers
      XLSX.utils.book_append_sheet(wb, ws, "Bandwidth Usage");

      // Generate Excel file
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const fileName = `bandwidth_stats_${new Date().toISOString().split('T')[0]}.xlsx`;
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, fileName);

    } catch (error) {
      console.error("Error exporting bandwidth stats:", error);
      throw error instanceof Error 
        ? error 
        : new Error("Failed to export bandwidth statistics");
    }
  }
}
