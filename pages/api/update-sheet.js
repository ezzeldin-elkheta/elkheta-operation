/**
 * Sheet Update API endpoint
 * Handles updating Google Sheets with video embed codes
 */

import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Helper function to normalize strings for matching
const normalizeString = (str) => {
  if (!str) return '';

  console.log('[Normalize] Original:', str);

  let normalized = str
    .trim()
    // Remove file extension first
    .replace(/\.[^/.]+$/, '')
    // Remove multiple spaces and normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove common brackets and parentheses content
    .replace(/[\[\](){}]/g, ' ')
    // Remove multiple dashes and normalize
    .replace(/[-_]+/g, '-')
    // Final cleanup
    .replace(/\s+/g, ' ')
    .trim();

  console.log('[Normalize] Result:', normalized);
  return normalized;
};

// NEW: Helper function to detect homework videos with improved Q-number awareness
const isHomeworkVideo = (videoName) => {
  if (!videoName) return false;
  
  // If video has Q-number pattern, it's a question video, not just homework
  if (/Q\d+/i.test(videoName)) {
    console.log('[isHomeworkVideo] Video has Q-number, treating as question video not homework');
    return false;
  }
  
  // Check for Arabic homework pattern but not if it has Q-numbers
  const homeworkPattern = /واجب|الحصة|homework/i;
  const isHomework = homeworkPattern.test(videoName);
  
  if (isHomework) {
    console.log('[isHomeworkVideo] Detected homework pattern in:', videoName);
  }
  
  return isHomework;
};

// Extract Q numbers from string
const extractQNumbers = (str) => {
  const qMatches = str.match(/Q\d+/gi) || [];
  return qMatches.map(q => q.toUpperCase());
};

// Check if two names match
const namesMatch = (nameA, nameB) => {
  console.log('\n[Match] Comparing:');
  console.log('[Match] A:', nameA);
  console.log('[Match] B:', nameB);

  if (!nameA || !nameB) {
    console.log('[Match] One of the names is empty');
    return false;
  }

  // Direct match
  if (nameA === nameB) {
    console.log('[Match] ✅ Direct match');
    return true;
  }

  // Normalize both strings
  const normalizedA = normalizeString(nameA);
  const normalizedB = normalizeString(nameB);

  console.log('[Match] Normalized A:', normalizedA);
  console.log('[Match] Normalized B:', normalizedB);

  // Check normalized match
  if (normalizedA === normalizedB) {
    console.log('[Match] ✅ Normalized match');
    return true;
  }

  // Extract and compare Q numbers
  const qNumbersA = extractQNumbers(nameA);
  const qNumbersB = extractQNumbers(nameB);

  console.log('[Match] Q numbers A:', qNumbersA);
  console.log('[Match] Q numbers B:', qNumbersB);

  // If both have Q numbers, they must match
  if (qNumbersA.length > 0 && qNumbersB.length > 0) {
    const qMatch = qNumbersA.some(qA => qNumbersB.includes(qA));
    console.log('[Match] Q numbers match:', qMatch);
    
    if (qMatch) {
      // Additional check: verify the base names are similar
      const baseA = normalizedA.replace(/Q\d+/gi, '').trim();
      const baseB = normalizedB.replace(/Q\d+/gi, '').trim();
      
      console.log('[Match] Base A (no Q):', baseA);
      console.log('[Match] Base B (no Q):', baseB);
      
      if (baseA && baseB && (baseA.includes(baseB) || baseB.includes(baseA))) {
        console.log('[Match] ✅ Q number + base name match');
        return true;
      }
    }
  }

  // Partial match check
  if (normalizedA.length > 10 && normalizedB.length > 10) {
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
      console.log('[Match] ✅ Partial match (one contains the other)');
      return true;
    }
  }

  console.log('[Match] ❌ No match found');
  return false;
};

// Find matching row in sheet
const findMatchingRow = (videoName, rows, nameColumnIndex = 0) => {
  console.log(`[FindRow] Looking for: "${videoName}"`);
  console.log(`[FindRow] Total rows: ${rows.length}`);
  console.log(`[FindRow] Name column index: ${nameColumnIndex}`);
  
  // First try an exact string match (highest priority)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length <= nameColumnIndex) continue;
    
    const cellValue = row[nameColumnIndex] || '';
    
    // Try exact match first (with and without file extension)
    const videoNameWithoutExt = videoName.replace(/\.[^/.]+$/, '');
    if (cellValue === videoName || cellValue === videoNameWithoutExt) {
      console.log(`[FindRow] ✅ Found EXACT match at row ${i + 1}`);
      return i + 1; // Sheet rows are 1-indexed
    }
  }
  
  // Check if this is a homework video with Q-numbers
  const hasQNumber = /Q\d+/i.test(videoName);
  if (hasQNumber) {
    console.log(`[FindRow] 📝 Video has Q-number pattern: "${videoName}"`);
  }

  // Fall back to fuzzy matching only if no exact match found
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length <= nameColumnIndex) continue;
    
    const cellValue = row[nameColumnIndex] || '';
    
    console.log(`[FindRow] Comparing with row ${i + 1}: "${cellValue}"`);
    
    if (namesMatch(videoName, cellValue)) {
      console.log(`[FindRow] ✅ Found fuzzy match at row ${i + 1}`);
      return i + 1; // Sheet rows are 1-indexed
    }
  }
  
  console.log(`[FindRow] ❌ No match found for: "${videoName}"`);
  return null;
};

