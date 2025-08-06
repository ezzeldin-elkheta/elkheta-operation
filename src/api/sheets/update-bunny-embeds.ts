import { google } from 'googleapis';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cors from 'cors';
import { Request, Response } from 'express';
import { googleSheetsService } from "@/lib/google-sheets-service";
import { bunnyService } from "@/lib/bunny-service";

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';

interface VideoData {
  name: string;
  embed_code: string;
  final_minutes?: number;
}

interface UpdateResult {
  videoName: string;
  status: 'updated' | 'notFound' | 'skipped' | 'error';
  details?: string;
}

interface UpdateResponse {
  success: boolean;
  message: string;
  results: Array<{
    videoName: string;
    status: 'updated' | 'notFound' | 'skipped' | 'error';
    details?: string;
  }>;
  stats: {
    updated: number;
    notFound: number;
    skipped: number;
    error: number;
  };
}

// تحسين دالة التطبيع لتتعامل بشكل أفضل مع النصوص العربية والرموز الخاصة
const normalizeString = (str: string): string => {
  if (!str) return '';

  console.log('[Normalize] Original:', str);

  let normalized = str
    .trim()
    // 1. Remove file extension first
    .replace(/\.[^/.]+$/, '')
    // 2. Extract essential parts - keep both Arabic and English text
    .replace(/(?:--|—|-)?\s*(?:واجب|homework|الحصة الرابعة|الحصة|درس)\s*\d*/gi, '')
    // 3. Remove content within all types of brackets
    .replace(/[\[\{\(].*?[\]\}\)]/g, '')
    // 4. Replace multiple dashes/underscores with a single space
    .replace(/[-_—]+/g, ' ')
    // 5. Normalize Arabic characters for better matching
    .replace(/[أإآ]/g, 'ا')
    .replace(/[يى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    // 6. Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  console.log('[Normalize] Final:', normalized);
  return normalized;
};

// Function to extract Q numbers with improved matching
const extractQNumbers = (str: string): string[] => {
  const qMatches = str.match(/q\s*\d+/gi);
  return qMatches 
    ? qMatches.map(q => q.toLowerCase().replace(/\s+/g, '').trim()).sort() 
    : [];
};

// Updated namesMatch function with stricter validation for Q numbers
const namesMatch = (nameA: string, nameB: string): boolean => {
  nameA = nameA.replace(/\.mp4$/i, '');
  nameB = nameB.replace(/\.mp4$/i, '');
  
  const normA = normalizeString(nameA);
  const normB = normalizeString(nameB);

  console.log(`[namesMatch] Comparing:\nA: "${normA}"\nB: "${normB}"`);

  // Direct match after normalization - MOST RELIABLE
  if (normA === normB) {
    console.log('[namesMatch] ✅ Direct exact match success.');
    return true;
  }

  // STRICTER: Extract core name (without Q numbers) and Q numbers separately
  const coreA = normA.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const coreB = normB.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const qNumbersA = extractQNumbers(normA);
  const qNumbersB = extractQNumbers(normB);

  console.log(`[namesMatch] CoreA: "${coreA}", QsA: [${qNumbersA.join(',')}]`);
  console.log(`[namesMatch] CoreB: "${coreB}", QsB: [${qNumbersB.join(',')}]`);
  
  // IMPORTANT: If either has Q numbers but not the same ones, they are DIFFERENT videos
  if (qNumbersA.length > 0 || qNumbersB.length > 0) {
    // Different Q number count means different videos
    if (qNumbersA.length !== qNumbersB.length) {
      console.log('[namesMatch] ❌ Q number mismatch: different count.');
      return false;
    }
    
    // Check if all Q numbers match exactly
    const allQsMatch = qNumbersA.length === qNumbersB.length && 
                       qNumbersA.every(q => qNumbersB.includes(q));
    
    if (!allQsMatch) {
      console.log('[namesMatch] ❌ Q number mismatch: different Q numbers.');
      return false;
    }
  }

  // ENHANCED: Handle specific format M2-T2-U2-L2-SCI-AR-P0078... format with STRICT matching
  const codePatternA = normA.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  const codePatternB = normB.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  
  if (codePatternA && codePatternB) {
    const codeA = codePatternA[0].toLowerCase();
    const codeB = codePatternB[0].toLowerCase();
    
    if (codeA === codeB) {
      // Additional validation: ensure the rest of the name is similar too
      const remainingA = normA.replace(codeA, '').trim();
      const remainingB = normB.replace(codeB, '').trim();
      
      // Check if teacher name matches or if one remaining text contains the other
      const teacherMatch = remainingA.includes('muslim') && remainingB.includes('muslim') ||
                          remainingA.includes('elsayed') && remainingB.includes('elsayed');
      
      const similarRemaining = remainingA.includes(remainingB) || remainingB.includes(remainingA);
      
      if (teacherMatch || similarRemaining || remainingA.length < 10 || remainingB.length < 10) {
        console.log('[namesMatch] ✅ Exact code pattern match with compatible remaining text.');
        return true;
      } else {
        console.log('[namesMatch] ⚠️ Code pattern matches but remaining text differs significantly.');
        console.log(`RemainingA: "${remainingA}", RemainingB: "${remainingB}"`);
      }
    }
  }

  // STRICTER: Match if the core parts are identical AND reasonably long
  if (coreA === coreB && coreA.length > 10) {
    console.log('[namesMatch] ✅ Core name exact match (ignoring Q numbers).');
    return true;
  }

  // FINAL FALLBACK: Teacher code and course code matching with additional validation
  const courseCodePattern = /(m\d+|s\d+|j\d+)-(t\d+)?-(u\d+)?-(l\d+)?-(sci|ar|en|math)-\w+-(p\d+)/i;
  
  const courseCodeA = normA.match(courseCodePattern);
  const courseCodeB = normB.match(courseCodePattern);
  
  if (courseCodeA && courseCodeB) {
    const matchedPartsA = courseCodeA[0].toLowerCase();
    const matchedPartsB = courseCodeB[0].toLowerCase();
    
    // Only match if course codes are exactly the same
    if (matchedPartsA === matchedPartsB) {
      console.log('[namesMatch] ✅ Exact course code match.');
      return true;
    }
  }

  console.log('[namesMatch] ❌ No reliable match found - avoiding false positive.');
  return false;
};

// Function to find matching row with improved debugging
const findMatchingRow = (videoName: string, rows: any[][], nameColumnIndex: number = 0): number => {
  console.log(`[findMatchingRow] Finding match for: "${videoName}"`);

  // Debug first 5 rows
  console.log('First 5 rows in sheet:', rows.slice(0, 5).map(row => ({
    original: row && row[nameColumnIndex] ? row[nameColumnIndex] : 'N/A',
    normalized: row && row[nameColumnIndex] ? normalizeString(row[nameColumnIndex].toString()) : null
  })));
  
  // Preprocess videoName to handle different formats
  const processedVideoName = videoName.replace(/\.mp4$/i, '');

  // Try exact match first (faster) 
  let exactMatchIndex = rows.findIndex((row) => {
    if (!row || !row[nameColumnIndex]) return false;
    return row[nameColumnIndex].toString().trim() === processedVideoName;
  });
  
  if (exactMatchIndex !== -1) {
    console.log(`[findMatchingRow] ✅ Exact string match at row ${exactMatchIndex + 1}`);
    return exactMatchIndex;
  }
  
  // Try normalized match
  const rowIndex = rows.findIndex((row) => {
    if (!row) return false;
    const cellValue = row.length > nameColumnIndex ? row[nameColumnIndex] : row[0];
    if (!cellValue) return false;
    return namesMatch(videoName, cellValue.toString());
  });

  console.log('[findMatchingRow] Match result:', rowIndex !== -1 ?
    `Found at row ${rowIndex + 1}` :
    'No match found');

  return rowIndex;
};

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      message: 'Method not allowed',
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
    });
  }

  try {
    const { videos } = req.body;

    console.log(`[Handler] Received request with ${videos ? videos.length : 0} videos`);

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      throw new Error('Google Sheets credentials not configured');
    }

    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get existing data
    console.log(`[Handler] Fetching sheet data from range: ${SHEET_NAME}!M:V`);
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!M:V`,
    });

    const rows = sheetResponse.data.values || [];
    console.log(`[Handler] Fetched ${rows.length} rows.`);

    const existingEmbeds = new Map<number, string>();

    // Populate existing embeds map
    rows.forEach((row, index) => {
      if (row && row[8]) { // Column V (embed column, 0-indexed as 8)
        existingEmbeds.set(index + 1, row[8].toString());
      }
    });

    const results: UpdateResult[] = [];
    const updates: Array<{ range: string; values: string[][] }> = [];
    const stats = {
      updated: 0,
      notFound: 0,
      skipped: 0,
      error: 0
    };

    // Process each video with improved existing content check
    for (const video of videos) {
      console.log(`[Handler] Processing video: "${video.name}"`);

      const processedVideoName = video.name.replace(/\.mp4$/i, '');
      console.log(`[Handler] Processed for matching: "${processedVideoName}"`);

      // Find matching row
      const rowIndex = findMatchingRow(processedVideoName, rows, 0); // Column M is index 0
      const rowNumber = rowIndex + 1; // 1-based row number
      
      // Improved check for existing embed content
      let existingEmbed = undefined;
      if (rowIndex !== -1) {
        const row = rows[rowIndex];
        if (row && row.length > 8) { // Column V is index 8 (assuming M:V range)
          existingEmbed = row[8]?.toString();
          console.log(`[Handler] Found existing content in embed column:`, 
            existingEmbed ? `${existingEmbed.substring(0, 50)}...` : 'empty');
        }
      }

      console.log('[Handler] Processing status:', {
        videoName: video.name,
        foundMatch: rowIndex !== -1,
        row: rowNumber,
        hasExistingEmbed: !!existingEmbed && existingEmbed.trim().length > 0,
      });

      let currentStatus: UpdateResult['status'] = 'error';
      let details = '';

      if (rowIndex === -1) {
        currentStatus = 'notFound';
        details = 'Video name not found in sheet';
        stats.notFound++;
        console.log(`❌ [NOT FOUND] "${video.name}" - No matching row found in sheet`);
      } else if (existingEmbed && existingEmbed.trim().length > 0) {
        currentStatus = 'skipped';
        details = 'Cell already contains embed code';
        stats.skipped++;
        console.log(`⏭️ [SKIPPED] "${video.name}" - Row ${rowNumber} already has embed code`);
      } else {
        // Only update if found and embed cell is empty
        currentStatus = 'updated';
        details = 'Successfully updated embed code';
        stats.updated++;
        
        if (video.embed_code) {
          updates.push({
            range: `${SHEET_NAME}!V${rowNumber}`,
            values: [[video.embed_code]]
          });
          console.log(`✅ [WILL UPDATE] "${video.name}" - Row ${rowNumber}, Column V`);
        }
      }

      const result: UpdateResult = {
        videoName: video.name,
        status: currentStatus,
        details: details
      };

      console.log('[Handler] Result for video:', result);
      results.push(result);
    }

    // Perform batch update if there are updates
    if (updates.length > 0) {
      console.log(`[Handler] ⚡ PERFORMING BATCH UPDATE for ${updates.length} cell updates`);
      
      try {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            data: updates,
            valueInputOption: 'USER_ENTERED'
          }
        });
        console.log('[Handler] ✅ BATCH UPDATE SUCCESSFUL - All updates applied to sheet');
      } catch (updateError) {
        console.error('[Handler] ❌ BATCH UPDATE FAILED:', updateError);
        
        // Mark all updated videos as errors since the batch update failed
        results.forEach(result => {
          if (result.status === 'updated') {
            result.status = 'error';
            result.details = 'Failed to update sheet - batch update error';
            stats.updated--;
            stats.error++;
          }
        });
        
        throw updateError;
      }
    } else {
      console.log('[Handler] ⚠️ NO UPDATES TO PERFORM - All videos were either not found or skipped');
    }

    // VALIDATION: Ensure we don't claim success if no actual updates occurred
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    console.log(`[Handler] FINAL STATS: Updated=${stats.updated}, NotFound=${stats.notFound}, Skipped=${stats.skipped}, Error=${stats.error}`);
    console.log(`[Handler] OVERALL SUCCESS: ${overallSuccess} (Updated: ${actuallyUpdated}, HasErrors: ${hasErrors})`);

    const apiResponse: UpdateResponse = {
      success: overallSuccess, // Only true if we actually updated something without errors
      message: actuallyUpdated > 0 
        ? `تم تحديث ${stats.updated} فيديو بنجاح, ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`
        : `لم يتم تحديث أي فيديو: ${stats.notFound} غير موجود, ${stats.skipped} تم تخطيه`,
      results: results.map(r => ({
        videoName: r.videoName,
        status: r.status,
        details: r.details || undefined
      })),
      stats
    };

    return res.status(200).json(apiResponse);

  } catch (error) {
    console.error('[Handler] Error in sheet update:', error);
    let message = 'Internal server error during sheet update';
    if (error instanceof Error) {
      message = error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: message,
      results: [],
      stats: { updated: 0, notFound: 0, skipped: 0, error: 1 }
    });
  }
}
