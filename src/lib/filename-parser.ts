import { ParsedFilename, LibraryInfo, ParseResult, CollectionResult, LibraryMatch, COLLECTIONS_CONFIG } from '../types/filename-parser';

export function normalizeFilename(filename: string): string {
  return filename
    // Remove file extension
    .replace(/\.[^/.]+$/, '')
    // Replace multiple dashes/underscores with single dash
    .replace(/[-_]{2,}/g, '-')
    // Remove brackets and parentheses
    .replace(/[\[\]()]/g, '')
    // Normalize spaces around dashes
    .replace(/\s*-\s*/g, '-')
    // Extract Arabic text within curly braces separately
    .replace(/\{([^}]+)\}/, (_, arabic) => `{${arabic.trim()}}`)
    .trim();
}

export function parseFilename(filename: string, year: string = "2026"): ParsedFilename {
  try {
    // Remove file extension and normalize separators
    const nameOnly = filename.split('.')[0]
      .replace(/--+/g, '-')
      .replace(/_/g, '-')
      .replace(/\s*-\s*/g, '-'); // Normalize spaces around dashes
    
    // Extract Arabic text within curly braces separately
    const arabicMatch = filename.match(/\{([^}]+)\}/);
    const arabicText = arabicMatch ? arabicMatch[1].trim() : undefined;

    // Remove Arabic part for easier component splitting
    const cleanName = nameOnly.replace(/\{[^}]+\}/, '').replace(/-$/, '').trim();

    // Split parts by dash (enhanced to handle cases where more than one dash is used as separator)
    const parts = cleanName.split('-').filter(Boolean);

    // Get academic year configs
    const configs = COLLECTIONS_CONFIG[year] || [];

    // Start with defaults
    const parsed: ParsedFilename = {
      type: 'FULL', // Default type
      academicYear: 'Unknown', // Default academic year
      arabicText,
      originalFilename: filename, // Store the original filename for reference
      mathType: undefined // إضافة حقل جديد للتمييز بين PURE و APPLIED
    };

    // ---------- ENHANCED PATTERN RECOGNITION LOGIC ----------

    // 1. First pass: Identify critical components regardless of position
    let teacherCodeIndex = -1;
    let yearLevelIndex = -1;
    let branchIndices: number[] = [];
    let mathTypeIndex = -1; // فهرس موقع PURE/APPLIED
    
    // Find key components and handle multiple branch identifiers (like SCI-AR)
    parts.forEach((part, index) => {
      // Teacher code pattern - more flexible now
      // Support both P0123 format and variations like P-0123
      const tcMatch = part.match(/^P[-]?(\d{4})$/i);
      if (tcMatch) {
        teacherCodeIndex = index;
        parsed.teacherCode = `P${tcMatch[1]}`.toUpperCase(); // Normalize to P0000 format
      }
      
      // Year/level pattern with more flexibility
      if (/^[JMS][1-6]$/i.test(part)) {
        yearLevelIndex = index;
        parsed.academicYear = part.toUpperCase(); // Normalize to uppercase
      }
      
      // *** إضافة محسّنة: التعرف على PURE/APPLIED ***
      if (/^(PURE|APPLIED)$/i.test(part)) {
        mathTypeIndex = index;
        parsed.mathType = part.toUpperCase() as 'PURE' | 'APPLIED';
        console.log(`🔍 Found mathType: ${parsed.mathType} at index ${index} in filename: ${filename}`);
      }
      
      // Branch pattern - gather ALL potential branch identifiers
      if (/^(AR|EN|SCI|SS|MATH|Math|BIO|CH|PHY|FR|IT|GEO|GEOG|STATS|STAST|ISC|COM|PHL|PSYCH|DEU|HX)$/i.test(part)) {
        branchIndices.push(index);
        
        // If we haven't set the primary branch yet, or this is an earlier branch in the name, use it
        if (!parsed.branch || index < branchIndices[0]) {
          parsed.branch = part.toUpperCase(); // Normalize to uppercase
        }
        
        // Track the second branch if exists (like AR in SCI-AR pattern)
        if (branchIndices.length > 1 && !parsed.secondaryBranch) {
          parsed.secondaryBranch = part.toUpperCase();
        }
      }
      
      // Term pattern (T1, T2) - more flexible
      if (/^T[12]$/i.test(part)) {
        parsed.term = part.toUpperCase(); // Normalize to uppercase
      }
      
      // Unit pattern (U1, U2, etc.)
      if (/^U\d+$/i.test(part)) {
        parsed.unit = part.toUpperCase(); // Normalize to uppercase
      }
      
      // Lesson pattern (L1, L2, etc.)
      if (/^L\d+$/i.test(part)) {
        parsed.lesson = part.toUpperCase(); // Normalize to uppercase
      }
      
      // Class pattern (C1, C2, etc.)
      if (/^C\d+$/i.test(part)) {
        parsed.class = part.toUpperCase(); // Normalize to uppercase
      }
    });

    // Special handling for SCI-AR conflict cases
    if (parsed.branch === 'SCI' && parts.includes('AR')) {
      parsed.hasBranchConflict = true;
    } else if (parsed.branch === 'AR' && parts.includes('SCI')) {
      parsed.hasBranchConflict = true;
    }

    // 2. Enhanced type detection
    if (cleanName.match(/\bRE\b/i) || cleanName.match(/revision/i)) {
      parsed.type = 'RE';
    } 
    // More comprehensive question/quiz detection - check for Q+number anywhere in the filename
    else if (
      cleanName.match(/[Qq]\d+/) || // Q or q followed by numbers anywhere in filename (Q1, q10, etc.)
      arabicText?.match(/[Qq]\d+/) || // Q or q followed by numbers in Arabic text
      cleanName.match(/\bquiz\b/i) ||  // "quiz" keyword
      cleanName.match(/\btest\b/i) // Test keyword
    ) {
      parsed.type = 'QV';
    }

    // 3. Extract teacher name with more precision
    const teacherNameParts = [];
    if (teacherCodeIndex >= 0) {
      // Collect all parts after teacher code as potential name parts
      for (let i = teacherCodeIndex + 1; i < parts.length; i++) {
        // Skip if this part looks like metadata (L1, U2, etc.)
        if (!/^[TULCQ]\d+$/i.test(parts[i])) {
          teacherNameParts.push(parts[i]);
        }
      }
    } 
    // If no teacher code found but year and branch exist, use parts after branch
    else if (yearLevelIndex >= 0 && branchIndices.length > 0) {
      // Use the last branch index as starting point 
      const lastBranchIdx = Math.max(...branchIndices);
      for (let i = lastBranchIdx + 1; i < parts.length; i++) {
        if (!/^[TULCQ]\d+$/i.test(parts[i])) {
          teacherNameParts.push(parts[i]);
        }
      }
    }
    // Last resort - use the last part that seems name-like
    else if (parts.length > 0) {
      for (let i = parts.length - 1; i >= 0; i--) {
        if (!/^[TULCPQ]\d+$/i.test(parts[i]) && /[A-Za-z]/i.test(parts[i])) {
          teacherNameParts.push(parts[i]);
          break;
        }
      }
    }
    
    // Join teacher name parts and clean up
    if (teacherNameParts.length > 0) {
      parsed.teacherName = teacherNameParts.join(' ')
        .replace(/\s+/g, ' ')  // Normalize spaces
        .trim();
    }

    // 4. Smarter fallback handling for academic year if still unknown
    if (parsed.academicYear === 'Unknown' && parts.length > 0) {
      // If first part has a format that could be a year/level, use it
      if (/^[JMS][1-6]$/i.test(parts[0])) {
        parsed.academicYear = parts[0].toUpperCase();
      }
      // Extract from potential patterns like "M1-T2" at the beginning
      else {
        const yearMatch = parts[0].match(/^([JMS][1-6])/i);
        if (yearMatch) {
          parsed.academicYear = yearMatch[1].toUpperCase();
        }
      }
    }

    console.log(`📝 Final parsed result for "${filename}":`, {
      academicYear: parsed.academicYear,
      mathType: parsed.mathType,
      branch: parsed.branch,
      teacherCode: parsed.teacherCode,
      teacherName: parsed.teacherName
    });

    return parsed;

  } catch (error) {
    console.error(`Error parsing filename "${filename}":`, error);
    // Return a default structure on error
    return {
      type: 'FULL',
      academicYear: 'Error',
      arabicText: undefined,
      mathType: undefined
    };
  }
}