// Convert column letter to index (A=0, B=1, etc.)
const getColumnIndex = (letter) => {
  if (!letter) return 0;
  let result = 0;
  const letters = letter.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    result = result * 26 + (letters.charCodeAt(i) - 64); // A is 65 in ASCII, so -64 gives 1-based index
  }
  return result - 1; // Convert to 0-based index
};

export default async function handler(req, res) {
  console.log('[API] /api/update-sheet called');
  console.log('[API] Method:', req.method);
  
  try {
    console.log('[API] Headers:', JSON.stringify({
      ...req.headers,
      // Hide sensitive info
      authorization: req.headers.authorization ? '[REDACTED]' : undefined,
      accesskey: req.headers.accesskey ? '[REDACTED]' : undefined,
    }, null, 2));
  } catch (err) {
    console.log('[API] Headers logging failed:', err.message);
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[API] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported' 
    });
  }

  try {
    const { videos, sheetConfig } = req.body;
    
    console.log('[API] Request body received:');
    console.log('[API] Videos count:', videos?.length || 0);
    console.log('[API] Has sheet config:', !!sheetConfig);
    
    // Log the complete sheet config for debugging
    if (sheetConfig) {
      console.log('[API] Full sheet config:', JSON.stringify(sheetConfig, null, 2));
    }

    // Validate request
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      console.log('[API] Invalid videos data');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Videos array is required and must not be empty'
      });
    }

    // Extract parameters with fallbacks to ensure backward compatibility
    // This is the key part to ensure it works with both old and new config formats
    const { 
      spreadsheetId, 
      sheetName = "OPERATIONS", 
      nameColumn = sheetConfig?.videoNameColumn || 'M', 
      embedColumn = sheetConfig?.embedCodeColumn || 'Q', 
      finalMinutesColumn = sheetConfig?.finalMinutesColumn || 'P' 
    } = sheetConfig || {};
    
    console.log('[API] Extracted parameters:', {
      spreadsheetId,
      sheetName,
      nameColumn,
      embedColumn,
      finalMinutesColumn
    });

    // Check for Google Sheets credentials
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      console.error('[API] No Google Sheets credentials found');
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Google Sheets credentials not configured'
      });
    }

    // Parse credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log('[API] Credentials parsed successfully');
    } catch (parseError) {
      console.error('[API] Failed to parse credentials:', parseError.message);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid Google Sheets credentials format'
      });
    }

    // Use provided spreadsheet ID or fallback to environment variable
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!targetSpreadsheetId) {
      console.error('[API] No spreadsheet ID provided');
      return res.status(400).json({
        error: 'Configuration error',
        message: 'Spreadsheet ID is required'
      });
    }

    // Use provided sheet name or fallback to environment variable
    const targetSheetName = sheetName || process.env.GOOGLE_SHEET_NAME || 'Sheet1';

    console.log('[API] Initializing Google Sheets API...');
    
    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES
    });

    console.log('[API] Auth initialized, creating sheets client...');
    
    // Create sheets client
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[API] Reading existing sheet data...');
    
    // Read existing sheet data
    const readResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${targetSheetName}!A:Z`
    });

    const rows = readResponse.data.values || [];
    console.log(`[API] Read ${rows.length} rows from sheet`);

    // Log first few rows to see the actual data
    console.log('[API] First 5 rows from sheet:');
    rows.slice(0, 5).forEach((row, index) => {
      console.log(`[API] Row ${index + 1}:`, row);
    });

    // Get column indices
    const nameColumnIndex = getColumnIndex(nameColumn);
    const embedColumnIndex = getColumnIndex(embedColumn);
    const finalMinutesColumnIndex = getColumnIndex(finalMinutesColumn);

    console.log('[API] Column indices:', {
      name: nameColumnIndex,
      embed: embedColumnIndex,
      finalMinutes: finalMinutesColumnIndex
    });

    // Log the name column data specifically
    console.log('[API] Name column data (first 10 rows):');
    rows.slice(0, 10).forEach((row, index) => {
      const nameValue = row && row.length > nameColumnIndex ? row[nameColumnIndex] : 'EMPTY';
      console.log(`[API] Row ${index + 1} (${nameColumn}): "${nameValue}"`);
    });

    // Prepare updates
    const updates = [];
    const results = [];

    for (const video of videos) {
      console.log(`[API] Processing video: ${video.name}`);
      
      // Check if this video has Q-numbers
      const hasQNumber = /Q\d+/i.test(video.name);
      
      // NEW: Check if this is a homework video but avoid skipping if it has Q-numbers
      if (isHomeworkVideo(video.name) && !hasQNumber) {
        console.log(`[API] ⚠️ BASIC HOMEWORK VIDEO DETECTED: "${video.name}" - Will be handled carefully`);
      } else if (hasQNumber) {
        console.log(`[API] 📝 QUESTION VIDEO DETECTED: "${video.name}" - Will be processed normally`);
      }
      
      const matchingRow = findMatchingRow(video.name, rows, nameColumnIndex);
      
      if (matchingRow) {
        console.log(`[API] Found matching row: ${matchingRow}`);
        
        // Enhanced check for existing embed code
        const hasExistingEmbed = rows[matchingRow - 1] && 
                              rows[matchingRow - 1].length > embedColumnIndex && 
                              rows[matchingRow - 1][embedColumnIndex] && 
                              rows[matchingRow - 1][embedColumnIndex].toString().trim().length > 0;
        
        // Skip videos with existing embeds or basic homework videos without Q-numbers
        if ((isHomeworkVideo(video.name) && !hasQNumber) || hasExistingEmbed) {
          const reason = (isHomeworkVideo(video.name) && !hasQNumber) ? 'Homework video detected' : 'Video already has embed code';
          console.log(`[API] Skipping update: ${reason}`);
          
          results.push({
            videoName: video.name,
            status: 'skipped',
            row: matchingRow,
            reason: reason
          });
          
          continue; // Skip to next video
        }
        
        // Prepare embed code update
        if (video.embedCode || video.embed_code) {
          const embedCode = video.embedCode || video.embed_code;
          updates.push({
            range: `${targetSheetName}!${embedColumn}${matchingRow}`,
            values: [[embedCode]]
          });
          console.log(`[API] Added embed update for row ${matchingRow}`);
        }

        // Prepare final minutes update (if available)
        if (video.finalMinutes !== undefined && video.finalMinutes !== null) {
          updates.push({
            range: `${targetSheetName}!${finalMinutesColumn}${matchingRow}`,
            values: [[video.finalMinutes]]
          });
          console.log(`[API] Added final minutes update for row ${matchingRow}: ${video.finalMinutes}`);
        }

        results.push({
          videoName: video.name,
          status: 'updated',
          row: matchingRow,
          embedUpdated: !!(video.embedCode || video.embed_code),
          finalMinutesUpdated: video.finalMinutes !== undefined && video.finalMinutes !== null
        });
      } else {
        console.log(`[API] No matching row found for: ${video.name}`);
        results.push({
          videoName: video.name,
          status: 'notFound',
          row: null
        });
      }
    }

    // Apply updates if any
    if (updates.length > 0) {
      console.log(`[API] Applying ${updates.length} updates...`);
      
      const updateResponse = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });

      console.log('[API] Updates applied successfully');
      console.log('[API] Updated ranges:', updateResponse.data.responses?.map(r => r.updatedRange) || []);
    } else {
      console.log('[API] No updates to apply');
    }

    // Calculate statistics for compatible format with SheetUpdateReport component
    const stats = {
      updated: results.filter(r => r.status === 'updated').length,
      notFound: results.filter(r => r.status === 'notFound').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: 0
    };

    // Format results to be compatible with SheetUpdateReport component
    const formattedResults = results.map(r => ({
      videoName: r.videoName,
      status: r.status,
      details: r.status === 'updated' ? 
               `تم التحديث في الصف ${r.row}${r.embedUpdated ? ', تم تحديث كود التضمين' : ''}${r.finalMinutesUpdated ? ', تم تحديث المدة النهائية' : ''}` :
               r.status === 'skipped' ?
               `تم تخطي التحديث في الصف ${r.row}: ${r.reason || 'الفيديو لديه كود تضمين بالفعل'}` :
               'لم يتم العثور على الفيديو في الشيت'
    }));

    console.log('[API] Update completed successfully');
    console.log('[API] Stats:', stats);
    console.log('[API] Returning formatted results for UI');

    return res.status(200).json({
      success: true,
      message: 'تم تحديث الشيت بنجاح',
      stats,
      results: formattedResults
    });

  } catch (error) {
    console.error('[API] Error:', error.message);
    console.error('[API] Stack:', error.stack);
    
    // Handle specific Google API errors
    if (error.code === 403) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Access to Google Sheets denied. Please check permissions.',
        details: error.message
      });
    }
    
    if (error.code === 404) {
      return res.status(404).json({
        error: 'Spreadsheet not found',
        message: 'The specified spreadsheet could not be found.',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update sheet',
      details: error.message
    });
  }
}
