/**
 * Google Sheets Update API - JavaScript version
 * Updates video embed codes in Google Sheets
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

// Extract Q numbers from string with improved accuracy
const extractQNumbers = (str) => {
  const qMatches = str.match(/Q\d+/gi) || [];
  return qMatches.map(q => q.toUpperCase()).sort();
};

// Check if two names match with stricter Q number validation
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

  // Extract and compare Q numbers - CRITICAL FOR QUESTION VARIANTS
  const qNumbersA = extractQNumbers(nameA);
  const qNumbersB = extractQNumbers(nameB);

  console.log('[Match] Q numbers A:', qNumbersA);
  console.log('[Match] Q numbers B:', qNumbersB);

  // If either has Q numbers, they must match EXACTLY
  if (qNumbersA.length > 0 || qNumbersB.length > 0) {
    // If one has Q numbers and the other doesn't, they're different videos
    if (qNumbersA.length !== qNumbersB.length) {
      console.log('[Match] ❌ Different Q number count - one has Q numbers, other doesn\'t');
      return false;
    }
    
    // Check if all Q numbers match
    const allQNumbersMatch = qNumbersA.every(q => qNumbersB.includes(q));
    if (!allQNumbersMatch) {
      console.log('[Match] ❌ Different Q numbers - not a match');
      return false;
    }
    
    // If Q numbers match, check if base names are similar
    const baseA = normalizedA.replace(/Q\d+/gi, '').trim();
    const baseB = normalizedB.replace(/Q\d+/gi, '').trim();
    
    console.log('[Match] Base A (no Q):', baseA);
    console.log('[Match] Base B (no Q):', baseB);
    
    if (baseA && baseB && (baseA.includes(baseB) || baseB.includes(baseA))) {
      console.log('[Match] ✅ Q number + base name match');
      return true;
    }
  }

  // Partial match check for non-Q-number videos
  if (qNumbersA.length === 0 && qNumbersB.length === 0 && 
      normalizedA.length > 10 && normalizedB.length > 10) {
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
      console.log('[Match] ✅ Partial match (one contains the other)');
      return true;
    }
  }

  console.log('[Match] ❌ No match found');
  return false;
};

// Find matching row in sheet with improved logic
const findMatchingRow = (videoName, rows, nameColumnIndex = 0) => {
  console.log(`[FindRow] Looking for: "${videoName}"`);
  console.log(`[FindRow] Total rows: ${rows.length}`);
  console.log(`[FindRow] Name column index: ${nameColumnIndex}`);

  // First try exact match (fastest)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameColumnIndex]) continue;
    
    const cellValue = row[nameColumnIndex] || '';
    
    if (videoName === cellValue) {
      console.log(`[FindRow] ✅ Found EXACT match at row ${i + 1}`);
      return i + 1; // Sheet rows are 1-indexed
    }
  }
  
  // Then try fuzzy match with Q-number awareness
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameColumnIndex]) continue;
    
    const cellValue = row[nameColumnIndex] || '';
    
    if (namesMatch(videoName, cellValue)) {
      console.log(`[FindRow] ✅ Found match at row ${i + 1}`);
      return i + 1; // Sheet rows are 1-indexed
    }
  }
  
  console.log(`[FindRow] ❌ No match found for: "${videoName}"`);
  return null;
};

// Convert column letter to index (A=0, B=1, etc.)
const getColumnIndex = (letter) => {
  if (!letter) return 0;
  return letter.toUpperCase().charCodeAt(0) - 65;
};

// Convert column index to letter (0=A, 1=B, etc.)
const getColumnLetter = (index) => {
  return String.fromCharCode(65 + index);
};

export default async function handler(req, res) {
  console.log('[API] /api/sheets/update-bunny-embeds called');
  console.log('[API] Method:', req.method);
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[API] Method not allowed:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported' 
    });
  }

  try {
    const { 
      videos, 
      spreadsheetId, 
      sheetName, 
      nameColumn = 'M', 
      embedColumn = 'V', 
      finalMinutesColumn = 'P' 
    } = req.body;
    
    console.log('[API] Request body received:');
    console.log('[API] Videos count:', videos?.length || 0);
    console.log('[API] Spreadsheet ID:', spreadsheetId);
    console.log('[API] Sheet name:', sheetName);
    console.log('[API] Columns:', { nameColumn, embedColumn, finalMinutesColumn });

    // Validate request
    if (!videos || !Array.isArray(videos) || videos.length === 0) {
      console.log('[API] Invalid videos data');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Videos array is required and must not be empty'
      });
    }

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

    // Get column indices
    const nameColumnIndex = getColumnIndex(nameColumn);
    const embedColumnIndex = getColumnIndex(embedColumn);
    const finalMinutesColumnIndex = getColumnIndex(finalMinutesColumn);

    console.log('[API] Column indices:', {
      name: nameColumnIndex,
      embed: embedColumnIndex,
      finalMinutes: finalMinutesColumnIndex
    });

    // Prepare updates
    const updates = [];
    const results = [];

    for (const video of videos) {
      console.log(`[API] Processing video: ${video.name}`);
      
      const matchingRow = findMatchingRow(video.name, rows, nameColumnIndex);
      
      if (matchingRow) {
        console.log(`[API] Found matching row: ${matchingRow}`);
        
        // Check if cell already has content before updating
        const existingEmbed = rows[matchingRow-1] && rows[matchingRow-1][embedColumnIndex];
        
        if (existingEmbed && existingEmbed.trim().length > 0) {
          console.log(`[API] Row ${matchingRow} already has embed content - SKIPPING`);
          results.push({
            videoName: video.name,
            status: 'skipped',
            row: matchingRow,
            reason: 'Cell already has embed code'
          });
          continue; // Skip this video
        }
        
        // Only proceed if cell is empty
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
          embedUpdated: !!video.embedCode,
          finalMinutesUpdated: video.finalMinutes !== undefined && video.finalMinutes !== null
        });
      } else {
        console.log(`[API] No matching row found for: ${video.name}`);
        results.push({
          videoName: video.name,
          status: 'not_found',
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

    // Calculate statistics
    const stats = {
      totalVideos: videos.length,
      updatedVideos: results.filter(r => r.status === 'updated').length,
      notFoundVideos: results.filter(r => r.status === 'not_found').length,
      totalUpdates: updates.length
    };

    console.log('[API] Update completed successfully');
    console.log('[API] Stats:', stats);

    return res.status(200).json({
      success: true,
      message: 'Sheet updated successfully',
      stats,
      results
    });

  } catch (error) {
    console.error('[API] Error:', error);
    
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
