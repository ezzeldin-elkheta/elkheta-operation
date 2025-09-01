import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Download, Settings, Loader2, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdvancedSettings from "./AdvancedSettings";
import { Year } from "@/types/common";
import YearDropdown from "@/components/YearDropdown";

interface ToolbarSectionProps {
  isExporting: boolean;
  isExportingViews: boolean;
  isLoading: boolean;
  onExportBandwidth: () => Promise<void>;
  onExportViews: (year?: number, month?: number) => Promise<void>;
  onFetchLibraryData: () => Promise<void>;
  uploadSettings: {
    chunkSize: number;
    maxConcurrentUploads: number;
    useStreamingUpload: boolean;
    useTusThresholdMB?: number;
    retryAttempts?: number;
    timeoutMs?: number;
    enableAutoRetry?: boolean;
    enableConnectionCheck?: boolean;
    enableResumableSessions?: boolean;
    sessionExpiryHours?: number;
  };
  onSettingsChange: (settings: any) => void;
  selectedYear: Year;
  onYearChange: (year: Year) => void;
}

const ToolbarSection = ({
  isExporting,
  isExportingViews,
  isLoading,
  onExportBandwidth,
  onExportViews,
  onFetchLibraryData,
  uploadSettings,
  onSettingsChange,
  selectedYear,
  onYearChange
}: ToolbarSectionProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedViewsMonth, setSelectedViewsMonth] = useState<string>("all");

  const handleExportClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isExporting) {
      await onExportBandwidth();
    }
  };

  const handleViewsExportClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isExportingViews) {
      if (selectedViewsMonth === "all") {
        // Export all months (last 12 months)
        await onExportViews();
      } else {
        // Export specific month
        const [year, month] = selectedViewsMonth.split('-').map(Number);
        await onExportViews(year, month);
      }
    }
  };

  // Generate month options for the last 12 months
  const generateMonthOptions = () => {
    const options = [{ value: "all", label: "Last 12 Months" }];
    
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      options.push({
        value: monthKey,
        label: monthName
      });
    }
    
    return options;
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportClick}
          disabled={isExporting}
          className="hover-lift glass-effect"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Export Bandwidth Usage
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Select value={selectedViewsMonth} onValueChange={setSelectedViewsMonth}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleViewsExportClick}
            disabled={isExportingViews}
            className="hover-lift glass-effect"
          >
            {isExportingViews ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                جاري التحميل...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                عرض المشاهدات
              </>
            )}
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onFetchLibraryData}
          disabled={isLoading}
          className="hover-lift glass-effect"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Refresh Library Data
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <YearDropdown selectedYear={selectedYear} onYearChange={onYearChange} />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(true)}
          className="hover-lift glass-effect"
        >
          <Settings className="w-4 h-4 mr-2" />
          Upload Settings
        </Button>
      </div>

      <AdvancedSettings
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={uploadSettings}
        onSettingsChange={onSettingsChange}
      />
    </div>
  );
};

export default ToolbarSection;
