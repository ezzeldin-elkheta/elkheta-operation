# API Deployment Debugging

This document helps debug API routing issues in deployment.

## API Structure

The application uses Next.js API routes in the `pages/api/` directory:

- `/api/auth-check` - Tests Bunny.net API key validity
- `/api/proxy/base/videolibrary` - Proxies to `https://api.bunny.net/videolibrary`
- `/api/proxy/base/[...path]` - Catch-all proxy for base API calls
- `/api/proxy/video/[...path]` - Catch-all proxy for video API calls

## Expected Request Flow

1. Client calls `/api/proxy/base/videolibrary?page=1&perPage=100&orderBy=name`
2. Next.js routes this to `pages/api/proxy/base/videolibrary.js`
3. Handler extracts `AccessKey` from headers
4. Handler makes request to `https://api.bunny.net/videolibrary?page=1&perPage=100&orderBy=name`
5. Handler returns Bunny.net response to client

## Common Issues

### 404 Errors
- Check vercel.json configuration
- Ensure API files are in correct `pages/api/` structure
- Verify build includes API files

### 401 Errors
- Check AccessKey header is being sent
- Verify API key is valid in Bunny.net dashboard

### Environment Variables
The API routes do NOT require environment variables - they use the AccessKey header from client requests.

## Testing API Routes

Test individual endpoints:
- GET `/api/test` - Basic API test
- GET `/api/auth-check` - Bunny.net auth test
- GET `/api/test-videolibrary` - Test videolibrary endpoint

Add `AccessKey` header with your Bunny.net API key when testing.