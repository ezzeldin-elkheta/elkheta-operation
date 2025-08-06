import {
  VideoUploadConfig,
  DEFAULT_UPLOAD_CONFIG,
  ProcessingStatus,
} from "../types/bunny";
import { bunnyService } from "./bunny-service";
import { parseFilename, determineCollection } from './filename-parser'; // Added determineCollection
import { ParseResult, ParsedFilename as FilenameParserParsedFilename } from '../types/filename-parser';
import type { UploadProgress } from './bunny/types';

interface ParsedFilename {
  type?: 'RE' | 'QV' | 'FULL';
  academicYear?: string;
  term?: string;
  suggestedLibraries?: string[];
}

interface QueueItem {
  id: string;
  file: File;
  parsed: ParsedFilename | null;
  libraryId?: string;
  collectionId?: string;
  status: {
    status: "pending" | "processing" | "completed" | "error";
    progress: number;
    error?: string;
  };
  attempts: number;
  totalSize?: number;
  uploadedSize?: number;
  uploadSpeed?: number;
  timeRemaining?: number;
  progress?: number;
}

interface UploadGroup {
  id: string;
  files: QueueItem[];
  collectionId: string;
  suggestedLibraries: string[];
  status: 'pending' | 'needsLibrary' | 'ready';
}

export class UploadQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private config: VideoUploadConfig;
  private groups: Map<string, UploadGroup> = new Map();

  constructor(config: Partial<VideoUploadConfig> = {}) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
  }

  /**
   * إضافة ملف إلى قائمة الانتظار
   * @param file - الملف المراد رفعه
   * @param libraryId - معرف المكتبة
   * @param collectionId - معرف المجموعة
   * @returns معرف الملف في قائمة الانتظار
   */
  add(file: File, libraryId: string, collectionId: string): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.queue.push({
      id,
      file,
      parsed: null,
      libraryId,
      collectionId,
      status: { status: "pending", progress: 0 },
      attempts: 0,
    });

    this.processQueue(); // بدء المعالجة
    return id;
  }

  addFile(file: File): string {
    const parsedFilename = parseFilename(file.name);
    const parseResult = {
      filename: file.name,
      parsed: parsedFilename,
      libraryMatch: { // Add mock library match if not available
        library: null,
        confidence: 0,
        alternatives: []
      }
    };

    const collectionResult = determineCollection(parseResult.parsed || { type: 'FULL', academicYear: '' });

    const groupId = findMatchingGroup(file.name);

    const parsed: ParsedFilename | null = parseResult.parsed ? {
      type: parseResult.parsed.type,
      academicYear: parseResult.parsed.academicYear,
      term: parseResult.parsed.term,
      suggestedLibraries: parseResult.libraryMatch?.alternatives?.map(lib => lib.id)
    } : null;

    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, {
        id: groupId,
        files: [],
        collectionId: '', // سيتم تحديده لاحقاً
        suggestedLibraries: [],
        status: 'pending'
      });
    }

    const group = this.groups.get(groupId)!;

    const queueItem: QueueItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      parsed: parsed,
      status: { status: "pending", progress: 0 },
      attempts: 0
    };

    group.files.push(queueItem);

    if (parseResult.libraryMatch?.alternatives?.length) {
      const currentLibs = new Set(group.suggestedLibraries);
      parseResult.libraryMatch.alternatives.forEach(lib => currentLibs.add(lib.id));
      group.suggestedLibraries = Array.from(currentLibs);
    }

    this.updateGroupStatus(groupId);

    return queueItem.id;
  }

  private updateGroupStatus(groupId: string) {
    const group = this.groups.get(groupId);
    if (!group) return;

    const allFilesParsed = group.files.every(item => item.parsed);
    const hasLibrary = group.files.some(item => item.parsed?.suggestedLibraries?.length > 0);

    group.status = allFilesParsed 
      ? (hasLibrary ? 'ready' : 'needsLibrary')
      : 'pending';
  }

  async processGroup(groupId: string, selectedLibrary?: string) {
    const group = this.groups.get(groupId);
    if (!group) return;

    for (const item of group.files) {
      if (!item.libraryId || !item.collectionId) return;
      
      if (selectedLibrary) {
        await this.uploadFile(item);
      } else if (item.parsed?.suggestedLibraries?.[0]) {
        await this.uploadFile(item);
      }
    }
  }

  /**
   * معالجة قائمة الانتظار
   */
  private async processQueue() {
    if (this.processing.size >= this.config.maxConcurrent) return;

    const next = this.queue.find(
      (item) =>
        item.status.status === "pending" && !this.processing.has(item.id),
    );

    if (!next) return;

    this.processing.add(next.id);
    next.status = { status: "processing", progress: 0 };

    try {
      await this.uploadFile(next);
      next.status = { status: "completed", progress: 100 };
    } catch (error) {
      if (next.attempts < this.config.retryAttempts) {
        next.attempts++;
        next.status = { status: "pending", progress: 0 };
      } else {
        next.status = {
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed",
        };
      }
    } finally {
      this.processing.delete(next.id);
      this.processQueue();
    }
  }

  /**
   * رفع الملف إلى Bunny.net
   * @param item - العنصر المراد رفعه
   */
  private async uploadFile(item: QueueItem): Promise<void> {
    if (!item.libraryId) throw new Error("Library ID is required");
    if (!item.collectionId) throw new Error("Collection ID is required");

    try {
      // Initialize upload progress tracking
      item.totalSize = item.file.size;
      item.uploadedSize = 0;
      item.uploadSpeed = 0;
      let lastProgressUpdate = Date.now();
      let lastUploadedBytes = 0;

      const result = await bunnyService.uploadVideo(
        item.file,
        item.libraryId,
        (progress) => {
          const now = Date.now();
          const timeDiff = (now - lastProgressUpdate) / 1000; // Convert to seconds
          
          if (timeDiff > 0) {
            const bytesDiff = progress.loaded - lastUploadedBytes;
            item.uploadSpeed = bytesDiff / timeDiff;
            item.uploadedSize = progress.loaded;
            item.progress = progress.percentage;
            
            // Calculate time remaining
            if (item.uploadSpeed > 0) {
              const remainingBytes = progress.total - progress.loaded;
              item.timeRemaining = Math.round(remainingBytes / item.uploadSpeed);
            }
            
            lastProgressUpdate = now;
            lastUploadedBytes = progress.loaded;
          }
          
          // Update status
          item.status = { 
            status: "processing", 
            progress: progress.percentage 
          };
        },
        item.collectionId
      );

      // Update status on completion
      item.status = { 
        status: "completed", 
        progress: 100 
      };
      item.uploadedSize = item.totalSize;
      item.uploadSpeed = 0;
      item.timeRemaining = 0;

    } catch (error) {
      item.status = {
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : "Upload failed"
      };
      item.uploadSpeed = 0;
      item.timeRemaining = 0;
      throw error;
    }
  }

  /**
   * الحصول على حالة العنصر
   * @param id - معرف العنصر
   * @returns حالة العنصر أو null إذا لم يتم العثور عليه
   */
  getStatus(id: string): ProcessingStatus | null {
    const item = this.queue.find((i) => i.id === id);
    return item ? item.status : null;
  }

  /**
   * مسح قائمة الانتظار
   */
  clear() {
    this.queue = [];
    this.processing.clear();
  }
}

// Add these helper functions
function findMatchingGroup(filename: string): string {
  return filename.split('-')[0];
}
