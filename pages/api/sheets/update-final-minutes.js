/*
 * Update Final Minutes API
 * POST /api/sheets/update-final-minutes
 * Body: { videos: [{ name, final_minutes }], spreadsheetId?, sheetName?, nameColumn?, finalMinutesColumn? }
 */

import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Utility: convert column letter to zero-based index (A -> 0, B -> 1, ...)
const getColumnIndex = (letter) => {
  return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
};

// Utility: basic name normalisation (remove extension, extra spaces, brackets)
const normalizeString = (str) => {
  if (!str) return '';
  return str
    .trim()
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/\s+/g, ' ') // collapse spaces
    .replace(/[\[\](){}]/g, ' ') // remove brackets
    .replace(/[-_]+/g, '-') // normalise dashes/underscores
    .replace(/\s+/g, ' ') // collapse again
    .trim();
};

// Simple matcher – reuse logic from update-bunny-embeds (exact or normalized match)
const namesMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeString(a) === normalizeString(b);
};

const findMatchingRow = (videoName, rows, nameColumnIndex) => {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[nameColumnIndex]) continue;
    if (namesMatch(String(row[nameColumnIndex]).trim(), videoName)) {
      return i + 1; // Convert to 1-based index for sheets
    }
  }
  return null;
};

export default async function handler(req, res) {
  console.log('[API] /api/sheets/update-final-minutes called');
  console.log('[API] Method:', req.method);

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
      finalMinutesColumn = 'P'
    } = req.body;

    console.log('[API] Request body received:');
    console.log('[API] Videos count:', videos?.length || 0);
    console.log('[API] Spreadsheet ID:', spreadsheetId);
    console.log('[API] Sheet name:', sheetName);
    console.log('[API] Columns:', { nameColumn, finalMinutesColumn });

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

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: SCOPES
    });

    console.log('[API] Auth initialized, creating sheets client...');

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[API] Reading existing sheet data...');

    // Fetch entire sheet (up to Z) – cheap and simplifies matching
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${targetSheetName}!A:Z`
    });
    const rows = sheetResponse.data.values || [];

    console.log(`[API] Read ${rows.length} rows from sheet`);

    const nameIdx = getColumnIndex(nameColumn);
    const minutesIdx = getColumnIndex(finalMinutesColumn);

    console.log('[API] Column indices:', { name: nameIdx, minutes: minutesIdx });

    const updates = [];
    const results = [];

    for (const video of videos) {
      console.log(`[API] Processing video: ${video.name}`);
      
      const matchingRow = findMatchingRow(video.name, rows, nameIdx);
      
      if (matchingRow && video.final_minutes !== undefined && video.final_minutes !== null) {
        console.log(`[API] Found matching row: ${matchingRow}, updating final minutes: ${video.final_minutes}`);
        
        updates.push({
          range: `${targetSheetName}!${finalMinutesColumn}${matchingRow}`,
          values: [[video.final_minutes]]
        });

        results.push({
          videoName: video.name,
          status: 'updated',
          row: matchingRow,
          finalMinutes: video.final_minutes
        });
      } else if (matchingRow) {
        console.log(`[API] Found matching row: ${matchingRow}, but no final minutes provided`);
        results.push({
          videoName: video.name,
          status: 'no_minutes',
          row: matchingRow
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
      noMinutesVideos: results.filter(r => r.status === 'no_minutes').length,
      totalUpdates: updates.length
    };

    console.log('[API] Final minutes update completed successfully');
    console.log('[API] Stats:', stats);

    return res.status(200).json({
      success: true,
      message: 'Final minutes updated successfully',
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
      message: 'Failed to update final minutes',
      details: error.message
    });
  }
} 