import React, { useState, useEffect } from 'react';
import { bunnyService } from '../lib/bunny-service';
import { Button } from './ui/button';
import { Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface VideoQualitySelectorProps {
  libraryId: string;
  videoGuid: string;
  videoTitle: string;
  onDownload: (quality: string) => void;
  accessToken?: string;
}

export const VideoQualitySelector: React.FC<VideoQualitySelectorProps> = ({
  libraryId,
  videoGuid,
  videoTitle,
  onDownload,
  accessToken
}) => {
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadQualities = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const qualities = await bunnyService.getAvailableQualities(libraryId, videoGuid, accessToken);
        setAvailableQualities(qualities);
        
        // Auto-select the highest quality
        if (qualities.length > 0) {
          setSelectedQuality(qualities[0]);
        }
        
      } catch (err) {
        console.error('Error loading video qualities:', err);
        setError('Failed to load available qualities');
        // Fallback to common qualities
        const fallbackQualities = ['1080p', '720p', '480p', '360p'];
        setAvailableQualities(fallbackQualities);
        setSelectedQuality(fallbackQualities[0]);
      } finally {
        setLoading(false);
      }
    };

    if (libraryId && videoGuid) {
      loadQualities();
    }
  }, [libraryId, videoGuid, accessToken]);

  const handleDownload = () => {
    if (selectedQuality) {
      onDownload(selectedQuality);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Loading qualities...</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2`}
        >
          <Download className="w-4 h-4" />
          تحميل
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>اختر جودة التحميل</DropdownMenuLabel>
        {availableQualities.map((quality) => (
          <DropdownMenuItem 
            key={quality}
            onClick={() => onDownload(videoGuid, videoTitle, quality)}
            className="cursor-pointer flex items-center gap-2"
          >
            <Download className="w-3 h-3" />
            جودة {quality}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default VideoQualitySelector;
