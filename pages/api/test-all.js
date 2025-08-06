import { google } from 'googleapis';

export default async function handler(req, res) {
  console.log('[Test All] Handler called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { test } = req.query;
  console.log('[Test All] Test type:', test);

  try {
    switch (test) {
      case 'simple':
        return await handleSimpleTest(req, res);
      case 'sheets-basic':
        return await handleSheetsBasicTest(req, res);
      case 'sheets-connection':
        return await handleSheetsConnectionTest(req, res);
      case 'debug-env':
        return await handleDebugEnvTest(req, res);
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid test type. Use: simple, sheets-basic, sheets-connection, or debug-env'
        });
    }
  } catch (error) {
    console.error('[Test All] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });
  }
}

async function handleSimpleTest(req, res) {
  console.log('[Test All] Running simple test...');
  
  const basicInfo = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
    hasCredentials: !!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON,
    hasSpreadsheetId: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    hasSheetName: !!process.env.GOOGLE_SHEET_NAME
  };

  console.log('[Test All] Simple test completed:', basicInfo);

  return res.status(200).json({
    success: true,
    message: 'Simple test successful',
    data: basicInfo
  });
}

async function handleSheetsBasicTest(req, res) {
  console.log('[Test All] Running sheets basic test...');
  
  try {
    // Step 1: Check credentials
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      console.log('[Test All] No credentials found');
      return res.status(401).json({
        success: false,
        message: 'No Google Sheets credentials found'
      });
    }

    console.log('[Test All] Credentials found, length:', credentialsJSON.length);

    // Step 2: Parse credentials
    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log('[Test All] Credentials parsed successfully');
    } catch (parseError) {
      console.error('[Test All] Failed to parse credentials:', parseError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials JSON format',
        error: parseError.message
      });
    }

    // Step 3: Check spreadsheet ID
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      console.log('[Test All] No spreadsheet ID found');
      return res.status(401).json({
        success: false,
        message: 'No spreadsheet ID found'
      });
    }

    console.log('[Test All] Spreadsheet ID found:', spreadsheetId);

    // Step 4: Initialize Google Auth
    console.log('[Test All] Initializing Google Auth...');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    console.log('[Test All] Auth initialized');

    // Step 5: Create sheets client
    console.log('[Test All] Creating sheets client...');
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Test All] Sheets client created');

    // Step 6: Test connection with minimal request
    console.log('[Test All] Testing connection...');
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [],
      includeGridData: false
    });

    console.log('[Test All] Connection successful');
    console.log('[Test All] Spreadsheet title:', response.data.properties?.title);

    return res.status(200).json({
      success: true,
      message: 'Google Sheets connection successful',
      data: {
        spreadsheetId,
        title: response.data.properties?.title || 'Unknown',
        sheets: response.data.sheets?.map(s => s.properties?.title) || []
      }
    });

  } catch (error) {
    console.error('[Test All] Sheets basic test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google Sheets connection failed',
      error: error.message
    });
  }
}

