import { LibraryMatch, LibraryInfo, QueueItem } from "./types";
import { parseFilename, findMatchingLibrary, determineCollection, determineLibrary } from "../filename-parser";
import { bunnyService } from "../bunny-service";
import { showToast } from "../../hooks/use-toast";
import { dataStorage } from "../data-storage";
import { LibraryInfo as LibraryDataInfo } from "../../types/library-data";

export class LibraryMatcher {
  // Cache for successful matches to speed up future matches - enhanced with pattern variations
  private matchCache = new Map<string, { libraryId: string, libraryName: string, confidence: number }>();
  // Cache for user-selected matches - these will have highest priority
  private userSelectionCache = new Map<string, { libraryId: string, libraryName: string }>();
  // Cache for subject/branch conflicts (like SCI-AR combinations)
  private subjectConflictCache = new Map<string, { libraryId: string, libraryName: string }>();
  // Manual mappings for learning from manual selections
  private manualMappings = new Map<string, { libraryId: string, libraryName: string }>();

  constructor() {
    this.loadManualMappings(); // Load saved mappings
  }

  /**
   * Attempts to match a library for the given file item.
   */
  async tryMatchLibrary(item: QueueItem, failedItems: QueueItem[], queue: QueueItem[]): Promise<void> {
    try {
      const libraries = await this.getLibraries();
      if (!libraries || libraries.length === 0) {
        throw new Error("No libraries available to match against.");
      }

      const selectedYear = item.metadata?.year || "2026";
      const parseResult = parseFilename(item.filename, selectedYear);
      if (!parseResult) {
        throw new Error("Could not parse filename");
      }

      console.log(`🔍 Trying to match library for: ${item.filename}`, {
        mathType: parseResult.mathType,
        academicYear: parseResult.academicYear,
        branch: parseResult.branch,
        teacherCode: parseResult.teacherCode
      });

      // Try exact matches first (100% confidence)
      const exactFilenameMatch = this.userSelectionCache.get(item.filename);
      if (exactFilenameMatch) {
        this.applyMatchAndCache(item, exactFilenameMatch.libraryId, exactFilenameMatch.libraryName, 100, parseResult, selectedYear);
        return;
      }

      // *** استخدام الدالة المحسنة بدلاً من findBestMatch الداخلية ***
      const bestMatch = findMatchingLibrary(parseResult, libraries);
      
      // Check cached patterns for this filename pattern
      const patternKey = this.getFilePatternKey(item.filename, parseResult);
      const patternMatch = this.matchCache.get(patternKey);

      if (patternMatch) {
        // Use cached match if available
        this.applyMatchAndCache(item, patternMatch.libraryId, patternMatch.libraryName, patternMatch.confidence, parseResult, selectedYear);
        return;
      }

      const suggestedLibraries = this.getSuggestedLibraries(parseResult, libraries, bestMatch?.library?.id);
      item.metadata.suggestedLibraries = suggestedLibraries.map(match => ({
        id: match.id,
        name: match.name,
        confidence: match.score || 0
      }));

      // Auto-apply match if meets any of these criteria:
      // 1. Has high confidence (75% or higher - خففنا الشرط شوية)
      // 2. Exact teacher code match present in library name
      // 3. PURE/APPLIED match with good confidence (70% or higher)
      // 4. Meets special matching rules
      const hasHighConfidence = bestMatch && bestMatch.confidence >= 75;
      const exactTeacherCodeMatch = parseResult.teacherCode && bestMatch?.library?.name.includes(parseResult.teacherCode);
      const hasMathTypeMatch = parseResult.mathType && bestMatch && bestMatch.confidence >= 70 && 
        bestMatch.library.name.toUpperCase().includes(parseResult.mathType);
      const hasSpecialMatch = bestMatch && this.checkSpecialMatchRules(parseResult, bestMatch);

      console.log(`📊 Match criteria for "${item.filename}":`, {
        hasHighConfidence,
        exactTeacherCodeMatch,
        hasMathTypeMatch,
        hasSpecialMatch,
        confidence: bestMatch?.confidence || 0
      });

      if (bestMatch?.library && (hasHighConfidence || exactTeacherCodeMatch || hasMathTypeMatch || hasSpecialMatch)) {
        this.applyMatchAndCache(item, bestMatch.library.id, bestMatch.library.name, bestMatch.confidence, parseResult, selectedYear);
        console.log(`✅ Auto-matched "${item.filename}" to library "${bestMatch.library.name}" (confidence: ${bestMatch.confidence}%)`);
      } else {
        // Needs manual selection
        item.metadata.needsManualSelection = true;
        item.metadata.library = "";
        item.metadata.libraryName = "";
        item.metadata.suggestedLibraryName = this.determineSuggestedLibraryName(item.filename, parseResult.academicYear);
        
        const collectionResult = determineCollection(parseResult, selectedYear);
        item.metadata.collection = collectionResult.name;
        item.metadata.reason = collectionResult.reason;
        item.metadata.confidence = bestMatch?.confidence || 0;
        
        console.log(`⚠️ Manual selection needed for "${item.filename}" (confidence: ${bestMatch?.confidence || 0}%)`);
      }

    } catch (error) {
      console.error(`Error matching library for ${item.filename}:`, error);
      item.metadata.needsManualSelection = true;
      item.metadata.library = "";
      item.metadata.libraryName = "";
      const collectionResultFallback = determineCollection(parseFilename(item.filename, item.metadata?.year || "2026"), item.metadata?.year || "2026");
      item.metadata.collection = collectionResultFallback.name;
      item.metadata.confidence = 0;
    }
  }

