import { google } from 'googleapis';
import type { NextApiRequest, NextApiResponse } from 'next';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

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

// Helper function to normalize strings for matching
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

// Function to extract Q numbers
const extractQNumbers = (str: string): string[] => {
  const qMatches = str.match(/q\s*\d+/gi);
  return qMatches 
    ? qMatches.map(q => q.toLowerCase().replace(/\s+/g, '').trim()).sort() 
    : [];
};

// Function to check if names match
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

  // Extract core name and Q numbers separately
  const coreA = normA.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const coreB = normB.replace(/q\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
  const qNumbersA = extractQNumbers(normA);
  const qNumbersB = extractQNumbers(normB);

  // Handle specific format matching
  const codePatternA = normA.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  const codePatternB = normB.match(/(m\d+|s\d+|j\d+)-t\d+-u\d+-l\d+-(sci|ar|en|math)-\w+-(p\d+)/i);
  
  if (codePatternA && codePatternB) {
    const codeA = codePatternA[0].toLowerCase();
    const codeB = codePatternB[0].toLowerCase();
    
    if (codeA === codeB) {
      const remainingA = normA.replace(codeA, '').trim();
      const remainingB = normB.replace(codeB, '').trim();
      
      const teacherMatch = remainingA.includes('muslim') && remainingB.includes('muslim') ||
                          remainingA.includes('elsayed') && remainingB.includes('elsayed');
      
      const similarRemaining = remainingA.includes(remainingB) || remainingB.includes(remainingA);
      
      if (teacherMatch || similarRemaining || remainingA.length < 10 || remainingB.length < 10) {
        console.log('[namesMatch] ✅ Exact code pattern match with compatible remaining text.');
        return true;
      }
    }
  }

  // Match if the core parts are identical
  if (coreA === coreB && coreA.length > 10) {
    console.log('[namesMatch] ✅ Core name exact match (ignoring Q numbers).');
    return true;
  }

  // Check course code matching
  const courseCodePattern = /(m\d+|s\d+|j\d+)-(t\d+)?-(u\d+)?-(l\d+)?-(sci|ar|en|math)-\w+-(p\d+)/i;
  
  const courseCodeA = normA.match(courseCodePattern);
  const courseCodeB = normB.match(courseCodePattern);
  
  if (courseCodeA && courseCodeB) {
    const matchedPartsA = courseCodeA[0].toLowerCase();
    const matchedPartsB = courseCodeB[0].toLowerCase();
    
    if (matchedPartsA === matchedPartsB) {
      console.log('[namesMatch] ✅ Exact course code match.');
      return true;
    }
  }

  console.log('[namesMatch] ❌ No reliable match found.');
  return false;
};

// Function to find matching row
const findMatchingRow = (videoName: string, rows: any[][], nameColumnIndex: number = 0): number => {
  console.log(`[findMatchingRow] Finding match for: "${videoName}"`);
  
  // Preprocess videoName
  const processedVideoName = videoName.replace(/\.mp4$/i, '');

  // Try exact match first 
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    const { videos, spreadsheetId, sheetName, columns } = req.body;

    console.log(`[Handler] Received request with ${videos ? videos.length : 0} videos`);
    console.log('[Handler] Custom sheet config:', { spreadsheetId, sheetName, columns });

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No videos provided',
        results: [],
        stats: { updated: 0, notFound: 0, skipped: 0, error: 0 }
      });
    }

    // Use provided spreadsheetId or fallback to env var
    const SPREADSHEET_ID = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const SHEET_NAME = sheetName || process.env.GOOGLE_SHEET_NAME || 'OPERATIONS';
    
    // Get column indices (default to M,V if not specified)
    const nameColumn = (columns && columns.name) || 'N';
    const embedColumn = (columns && columns.embed) || 'W';
    const minutesColumn = (columns && columns.minutes) || 'Q';
    
    // Validate environment variables
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON) {
      throw new Error('Google Sheets credentials not configured');
    }

    if (!SPREADSHEET_ID) {
      throw new Error('Spreadsheet ID not configured');
    }

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Calculate the range to fetch based on columns
    const startColumn = nameColumn;
    const endColumn = String.fromCharCode(Math.max(
      nameColumn.charCodeAt(0), 
      embedColumn.charCodeAt(0), 
      minutesColumn.charCodeAt(0)
    ) + 1); // Get next column after the rightmost one
    
    const range = `${SHEET_NAME}!${startColumn}:${endColumn}`;
    console.log(`[Handler] Fetching sheet data from range: ${range}`);

    // Get existing data
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = sheetResponse.data.values || [];
    console.log(`[Handler] Fetched ${rows.length} rows.`);

    // Calculate column indices relative to the fetched range
    const nameColIndex = nameColumn.charCodeAt(0) - startColumn.charCodeAt(0);
    const embedColIndex = embedColumn.charCodeAt(0) - startColumn.charCodeAt(0);
    
    const existingEmbeds = new Map<number, string>();

    // Populate existing embeds map
    rows.forEach((row, index) => {
      if (row && row.length > embedColIndex && row[embedColIndex]) {
        existingEmbeds.set(index + 1, row[embedColIndex].toString());
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

    // Process each video
    for (const video of videos) {
      console.log(`[Handler] Processing video: "${video.name}"`);

      const processedVideoName = video.name.replace(/\.mp4$/i, '');
      console.log(`[Handler] Processed for matching: "${processedVideoName}"`);

      // Find matching row using name column index
      const rowIndex = findMatchingRow(processedVideoName, rows, nameColIndex);
      const rowNumber = rowIndex + 1; // 1-based row number
      const existingEmbed = rowIndex !== -1 ? existingEmbeds.get(rowNumber) : undefined;

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
            range: `${SHEET_NAME}!${embedColumn}${rowNumber}`,
            values: [[video.embed_code]]
          });
          console.log(`✅ [WILL UPDATE] "${video.name}" - Row ${rowNumber}, Column ${embedColumn}`);
        }
      }

      const result: UpdateResult = {
        videoName: video.name,
        status: currentStatus,
        details: details
      };

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
        console.log('[Handler] ✅ BATCH UPDATE SUCCESSFUL');
      } catch (updateError) {
        console.error('[Handler] ❌ BATCH UPDATE FAILED:', updateError);
        
        // Mark all updated videos as errors
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
      console.log('[Handler] ⚠️ NO UPDATES TO PERFORM');
    }

    // Ensure we don't claim success if no updates occurred
    const actuallyUpdated = stats.updated;
    const hasErrors = stats.error > 0;
    const overallSuccess = actuallyUpdated > 0 && !hasErrors;

    const apiResponse: UpdateResponse = {
      success: overallSuccess,
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
