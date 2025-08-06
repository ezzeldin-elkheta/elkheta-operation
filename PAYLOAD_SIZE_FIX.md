# 🔧 Fix for 413 Payload Too Large Error

## Problem Description
The application was encountering `413 Content Too Large` errors when uploading video files through Vercel serverless functions. This happened because:

1. **Vercel Payload Limit**: Vercel serverless functions have a 4.5MB payload size limit
2. **Large Video Files**: Video files being uploaded were much larger than this limit
3. **Proxy Routing**: Large files were being routed through the proxy endpoint instead of direct upload

## Root Cause Analysis
The upload service had logic to detect large files and use direct upload to Bunny.net, but there were issues:

1. **Threshold Too High**: The original threshold was 4.5MB, which was exactly at Vercel's limit
2. **Inconsistent Logic**: Different upload methods had different logic for handling large files
3. **Fallback Issues**: Some upload paths could still route large files through the proxy

## Solution Implemented

### 1. Lowered Payload Threshold
```typescript
// Before: 4.5MB (at Vercel's limit)
const VERCEL_PAYLOAD_LIMIT = 4.5 * 1024 * 1024;

// After: 3MB (conservative approach)
const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024;
```

### 2. Enhanced Upload Logic
Updated multiple upload methods to consistently handle large files:

#### A. `uploadVideoContentWithRetry` Method
```typescript
// Force XHR (direct upload) for large files
const isLargeFile = file.size > VERCEL_PAYLOAD_LIMIT;
if (isLargeFile) {
  console.log(`Large file detected (${(file.size / (1024 * 1024)).toFixed(2)} MB), forcing XHR direct upload`);
  useStreaming = false; // Force XHR for large files
}
```

#### B. Main Upload Method
```typescript
// Force XHR for large files in main upload logic
const useStreamUpload = !isLargeFile && settings?.useStreaming !== false && 
                       typeof file.stream === 'function' && file.size < maxDirectSizeBytes;
```

#### C. Stream Upload Method
```typescript
// Force XHR for large files in stream upload method
const useStreaming = !isLargeFile; // Only use streaming for small files
```

### 3. Improved Proxy Endpoint
Enhanced the proxy endpoint to provide better error messages:

```javascript
// Check for large payloads early
const contentLength = parseInt(req.headers['content-length'] || '0');
const MAX_PAYLOAD_SIZE = 3 * 1024 * 1024; // 3MB limit

if (contentLength > MAX_PAYLOAD_SIZE) {
  return res.status(413).json({
    error: 'Payload Too Large',
    message: `File size ${(contentLength / (1024 * 1024)).toFixed(2)} MB exceeds Vercel's ${(MAX_PAYLOAD_SIZE / (1024 * 1024)).toFixed(2)} MB limit. Use direct upload to Bunny.net for large files.`,
    fileSizeMB: (contentLength / (1024 * 1024)).toFixed(2),
    maxSizeMB: (MAX_PAYLOAD_SIZE / (1024 * 1024)).toFixed(2)
  });
}
```

### 4. Enhanced Logging
Added comprehensive logging to help debug upload issues:

```typescript
console.log(`[UploadService-Stream] File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB, Vercel limit: ${(VERCEL_PAYLOAD_LIMIT / (1024 * 1024)).toFixed(2)} MB, using direct upload: ${useDirectUpload}`);
```

## Upload Flow After Fix

### For Small Files (< 3MB):
1. ✅ Use streaming upload method
2. ✅ Route through proxy endpoint
3. ✅ Proxy forwards to Bunny.net

### For Large Files (≥ 3MB):
1. ✅ Force XHR upload method
2. ✅ Direct upload to Bunny.net
3. ✅ Bypass Vercel proxy completely

## Testing the Fix

### 1. Test Different File Sizes
```javascript
// Run this in browser console
function testUploadLogic() {
  const testCases = [
    { size: 1 * 1024 * 1024, name: '1MB file' },
    { size: 3 * 1024 * 1024, name: '3MB file' },
    { size: 10 * 1024 * 1024, name: '10MB file' },
  ];
  
  testCases.forEach(testCase => {
    const isLargeFile = testCase.size > 3 * 1024 * 1024;
    console.log(`${testCase.name}: ${isLargeFile ? 'Direct Upload' : 'Proxy Upload'}`);
  });
}
```

### 2. Expected Behavior
- **Files < 3MB**: Should use proxy upload (streaming)
- **Files ≥ 3MB**: Should use direct upload (XHR)
- **No more 413 errors**: Large files bypass Vercel completely

## Deployment Instructions

### 1. Deploy Changes
```bash
git add .
git commit -m "Fix 413 payload size error - force direct upload for large files"
git push origin main
vercel --prod
```

### 2. Test Upload
1. Try uploading a small file (< 3MB) - should work via proxy
2. Try uploading a large file (≥ 3MB) - should work via direct upload
3. Check browser console for upload method logs

### 3. Monitor Logs
Look for these log messages:
- `[UploadService] Large file detected, forcing XHR direct upload`
- `[UploadService-Retry] using XHR for GUID: xxx`
- `[UploadService-Stream] Large file detected, using direct upload to Bunny.net`

## Benefits of This Fix

### 1. **Reliability**: Large files bypass Vercel limits completely
### 2. **Performance**: Direct upload is faster for large files
### 3. **Consistency**: All upload methods handle large files the same way
### 4. **Debugging**: Enhanced logging helps identify issues
### 5. **User Experience**: No more 413 errors for large uploads

## Fallback Strategy

If direct upload fails for any reason:
1. **Retry Logic**: Up to 3 attempts with exponential backoff
2. **TUS Fallback**: For very large files (≥ 50MB), fall back to TUS upload
3. **Error Handling**: Clear error messages for debugging

## Monitoring

After deployment, monitor:
1. **Upload Success Rate**: Should be 100% for files < 3MB, high for larger files
2. **Error Logs**: Should see fewer 413 errors
3. **Performance**: Direct uploads should be faster
4. **Console Logs**: Should see appropriate upload method selection

## Future Improvements

1. **Dynamic Threshold**: Could adjust threshold based on Vercel's actual limits
2. **Chunked Upload**: For very large files, implement chunked upload
3. **Progress Tracking**: Better progress tracking for direct uploads
4. **Retry Strategy**: More sophisticated retry logic for network issues 