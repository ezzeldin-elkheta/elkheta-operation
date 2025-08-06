# Environment Variables Setup Guide

This guide explains how to properly configure environment variables for the video upload application.

## Quick Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the .env file with your actual values:**
   ```bash
   nano .env
   ```

3. **Required Variables:**
   - `VITE_BUNNY_API_KEY`: Your Bunny.net API key (required for video uploads)

4. **Optional Variables:**
   - `GOOGLE_SHEETS_SPREADSHEET_ID`: For automatic sheet updates
   - `GOOGLE_SHEETS_CREDENTIALS_JSON`: Google service account credentials

## Environment Variables Reference

### Required Variables

#### `VITE_BUNNY_API_KEY`
- **Description**: API key for Bunny.net video CDN service
- **Format**: 36-character string (e.g., `12345678-abcd-1234-efgh-123456789012`)
- **How to get**: 
  1. Log into your [Bunny.net dashboard](https://dash.bunny.net)
  2. Go to Account → API Keys
  3. Copy your API key
- **Example**: `VITE_BUNNY_API_KEY=12345678-abcd-1234-efgh-123456789012`

### Optional Variables

#### `GOOGLE_SHEETS_SPREADSHEET_ID`
- **Description**: Google Sheets ID for automatic updates
- **Format**: Long alphanumeric string from the Google Sheets URL
- **Example**: `GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

#### `GOOGLE_SHEETS_CREDENTIALS_JSON`
- **Description**: Google service account credentials as JSON string
- **Format**: Valid JSON string (must be on one line)
- **Example**: `GOOGLE_SHEETS_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}"`

#### `GOOGLE_SHEET_NAME`
- **Description**: Name of the sheet tab to update
- **Default**: `OPERATIONS`
- **Example**: `GOOGLE_SHEET_NAME=2026_VIDEOS`

### Application Settings

#### `VITE_BASE_PATH`
- **Description**: Base path for the application
- **Default**: `/`
- **Example**: `VITE_BASE_PATH=/video-upload/`

#### `VITE_API_URL`
- **Description**: Backend API URL
- **Default**: `http://localhost:3000`
- **Example**: `VITE_API_URL=https://api.example.com`

## Environment Validation

The application automatically validates environment variables on startup:

### Success Indicators
- ✅ `VITE_BUNNY_API_KEY: [SET - 36 chars]`
- ✅ `All required environment variables are properly configured`

### Common Issues and Solutions

#### Issue: "VITE_BUNNY_API_KEY is not set"
**Solution**: 
1. Ensure `.env` file exists in the project root
2. Check that the variable is named exactly `VITE_BUNNY_API_KEY`
3. Restart the development server after changes

#### Issue: "API key format appears invalid"
**Solution**:
1. Verify the API key is exactly 36 characters
2. Check for extra spaces or quotes
3. Ensure the key follows UUID format (8-4-4-4-12)

#### Issue: "401 Unauthorized" errors
**Solution**:
1. Verify the API key is active in Bunny.net dashboard
2. Check if the API key has correct permissions
3. Ensure the key hasn't expired

## Development vs Production

### Development (.env)
- Use development/test API keys
- Can use placeholder values for optional variables
- Environment validation is more permissive

### Production (GitHub Actions/Vercel)
- Set environment variables in deployment platform
- Use production API keys
- All required variables must be properly configured

## Security Best Practices

1. **Never commit `.env` files** - They're already in `.gitignore`
2. **Use different API keys** for development and production
3. **Rotate API keys regularly**
4. **Limit API key permissions** to only what's needed
5. **Monitor API key usage** in Bunny.net dashboard

## Troubleshooting

### Check Environment Status
The application logs environment status on startup. Look for:
```
🔧 Environment Configuration Status
Environment Variables:
  NODE_ENV: development
  VITE_BUNNY_API_KEY: [SET - 36 chars]
  ...
✅ All required environment variables are properly configured
```

### Manual Testing
You can manually test environment variable loading:
```bash
node -e "require('dotenv').config(); console.log('VITE_BUNNY_API_KEY:', process.env.VITE_BUNNY_API_KEY ? '[SET]' : '[NOT SET]')"
```

### Common File Locations
- Development: `.env` (project root)
- Example template: `.env.example`
- Development template: `.env.development`

## Getting Help

If you continue to have issues:
1. Check the browser console for error messages
2. Verify your `.env` file syntax
3. Ensure the Bunny.net API key is active
4. Check network connectivity to Bunny.net services