  /**
   * Apply match to item and notify with appropriate message
   */
  private applyMatchAndNotify(
    item: QueueItem, 
    libraryId: string, 
    libraryName: string, 
    confidence: number, 
    matchSource: string,
    year: string
  ): void {
    item.metadata.library = libraryId;
    item.metadata.libraryName = libraryName;
    item.metadata.needsManualSelection = false;
    item.metadata.confidence = confidence;
    
    const parseResult = parseFilename(item.filename, year);
    const collectionResult = determineCollection(parseResult, year);
    item.metadata.collection = collectionResult.name;
    item.metadata.reason = collectionResult.reason;

    showToast({
      title: "✅ مكتبة محددة تلقائياً",
      description: `تم تعيين "${item.filename}" للمكتبة "${libraryName}" ${matchSource} (ثقة: ${confidence}%)`,
      variant: "success",
      duration: 2000
    });
  }

  /**
   * Apply match and cache various patterns for future use - محسنة لدعم PURE/APPLIED
   */
  private applyMatchAndCache(
    item: QueueItem, 
    libraryId: string, 
    libraryName: string, 
    confidence: number, 
    parseResult: any,
    year: string
  ): void {
    // Basic application
    item.metadata.library = libraryId;
    item.metadata.libraryName = libraryName;
    item.metadata.needsManualSelection = false;
    item.metadata.confidence = confidence;
    
    // Set collection based on parsed information
    const collectionResult = determineCollection(parseResult, year);
    item.metadata.collection = collectionResult.name;
    item.metadata.reason = collectionResult.reason;
    
    // Cache for future matches - multiple patterns
    const patternKey = this.getFilePatternKey(item.filename, parseResult);
    this.matchCache.set(patternKey, {
      libraryId,
      libraryName,
      confidence
    });
    
    // *** Cache grade-subject-mathType-teacher pattern ***
    const enhancedKey = this.getEnhancedPatternKey(parseResult);
    if (enhancedKey) {
      this.matchCache.set(enhancedKey, {
        libraryId,
        libraryName,
        confidence
      });
    }
    
    // Cache alternate patterns for more coverage
    const alternateKeys = this.generateAlternateKeys(parseResult);
    alternateKeys.forEach(key => {
      if (key && key !== patternKey) {
        this.matchCache.set(key, {
          libraryId,
          libraryName,
          confidence: confidence - 5 // Slightly lower confidence for alternates
        });
      }
    });
    
    // Check if this is a subject conflict case
    const conflictKey = this.getSubjectConflictKey(item.filename, parseResult);
    if (conflictKey) {
      this.subjectConflictCache.set(conflictKey, {
        libraryId,
        libraryName
      });
    }

    console.log(`💾 Cached match for patterns:`, {
      patternKey,
      enhancedKey,
      alternateKeys: alternateKeys.length,
      conflictKey
    });
  }

