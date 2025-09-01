# Security Setup Guide

## ⚠️ CRITICAL SECURITY NOTICE

This application previously had sensitive credentials exposed in the repository. All credentials have been removed and sanitized.

## Setting Up Environment Variables Securely

### 1. Local Development

1. Copy `.env.development` to `.env.local`:
   ```bash
   cp .env.development .env.local
   ```

2. Edit `.env.local` and replace all placeholder values with your actual credentials:
   - `your_bunny_api_key_here` → Your actual Bunny.net API key
   - `your_project_id` → Your Supabase project ID
   - `your_password` → Your Supabase database password
   - `your_host` → Your Supabase database host
   - etc.

3. **NEVER commit `.env.local` or any file with real credentials**

### 2. Vercel Deployment

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each environment variable manually with the actual values

### 3. Other Deployment Platforms

Follow your platform's documentation for setting environment variables:
- Netlify: Site settings → Environment variables
- Railway: Project settings → Variables
- Heroku: Settings → Config Vars

## Security Best Practices

1. **Never commit credentials**: Always use environment variables
2. **Use different credentials for different environments**: Don't use production credentials in development
3. **Rotate credentials regularly**: Change API keys and passwords periodically
4. **Use minimal permissions**: Only grant the minimum required permissions to each service
5. **Monitor access logs**: Keep track of who accesses your services

## Files That Were Sanitized

The following files contained sensitive data and have been cleaned:
- `.env.development` → Now contains only template placeholders
- `vercel.json` → Removed hardcoded environment variables
- `test-video-api.html` → API key now prompted from user
- `DEPLOYMENT_STATUS.md` → Removed exposed credentials

## Immediate Actions Required

1. **Change all exposed credentials immediately**:
   - Generate new Bunny.net API key
   - Rotate Supabase credentials
   - Update any other services that used the exposed credentials

2. **Set up proper environment variables** in your deployment platform

3. **Test the application** to ensure it works with the new secure setup

## If Credentials Were Compromised

1. **Immediately revoke/change all exposed credentials**
2. **Check access logs** for any unauthorized usage
3. **Monitor for suspicious activity** in your accounts
4. **Consider enabling additional security measures** like IP restrictions where possible