export function findMatchingLibrary(parsed: ParsedFilename, libraries: LibraryInfo[]): LibraryMatch {
  const matches: Array<{ library: LibraryInfo; score: number; breakdown: any }> = [];

  console.log(`🔍 Finding library for parsed file:`, {
    academicYear: parsed.academicYear,
    mathType: parsed.mathType,
    branch: parsed.branch,
    teacherCode: parsed.teacherCode,
    teacherName: parsed.teacherName
  });

  for (const library of libraries) {
    let score = 0;
    const maxScore = 200; // زيادة النقاط القصوى أكتر
    const scoreBreakdown: any = {};

    // Normalize library name for comparison
    const normalizedLibName = library.name.toLowerCase().replace(/\s+/g, '');
    const libNameUpper = library.name.toUpperCase();

    // 1. Teacher Code Match (أولوية عالية)
    if (parsed.teacherCode && library.name.includes(parsed.teacherCode)) {
      score += 40;
      scoreBreakdown.teacherCode = 40;
    }

    // 2. Academic Year Match (أولوية عالية)
    if (parsed.academicYear && parsed.academicYear !== 'Unknown' && parsed.academicYear !== 'Error') {
        if (library.name.startsWith(parsed.academicYear) || library.name.includes(`-${parsed.academicYear}-`)) {
             score += 30;
             scoreBreakdown.academicYear = 30;
        }
    }

    // *** 3. PURE/APPLIED Match - الجزء الأهم ***
    if (parsed.mathType) {
      const hasPure = libNameUpper.includes('PURE');
      const hasApplied = libNameUpper.includes('APPLIED');
      
      console.log(`🧮 Library "${library.name}" - hasPure: ${hasPure}, hasApplied: ${hasApplied}, parsed.mathType: ${parsed.mathType}`);
      
      if (parsed.mathType === 'PURE') {
        if (hasPure && !hasApplied) {
          // مكتبة PURE خالصة - أفضل مطابقة
          score += 80;
          scoreBreakdown.mathType = 80;
          console.log(`✅ Perfect PURE match for "${library.name}"`);
        } else if (hasPure && hasApplied) {
          // مكتبة تحتوي على الاتنين - مطابقة متوسطة
          score += 40;
          scoreBreakdown.mathType = 40;
          console.log(`⚠️ Mixed PURE/APPLIED library "${library.name}"`);
        } else if (hasApplied && !hasPure) {
          // مكتبة APPLIED فقط - عقاب قوي
          score -= 50;
          scoreBreakdown.mathType = -50;
          console.log(`❌ APPLIED library "${library.name}" for PURE file`);
        }
      } else if (parsed.mathType === 'APPLIED') {
        if (hasApplied && !hasPure) {
          // مكتبة APPLIED خالصة - أفضل مطابقة
          score += 80;
          scoreBreakdown.mathType = 80;
          console.log(`✅ Perfect APPLIED match for "${library.name}"`);
        } else if (hasPure && hasApplied) {
          // مكتبة تحتوي على الاتنين - مطابقة متوسطة
          score += 40;
          scoreBreakdown.mathType = 40;
          console.log(`⚠️ Mixed PURE/APPLIED library "${library.name}"`);
        } else if (hasPure && !hasApplied) {
          // مكتبة PURE فقط - عقاب قوي
          score -= 50;
          scoreBreakdown.mathType = -50;
          console.log(`❌ PURE library "${library.name}" for APPLIED file`);
        }
      }
    } else {
      // إذا الملف مافيهوش PURE/APPLIED، المكتبات العادية تاخد أولوية
      if (!libNameUpper.includes('PURE') && !libNameUpper.includes('APPLIED')) {
        score += 20; // مكافأة للمكتبات العادية
        scoreBreakdown.mathType = 20;
      } else {
        score += 5; // نقاط قليلة للمكتبات المتخصصة
        scoreBreakdown.mathType = 5;
      }
    }

    // 4. Branch Match
    if (parsed.branch) {
      // تحسين المطابقة للفروع - التعامل مع MATH و Math
      const branchPatterns = [
        `-${parsed.branch}-`,
        `-${parsed.branch.toLowerCase()}-`,
        `${parsed.branch}-`,
        `${parsed.branch.toLowerCase()}-`
      ];
      
      const hasMatchingBranch = branchPatterns.some(pattern => 
        libNameUpper.includes(pattern.toUpperCase()) || library.name.includes(pattern)
      );
      
      if (hasMatchingBranch) {
        score += 25; // زيادة نقاط المطابقة للفرع
        scoreBreakdown.branch = 25;
      }
    }

    // 5. Teacher Name Match
    if (parsed.teacherName) {
      const normalizedTeacherName = parsed.teacherName.toLowerCase().replace(/\s+/g, '');
      if (normalizedLibName.includes(normalizedTeacherName)) {
        score += 15; // زيادة نقاط اسم المدرس
        scoreBreakdown.teacherName = 15;
      }
    }

    // تأكد من عدم تجاوز النقاط الحد الأقصى
    score = Math.min(score, maxScore);
    
    // تأكد من عدم قبول النقاط السالبة الكتيرة
    score = Math.max(score, -30);

    console.log(`📊 Library "${library.name}" scored ${score}:`, scoreBreakdown);

    if (score > -20) { // نقبل حتى النقاط المنخفضة شوية
      matches.push({ library, score, breakdown: scoreBreakdown });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  console.log(`🏆 Top 3 library matches:`, matches.slice(0, 3).map(m => ({
    name: m.library.name,
    score: m.score,
    breakdown: m.breakdown
  })));

  return {
    library: matches[0]?.library || null,
    confidence: matches[0]?.score || 0,
    alternatives: matches.slice(0, 5).map(m => m.library)
  };
}

export function determineCollection(parsed: ParsedFilename, year: string = "2026"): CollectionResult {
  const configs = COLLECTIONS_CONFIG[year] || [];

  // Handle parsing errors explicitly
  if (!parsed || parsed.academicYear === 'Error') {
      return { name: `ParsingError-${year}`, reason: 'Could not parse filename' };
  }

  // Detect if this is a revision (RE) file
  const isRevision = isRevisionFile(parsed);
  
  // Detect if this is a question/quiz (QV) file - enhanced double-check
  const isQuestion = isQuestionFile(parsed) || 
                     (parsed.arabicText && /[Qq]\d+/.test(parsed.arabicText)) || 
                     (parsed.originalFilename && /[Qq]\d+/.test(parsed.originalFilename));
  
  // Extract term information (T1, T2, etc.)
  const term = determineFileTerm(parsed);
  
  // Apply the collection determination logic based on rules
  if (isRevision) {
    if (isQuestion) {
      const collectionName = `RE-${term}-${year}-QV`;
      return { 
        name: collectionName, 
        reason: `Revision with questions (contains RE and ends with Q pattern)` 
      };
    } else {
      const collectionName = `RE-${year}`;
      return { 
        name: collectionName, 
        reason: `Regular revision video (starts with RE, no question pattern)` 
      };
    }
  } else {
    if (isQuestion) {
      const collectionName = `${term}-${year}-QV`;
      return { 
        name: collectionName, 
        reason: `Question video for ${term} (ends with Q pattern)` 
      };
    } else {
      const collectionName = `${term}-${year}`;
      return { 
        name: collectionName, 
        reason: `Regular content video for ${term}` 
      };
    }
  }
}

/**
 * Determines if the file is a revision (RE) file
 */
function isRevisionFile(parsed: ParsedFilename): boolean {
  if (!parsed) return false;
  
  // Check if file type is explicitly marked as RE
  if (parsed.type === 'RE') return true;
  
  // Check filename for RE patterns
  const filename = parsed.originalFilename || '';
  
  // Check if filename starts with RE
  if (/^RE-|^RE_|^RE\s+/i.test(filename)) return true;
  
  // Check for revision keywords
  if (/\brevision\b|\brevise\b|\bمراجعة\b/i.test(filename)) return true;
  
  // If Arabic text contains revision-related words
  if (parsed.arabicText && /مراجعة|تدريب|مذاكرة/.test(parsed.arabicText)) return true;
  
  return false;
}

/**
 * Determines if the file is a question/quiz (QV) file
 */
export function isQuestionFile(parsed: ParsedFilename): boolean {
  if (!parsed) return false;
  
  // Check if file type is explicitly marked as QV
  if (parsed.type === 'QV') return true;
  
  // Get the filename for pattern matching
  const filename = parsed.originalFilename || '';
  
  // PRIORITY 1: Check for Q+number pattern anywhere in filename (most reliable indicator)
  if (/[Qq]\d+/.test(filename)) return true;
  
  // PRIORITY 2: Check for Q+number in Arabic text (within curly braces)
  if (parsed.arabicText && /[Qq]\d+/.test(parsed.arabicText)) return true;
  
  // PRIORITY 3: Arabic question indicators - but only if they appear with question numbers
  if (parsed.arabicText) {
    // Check for specific question patterns: "سؤال" or "أسئلة" with numbers
    if (/سؤال\s*\d+|أسئلة\s*\d+/.test(parsed.arabicText)) return true;
    
    // Check for exam/test indicators that usually have numbers
    if (/اختبار\s*\d+|امتحان\s*\d+/.test(parsed.arabicText)) return true;
    
    // For "واجب", only consider it a question if it has Q+number or specific question patterns
    if (/واجب/.test(parsed.arabicText)) {
      // Check if the same text also contains Q+number
      if (/[Qq]\d+/.test(parsed.arabicText)) return true;
      // Check if it has question-specific patterns like "سؤال"
      if (/سؤال|أسئلة/.test(parsed.arabicText)) return true;
      // Otherwise, "واجب" alone is not considered a question (could be lesson title)
    }
  }
  
  // PRIORITY 4: Check for quiz or test in the filename only if they appear to be main components
  if (/\bquiz\b|\btest\b|\bexam\b/i.test(filename) && 
      (!/\b[a-z]+\s+quiz\b/i.test(filename))) { // Avoid phrases like "math quiz for practice"
    return true;
  }
  
  // PRIORITY 5: Look for homework indicators with question numbers
  if (/\bhw\s*\d+\b|\bhomework\s*\d+\b/i.test(filename)) return true;
  
  return false;
}

/**
 * Determines the term (T1, T2) for the file
 */
function determineFileTerm(parsed: ParsedFilename): string {
  if (!parsed) return 'T1'; // Default to T1
  
  // If term is explicitly parsed
  if (parsed.term) return parsed.term;
  
  // Get the filename for pattern matching
  const filename = parsed.originalFilename || '';
  
  // Look for T1/T2 pattern in filename
  const termMatch = filename.match(/\b(T[12])\b/i);
  if (termMatch) return termMatch[1].toUpperCase();
  
  // Look for Term 1/Term 2 pattern
  if (/\bterm\s*1\b|\bالفصل\s*الأول\b|\bالترم\s*الأول\b/i.test(filename)) return 'T1';
  if (/\bterm\s*2\b|\bالفصل\s*الثاني\b|\bالترم\s*الثاني\b/i.test(filename)) return 'T2';
  
  // If Arabic text contains term indicators
  if (parsed.arabicText) {
    if (/الفصل الأول|الترم الأول/.test(parsed.arabicText)) return 'T1';
    if (/الفصل الثاني|الترم الثاني/.test(parsed.arabicText)) return 'T2';
  }
  
  // Default to T1 if no term is found
  return 'T1';
}

export function determineLibrary(parsed: ParsedFilename): string {
  const parts = [
    parsed.academicYear, // Should be more reliable now
    parsed.mathType, // *** إضافة PURE/APPLIED ***
    parsed.branch || 'UnknownBranch',
    parsed.teacherCode || 'UnknownCode',
    parsed.teacherName || 'UnknownTeacher'
  ].filter(part => part && part !== 'Unknown' && part !== 'Error'); // Filter out defaults/errors

  if (parts.length < 2) { // Require at least year and one other identifier
      return "Unknown-Library-Needs-Manual-Check";
  }

  return parts.join('-');
}