  /**
   * *** دالة جديدة لإنشاء key محسن يشمل PURE/APPLIED ***
   */
  private getEnhancedPatternKey(parsed: any): string | null {
    if (!parsed) return null;
    
    const parts = [];
    
    if (parsed.academicYear) parts.push(parsed.academicYear);
    if (parsed.mathType) parts.push(parsed.mathType); // PURE أو APPLIED
    if (parsed.branch) parts.push(parsed.branch);
    if (parsed.teacherCode) parts.push(parsed.teacherCode);
    
    if (parts.length >= 2) {
      return `enhanced:${parts.join('-')}`;
    }
    
    return null;
  }

  /**
   * Creates a special key for subject conflict patterns like SCI-AR combinations
   */
  private getSubjectConflictKey(filename: string, parsed: any): string | null {
    if (!parsed) return null;
    
    // Check for SCI-AR conflict pattern
    if (filename.match(/SCI.*AR|AR.*SCI/i)) {
      const parts = [];
      if (parsed.academicYear) parts.push(parsed.academicYear);
      if (parsed.mathType) parts.push(parsed.mathType); // إضافة mathType
      if (parsed.teacherCode) parts.push(parsed.teacherCode);
      else if (parsed.teacherName) {
        const simplifiedName = parsed.teacherName.split(' ')[0].toLowerCase();
        parts.push(simplifiedName);
      }
      
      if (parts.length > 0) {
        return `conflict:${parts.join('-')}`;
      }
    }
    return null;
  }

  /**
   * Get a key based on teacher identification for strong matching
   */
  private getTeacherPatternKey(filename: string, parsed: any): string | null {
    if (!parsed) return null;
    
    const parts = [];
    
    // Include grade/level for context
    if (parsed.academicYear) parts.push(parsed.academicYear);
    
    // *** إضافة mathType للـ teacher pattern ***
    if (parsed.mathType) parts.push(parsed.mathType);
    
    // Focus on teacher identification
    if (parsed.teacherCode) {
      parts.push(parsed.teacherCode);
    } else if (parsed.teacherName) {
      // Normalize teacher name to handle variations
      const normalizedName = this.normalizeTeacherName(parsed.teacherName);
      if (normalizedName.length >= 4) { // Only if name is substantial
        parts.push(`name:${normalizedName}`);
      }
    }
    
    if (parts.length >= 2) {
      return `teacher:${parts.join('-')}`;
    }
    
    return null;
  }

  /**
   * Get a key based on grade, subject, mathType, and teacher
   */
  private getGradeSubjectTeacherKey(parsed: any): string | null {
    if (!parsed) return null;
    
    const parts = [];
    
    if (parsed.academicYear) parts.push(parsed.academicYear);
    if (parsed.mathType) parts.push(parsed.mathType); // *** إضافة mathType ***
    if (parsed.branch) parts.push(parsed.branch);
    
    // Add teacher identifier (code or name)
    if (parsed.teacherCode) {
      parts.push(parsed.teacherCode);
    } else if (parsed.teacherName) {
      const firstNamePart = parsed.teacherName.split(' ')[0];
      if (firstNamePart && firstNamePart.length >= 3) {
        parts.push(firstNamePart.toLowerCase());
      }
    }
    
    if (parts.length >= 2) {
      return parts.join('-');
    }
    
    return null;
  }

