import { useState, useCallback, useEffect } from 'react';
import { bunnyService } from '../lib/bunny-service';
import { Video } from '../lib/bunny/types';
import { showToast } from './use-toast';
import { cache } from '../lib/cache';
import { BunnyDownloadService } from '../lib/bunny/services/download-service';
import { useToast } from './use-toast';

export function useVideos(selectedLibraryId?: string, selectedCollectionId?: string) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortedVideos, setSortedVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});
  const { toast } = useToast();

  // Sort videos by lecture and question numbers
  const sortVideos = useCallback((videos: Video[]) => {
    return [...videos].sort((a, b) => {
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
  }, []);

  // Fetch videos from the selected library and collection
  const fetchVideos = useCallback(async () => {
    if (!selectedLibraryId || !selectedCollectionId) {
      setVideos([]);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      console.log('[useVideos] Fetching videos for:', {
        libraryId: selectedLibraryId,
        collectionId: selectedCollectionId
      });

      const accessToken = cache.get(`library_${selectedLibraryId}_api`) || "";
      const fetchedVideos = await bunnyService.getVideos(
        selectedLibraryId,
        selectedCollectionId,
        accessToken
      );
      
      console.log('[useVideos] Fetch complete:', {
        videosCount: fetchedVideos.length
      });

      setVideos(fetchedVideos);
      setSortedVideos(sortVideos(fetchedVideos));

    } catch (err) {
      console.error('[useVideos] Error fetching videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
      showToast({
        title: 'Error',
        description: 'Failed to fetch videos. Please try again.',
        variant: 'destructive',
      });
      setVideos([]);
      setSortedVideos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLibraryId, selectedCollectionId, sortVideos]);

  // Fetch videos when library or collection changes
  useEffect(() => {
    fetchVideos();
  }, [fetchVideos, selectedLibraryId, selectedCollectionId]);

  // Helper function to copy to clipboard
  const copyToClipboard = async (text: string): Promise<void> => {
    if (!navigator.clipboard) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
      }
      
      document.body.removeChild(textArea);
      return;
    }
    
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      throw err;
    }
  };

  // Get and copy embed code for a video
  const getEmbedCode = async (videoGuid: string, videoTitle: string) => {
    if (!selectedLibraryId) {
      console.error("[useVideos] Cannot get embed code - no library selected");
      return;
    }
  
    try {
      const embedCode = await bunnyService.getVideoEmbedCode(
        selectedLibraryId,
        videoGuid,
      );
  
      if (!embedCode) {
        throw new Error("Embed code not found");
      }
  
      await copyToClipboard(embedCode);
  
      setCopiedStates(prev => ({ ...prev, [videoGuid]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [videoGuid]: false }));
      }, 2000);
  
    } catch (error) {
      console.error('[useVideos] Failed to get/copy embed code:', error);
      showToast({
        title: 'Error',
        description: 'Failed to get or copy video embed code.',
        variant: 'destructive',
      });
    }
  };

  // Copy embed codes for all selected videos
  const copySelectedVideos = async () => {
    if (selectedVideos.size === 0) return;
  
    try {
      console.log('[useVideos] Copying embed codes for selected videos:', selectedVideos.size);
      
      const selectedVideosList = videos.filter(v => selectedVideos.has(v.guid));
      const embedCodes = await Promise.all(
        selectedVideosList.map(async (video) => {
          const embedCode = await bunnyService.getVideoEmbedCode(
            selectedLibraryId,
            video.guid,
          );
          return embedCode;
        })
      );
  
      const formattedCodes = embedCodes.join('\n');
      await copyToClipboard(formattedCodes);
  
      const newCopiedStates = {};
      selectedVideosList.forEach(video => {
        newCopiedStates[video.guid] = true;
      });
      setCopiedStates(newCopiedStates);
  
      setTimeout(() => {
        setCopiedStates({});
      }, 2000);
  
    } catch (error) {
      console.error('[useVideos] Failed to copy selected videos:', error);
      showToast({
        title: 'Error',
        description: 'Failed to copy embed codes for selected videos.',
        variant: 'destructive',
      });
    }
  };

  // Handle checkbox change with shift-click support
  const handleCheckboxChange = (videoGuid: string, index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    // Access shiftKey from native event
    const isShiftPressed = event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false;
  
    setSelectedVideos((prev) => {
      const newSet = new Set(prev);
      
      if (isShiftPressed && lastCheckedIndex !== null) {
        // Get the range of videos between last checked and current
        const start = Math.min(lastCheckedIndex, index);
        const end = Math.max(lastCheckedIndex, index);
        
        // Get the selection state from the target checkbox
        const shouldSelect = event.target.checked;
        
        // Apply the same selection state to all videos in range
        sortedVideos.slice(start, end + 1).forEach((video) => {
          if (shouldSelect) {
            newSet.add(video.guid);
          } else {
            newSet.delete(video.guid);
          }
        });
      } else {
        // Normal toggle behavior
        if (event.target.checked) {
          newSet.add(videoGuid);
        } else {
          newSet.delete(videoGuid);
        }
      }
      
      return newSet;
    });
    
    setLastCheckedIndex(index);
  };

  // Enhanced download video function with proper quality selection and correct URL format
  const downloadVideo = useCallback(async (videoGuid: string, videoTitle: string, quality: string) => {
    if (!selectedLibraryId) {
      toast({
        title: "❌ خطأ",
        description: "يجب اختيار مكتبة أولاً",
        variant: "destructive"
      });
      return;
    }

    try {
      toast({
        title: "📥 بدء التحميل",
        description: `جاري تحميل ${videoTitle} بجودة ${quality}...`,
        variant: "default"
      });

      await BunnyDownloadService.downloadVideo(
        videoGuid, 
        videoTitle, 
        quality, 
        selectedLibraryId
      );

      toast({
        title: "✅ تم بدء التحميل",
        description: `تم بدء تحميل ${videoTitle} بجودة ${quality}`,
        variant: "success"
      });

    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "❌ فشل التحميل",
        description: error instanceof Error ? error.message : "حدث خطأ أثناء التحميل",
        variant: "destructive"
      });
    }
  }, [selectedLibraryId, toast]);

  return {
    videos: sortVideos(videos),
    sortedVideos,
    selectedVideos,
    setSelectedVideos,
    selectAll,
    setSelectAll,
    lastCheckedIndex,
    setLastCheckedIndex,
    copiedStates,
    setCopiedStates,
    loading,
    error,
    getEmbedCode,
    copySelectedVideos,
    handleCheckboxChange,
    fetchVideos,
    downloadVideo
  };
}
