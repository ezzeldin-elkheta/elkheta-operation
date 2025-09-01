/**
 * A collection of string similarity methods to help with fuzzy matching
 */

/**
 * Calculate Levenshtein edit distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create matrix
  const matrix: number[][] = [];
  
  // Initialize first row
  for (let i = 0; i <= len2; i++) {
    matrix[0] = matrix[0] || [];
    matrix[0][i] = i;
  }
  
  // Initialize first column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = matrix[i] || [];
    matrix[i][0] = i;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i-1] === str2[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,      // deletion
        matrix[i][j-1] + 1,      // insertion
        matrix[i-1][j-1] + cost  // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a value between 0 (no similarity) and 1 (exact match)
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  // If either string is empty, similarity is 0
  if (s1.length === 0 || s2.length === 0) {
    return 0;
  }
  
  // If strings are identical, similarity is 1
  if (s1 === s2) {
    return 1;
  }
  
  // Calculate match window size
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  
  // Find matching characters within the window
  const matches1: boolean[] = Array(s1.length).fill(false);
  const matches2: boolean[] = Array(s2.length).fill(false);
  let matchCount = 0;
  
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matchCount++;
        break;
      }
    }
  }
  
  // If no characters match, similarity is 0
  if (matchCount === 0) {
    return 0;
  }
  
  // Count transpositions
  let transpositions = 0;
  let k = 0;
  
  for (let i = 0; i < s1.length; i++) {
    if (matches1[i]) {
      while (!matches2[k]) {
        k++;
      }
      
      if (s1[i] !== s2[k]) {
        transpositions++;
      }
      
      k++;
    }
  }
  
  // Calculate Jaro similarity
  const m = matchCount;
  const t = transpositions / 2;
  const jaroSimilarity = (m / s1.length + m / s2.length + (m - t) / m) / 3;
  
  // Calculate Jaro-Winkler similarity
  const prefixLength = Math.min(4, commonPrefixLength(s1, s2));
  const p = 0.1; // scaling factor
  
  return jaroSimilarity + prefixLength * p * (1 - jaroSimilarity);
}

/**
 * Calculate length of common prefix between two strings
 */
function commonPrefixLength(s1: string, s2: string): number {
  const minLength = Math.min(s1.length, s2.length);
  let prefixLength = 0;
  
  for (let i = 0; i < minLength; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }
  
  return prefixLength;
}

/**
 * Calculate similarity score between two strings (0-100)
 * Combines multiple similarity algorithms for better results
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  // Normalize inputs
  const norm1 = str1.toLowerCase().trim();
  const norm2 = str2.toLowerCase().trim();
  
  // Direct match
  if (norm1 === norm2) return 100;
  
  // Empty strings check
  if (norm1.length === 0 || norm2.length === 0) return 0;
  
  // Calculate Jaro-Winkler similarity
  const jaroWinkler = jaroWinklerSimilarity(norm1, norm2);
  
  // Calculate normalized Levenshtein distance
  const maxLength = Math.max(norm1.length, norm2.length);
  const levenshtein = 1 - (levenshteinDistance(norm1, norm2) / maxLength);
  
  // Calculate contains bonus
  const containsBonus = (norm1.includes(norm2) || norm2.includes(norm1)) ? 0.1 : 0;
  
  // Weight and combine scores
  const combinedScore = (jaroWinkler * 0.6) + (levenshtein * 0.4) + containsBonus;
  
  // Convert to percentage
  return Math.round(combinedScore * 100);
}

/**
 * Calculate similarity specifically optimized for teacher/person names
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  // Normalize names
  const norm1 = normalizeTeacherName(name1);
  const norm2 = normalizeTeacherName(name2);
  
  // Direct match after normalization
  if (norm1 === norm2) return 100;
  
  // Calculate standard similarity
  const baseSimilarity = calculateStringSimilarity(norm1, norm2);
  
  // Additional bonus for partial name matching
  let partialMatchBonus = 0;
  
  // Split into name parts
  const parts1 = norm1.split(/[\s\.]+/).filter(Boolean);
  const parts2 = norm2.split(/[\s\.]+/).filter(Boolean);
  
  // Check for exact partial matches
  for (const part1 of parts1) {
    if (part1.length < 3) continue; // Skip very short parts
    
    for (const part2 of parts2) {
      if (part2.length < 3) continue;
      
      if (part1 === part2) {
        partialMatchBonus += 10;
        break;
      }
    }
  }
  
  // Limit bonus to 20 points
  partialMatchBonus = Math.min(partialMatchBonus, 20);
  
  // Calculate final score with bonus, capped at 100
  return Math.min(baseSimilarity + partialMatchBonus, 100);
}

/**
 * Normalize teacher name for better matching
 */
export function normalizeTeacherName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/^(el|al|dr)/, '');
}