  /**
   * Generate alternate key variations to improve matching - محسنة لدعم PURE/APPLIED
   */
  private generateAlternateKeys(parsed: any): string[] {
    const keys: string[] = [];
    
    if (!parsed) return keys;
    
    // *** إضافة مفاتيح خاصة بـ PURE/APPLIED ***
    if (parsed.mathType && parsed.academicYear && parsed.teacherCode) {
      // مفتاح أساسي: السنة + النوع + كود المدرس
      keys.push(`${parsed.academicYear}-${parsed.mathType}-${parsed.teacherCode}`);
      
      // مفتاح مع الفرع أيضاً
      if (parsed.branch) {
        keys.push(`${parsed.academicYear}-${parsed.mathType}-${parsed.branch}-${parsed.teacherCode}`);
      }
    }
    
    // Create branch/subject variations
    if (parsed.academicYear && parsed.branch) {
      // 1. Try with branch/subject swapped if it's AR/SCI
      if (parsed.branch === 'SCI') {
        const key = `${parsed.academicYear}${parsed.mathType ? '-' + parsed.mathType : ''}-AR${parsed.teacherCode ? '-' + parsed.teacherCode : ''}`;
        keys.push(key);
      } else if (parsed.branch === 'AR') {
        const key = `${parsed.academicYear}${parsed.mathType ? '-' + parsed.mathType : ''}-SCI${parsed.teacherCode ? '-' + parsed.teacherCode : ''}`;
        keys.push(key);
      }
      
      // 2. Try with just grade, mathType and teacher (no branch)
      if (parsed.teacherCode) {
        keys.push(`${parsed.academicYear}${parsed.mathType ? '-' + parsed.mathType : ''}-${parsed.teacherCode}`);
      } else if (parsed.teacherName) {
        const firstNamePart = parsed.teacherName.split(' ')[0];
        if (firstNamePart) {
          keys.push(`${parsed.academicYear}${parsed.mathType ? '-' + parsed.mathType : ''}-${firstNamePart.toLowerCase()}`);
        }
      }
    }
    
    // 3. If we have teacher code but no specific branch, try common ones
    if (parsed.academicYear && parsed.teacherCode && !parsed.branch) {
      const commonSubjects = ['AR', 'EN', 'SCI', 'MATH', 'SS'];
      commonSubjects.forEach(subj => {
        const key = `${parsed.academicYear}${parsed.mathType ? '-' + parsed.mathType : ''}-${subj}-${parsed.teacherCode}`;
        keys.push(key);
      });
    }
    
    return keys.filter(Boolean); // Filter out any that might be empty
  }