async function handleSheetsConnectionTest(req, res) {
  console.log('[Test All] Running sheets connection test...');
  
  try {
    const credentialsJSON = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
    if (!credentialsJSON) {
      console.error('[Test All] No credentials found');
      return res.status(401).json({
        success: false,
        message: 'Google Sheets credentials not configured. Please set GOOGLE_SHEETS_CREDENTIALS_JSON in Vercel environment variables.'
      });
    }

    console.log('[Test All] Credentials found, length:', credentialsJSON.length);

    let credentials;
    try {
      credentials = JSON.parse(credentialsJSON);
      console.log('[Test All] Credentials parsed successfully');
    } catch (parseError) {
      console.error('[Test All] Failed to parse credentials JSON:', parseError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid Google Sheets credentials JSON format.',
        error: parseError.message
      });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      console.error('[Test All] No spreadsheet ID found');
      return res.status(401).json({
        success: false,
        message: 'GOOGLE_SHEETS_SPREADSHEET_ID environment variable is not set.'
      });
    }

    console.log('[Test All] Spreadsheet ID found:', spreadsheetId);

    const sheetName = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
    console.log('[Test All] Using sheet name:', sheetName);

    console.log('[Test All] Initializing Google Sheets API...');

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    console.log('[Test All] Auth initialized, creating sheets client...');

    const sheets = google.sheets({ version: 'v4', auth });

    console.log('[Test All] Attempting to read sheet...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A1`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });

    console.log('[Test All] Successfully read sheet');
    console.log('[Test All] Response data:', {
      hasValues: !!response.data.values,
      valuesLength: response.data.values?.length || 0,
      firstCellValue: response.data.values?.[0]?.[0] || 'empty'
    });

    return res.status(200).json({
      success: true,
      message: 'Successfully connected to Google Sheets.',
      data: {
        spreadsheetId,
        sheetName,
        cellA1Value: response.data.values?.[0]?.[0] ?? null,
        hasValuesInRange: !!response.data.values?.length
      }
    });

  } catch (error) {
    console.error('[Test All] Sheets connection test error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google Sheets connection failed',
      error: error.message
    });
  }
}

async function handleDebugEnvTest(req, res) {
  console.log('[Test All] Running debug env test...');
  
  const envVars = {
    GOOGLE_SHEETS_CREDENTIALS: {
      exists: !!process.env.GOOGLE_SHEETS_CREDENTIALS,
      length: process.env.GOOGLE_SHEETS_CREDENTIALS?.length || 0,
      preview: process.env.GOOGLE_SHEETS_CREDENTIALS?.substring(0, 50) + '...' || 'not set'
    },
    GOOGLE_SHEETS_CREDENTIALS_JSON: {
      exists: !!process.env.GOOGLE_SHEETS_CREDENTIALS_JSON,
      length: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON?.length || 0,
      preview: process.env.GOOGLE_SHEETS_CREDENTIALS_JSON?.substring(0, 50) + '...' || 'not set'
    },
    GOOGLE_SHEETS_SPREADSHEET_ID: {
      exists: !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      value: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'not set'
    },
    GOOGLE_SHEET_NAME: {
      exists: !!process.env.GOOGLE_SHEET_NAME,
      value: process.env.GOOGLE_SHEET_NAME || 'not set'
    },
    NODE_ENV: process.env.NODE_ENV || 'not set',
    VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
    credentialsParseable: (() => {
      const creds = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
      if (!creds) return false;
      try {
        const parsed = JSON.parse(creds);
        return {
          success: true,
          hasClientEmail: !!parsed.client_email,
          hasPrivateKey: !!parsed.private_key,
          projectId: parsed.project_id || 'not found',
          clientEmail: parsed.client_email || 'not found'
        };
      } catch (e) {
        return {
          success: false,
          error: e.message
        };
      }
    })()
  };

  return res.status(200).json({
    success: true,
    message: 'Environment variables debug info',
    data: envVars,
    recommendations: [
      !envVars.GOOGLE_SHEETS_CREDENTIALS.exists && !envVars.GOOGLE_SHEETS_CREDENTIALS_JSON.exists &&
        'Add GOOGLE_SHEETS_CREDENTIALS_JSON environment variable',
      !envVars.GOOGLE_SHEETS_SPREADSHEET_ID.exists &&
        'Add GOOGLE_SHEETS_SPREADSHEET_ID environment variable',
      envVars.credentialsParseable.success === false &&
        'Fix JSON format in GOOGLE_SHEETS_CREDENTIALS_JSON',
      envVars.credentialsParseable.success && !envVars.credentialsParseable.hasClientEmail &&
        'Service account JSON missing client_email',
      envVars.credentialsParseable.success && !envVars.credentialsParseable.hasPrivateKey &&
        'Service account JSON missing private_key'
    ].filter(Boolean)
  });
} 