  /**
   * Check if the match should be accepted despite lower confidence - محسنة لدعم PURE/APPLIED
   */
  private checkSpecialMatchRules(parsed: any, bestMatch?: LibraryMatch | null): boolean {
    if (!bestMatch || !bestMatch.library) return false;

    // *** Rule 1: PURE/APPLIED match with good confidence ***
    if (parsed.mathType && bestMatch.library.name.toUpperCase().includes(parsed.mathType) && 
        bestMatch.confidence >= 65) {
      console.log(`✅ Special rule: mathType match (${parsed.mathType})`);
      return true;
    }

    // Rule 2: Exact teacher code match with reasonable confidence (>=55%)
    if (parsed.teacherCode && 
        bestMatch.library.name.includes(parsed.teacherCode) && 
        bestMatch.confidence >= 55) {
      console.log(`✅ Special rule: teacher code match`);
      return true;
    }

    // Rule 3: Academic year + subject + first part of teacher name (>=60%)
    if (parsed.academicYear && 
        parsed.branch &&
        parsed.teacherName &&
        bestMatch.library.name.startsWith(parsed.academicYear) && 
        bestMatch.library.name.includes(parsed.branch) &&
        bestMatch.confidence >= 60) {
      console.log(`✅ Special rule: year + branch + teacher name`);
      return true;
    }

    // Rule 4: Improved handling of SCI/AR confusion cases
    if (parsed.academicYear) {
      // Check for both SCI and AR in filename
      const hasSciAr = parsed.filename?.match(/SCI.*AR|AR.*SCI/i);
      
      if (hasSciAr && bestMatch.confidence >= 55) {
        const libNameLower = bestMatch.library.name.toLowerCase();
        
        // Match if the library contains either SCI or AR 
        if ((libNameLower.includes('-sci-') || libNameLower.includes('-ar-')) && 
            bestMatch.library.name.startsWith(parsed.academicYear)) {
          console.log(`✅ Special rule: SCI-AR confusion handling`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Generate a pattern key from filename for caching - محسنة لدعم PURE/APPLIED
   */
  private getFilePatternKey(filename: string, parsed?: any): string {
    try {
      const parseResult = parsed || parseFilename(filename);
      if (!parseResult) return filename.split(/[_\-]/)[0];
      
      const keyParts = [];
      
      if (parseResult.academicYear) keyParts.push(parseResult.academicYear);
      if (parseResult.mathType) keyParts.push(parseResult.mathType); // *** إضافة mathType ***
      if (parseResult.branch) keyParts.push(parseResult.branch);
      if (parseResult.teacherCode) keyParts.push(parseResult.teacherCode);
      
      // If we have a teacher name but no code, include first part of teacher name
      if (!parseResult.teacherCode && parseResult.teacherName) {
        const firstNamePart = parseResult.teacherName.split(' ')[0];
        if (firstNamePart) keyParts.push(firstNamePart.toLowerCase());
      }
      
      return keyParts.join('-');
    } catch (e) {
      return filename.split(/[_\-]/)[0]; // Fallback to just first part
    }
  }

  /**
   * Enhanced teacher name normalization for better matching
   */
  private normalizeTeacherName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')  // Remove all whitespace
      .replace(/[^\p{L}\p{N}]/gu, '') // Remove non-alphanumeric chars (Unicode aware)
      .replace(/^(el|al)/, ''); // Remove common Arabic name prefixes
  }
  
  // *** حذف findBestMatch لأننا بنستخدم findMatchingLibrary المحسنة ***

  /**
   * Get all available libraries
   */
  private async getLibraries(): Promise<LibraryDataInfo[]> {
    const data = await dataStorage.getLibraryData();
    if (!data?.libraries) return [];
    return data.libraries;
  }

  /**
   * Get list of suggested libraries based on parsed metadata and matching rules
   */
  private getSuggestedLibraries(parsed: any, libraries: LibraryDataInfo[], currentLibraryId?: string): Array<{ id: string; name: string; score?: number }> {
    const suggestions: Array<{ id: string; name: string; score?: number }> = [];
    const seen = new Set<string>();

    // Add current library first if exists
    if (currentLibraryId) {
      const currentLib = libraries.find(lib => lib.id === currentLibraryId);
      if (currentLib) {
        suggestions.push({
          id: currentLib.id,
          name: currentLib.name,
          score: 100
        });
        seen.add(currentLib.id);
      }
    }

    // Add suggested libraries from best match logic
    libraries.forEach(lib => {
      if (!seen.has(lib.id)) {
        const score = this.calculateMatchScore(lib.name, parsed);
        if (score > 30) { // Only include libraries with decent match score
          suggestions.push({
            id: lib.id,
            name: lib.name,
            score
          });
          seen.add(lib.id);
        }
      }
    });

    // Sort by score descending and limit to top 5
    return suggestions
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }

  /**
   * Calculate match score between library name and parsed filename - محسنة لدعم PURE/APPLIED
   */
  private calculateMatchScore(libraryName: string, parsed: any): number {
    let score = 0;
    const normalizedLibName = libraryName.toLowerCase();

    if (parsed.academicYear && normalizedLibName.includes(parsed.academicYear.toLowerCase())) score += 30;
    if (parsed.teacherCode && normalizedLibName.includes(parsed.teacherCode.toLowerCase())) score += 40;
    
    // *** إضافة نقاط خاصة لـ PURE/APPLIED ***
    if (parsed.mathType) {
      if (normalizedLibName.includes(parsed.mathType.toLowerCase())) {
        score += 35; // نقاط عالية للمطابقة الصحيحة
      }
    }
    
    if (parsed.teacherName) {
      const nameParts = parsed.teacherName.toLowerCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 2 && normalizedLibName.includes(part)) score += 15;
      }
    }
    if (parsed.branch && normalizedLibName.includes(parsed.branch.toLowerCase())) score += 15;

    return Math.min(score, 100);
  }

  /**
   * Extract teacher name from library name using common patterns
   */
  private extractTeacherNameFromLibrary(name: string): string {
    // Remove year and common prefixes including PURE/APPLIED
    const cleaned = name.replace(/^[SM][1-6]-/, '')
                      .replace(/^(PURE|APPLIED)-/, '') // *** إضافة PURE/APPLIED ***
                      .replace(/^(SCI|AR|EN|MATH)-/, '')
                      .replace(/^P\d{4}-/, '');
    
    // Return first word-like segment that's not a known code/prefix
    const parts = cleaned.split(/[-_]/);
    return parts.find(p => /^[A-Za-z]{3,}$/.test(p)) || '';
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateNameSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const a = str1.toLowerCase();
    const b = str2.toLowerCase();
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - this.editDistance(longer, shorter)) / longerLength;
  }

  /**
   * Edit distance calculation for similarity
   */
  private editDistance(s1: string, s2: string): number {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) costs[j] = j;
        else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Learns from manual library selections to improve future matching.
   */
  learnFromManualSelection(filename: string, libraryId: string, libraryName: string): void {
    // *** تحسين التعلم ليشمل PURE/APPLIED ***
    const parsed = parseFilename(filename);
    
    // إضافة الملف نفسه للكاش
    this.userSelectionCache.set(filename, { libraryId, libraryName });
    
    // إضافة نمط محسن للكاش
    if (parsed) {
      const enhancedKey = this.getEnhancedPatternKey(parsed);
      if (enhancedKey) {
        this.matchCache.set(enhancedKey, { 
          libraryId, 
          libraryName, 
          confidence: 95 // ثقة عالية للاختيارات اليدوية
        });
      }
      
      const patternKey = this.getFilePatternKey(filename, parsed);
      this.matchCache.set(patternKey, { 
        libraryId, 
        libraryName, 
        confidence: 90 
      });
    }
    
    const keywords = filename.split(/[\s\-_]+/).filter(word => word.length > 2 && isNaN(Number(word)));
    const key = keywords.join('|').toLowerCase();

    if (key && !this.manualMappings.has(key)) {
      console.log(`📚 Learning: Mapping keywords "${key}" from "${filename}" to Library "${libraryName}" (${libraryId})`);
      this.manualMappings.set(key, { libraryId, libraryName });
      this.saveManualMappings();
    }
  }

  /**
   * Saves the learned manual mappings to local storage.
   */
  private saveManualMappings(): void {
    try {
      const mappingsArray = Array.from(this.manualMappings.entries());
      localStorage.setItem('manualLibraryMappings', JSON.stringify(mappingsArray));
    } catch (error) {
      console.error("Error saving manual mappings to local storage:", error);
    }
  }

  /**
   * Loads learned manual mappings from local storage.
   */
  private loadManualMappings(): void {
    try {
      const savedMappings = localStorage.getItem('manualLibraryMappings');
      if (savedMappings) {
        const mappingsArray = JSON.parse(savedMappings);
        this.manualMappings = new Map(mappingsArray);
        console.log(`📚 Loaded ${this.manualMappings.size} manual library mappings.`);
      }
    } catch (error) {
      console.error("Error loading manual mappings from local storage:", error);
      this.manualMappings = new Map();
    }
  }

  /**
   * Determines a suggested library name based on filename parsing.
   */
  private determineSuggestedLibraryName(filename: string, year: string): string {
    try {
      const parsed = parseFilename(filename);
      return determineLibrary(parsed || { type: 'FULL', academicYear: year });
    } catch (error) {
      console.warn(`Error determining suggested library name for ${filename}:`, error);
      return "Unknown Library";
    }
  }

  /**
   * Checks if the parsed filename parts are in a logical order.
   */
  private checkPartsOrder(parsed: any): boolean {
    if (!parsed) return true;
    return true;
  }
}
