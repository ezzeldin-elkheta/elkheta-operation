// Test script to verify upload logic for different file sizes
// Run this in the browser console to test the logic

function testUploadLogic() {
  console.log('=== Testing Upload Logic ===');
  
  // Simulate different file sizes
  const testCases = [
    { size: 1 * 1024 * 1024, name: '1MB file' },      // Small file
    { size: 2 * 1024 * 1024, name: '2MB file' },      // Small file
    { size: 3 * 1024 * 1024, name: '3MB file' },      // At limit
    { size: 4 * 1024 * 1024, name: '4MB file' },      // Large file
    { size: 10 * 1024 * 1024, name: '10MB file' },    // Large file
    { size: 50 * 1024 * 1024, name: '50MB file' },    // Very large file
    { size: 100 * 1024 * 1024, name: '100MB file' },  // Very large file
  ];
  
  const VERCEL_PAYLOAD_LIMIT = 3 * 1024 * 1024; // 3MB limit
  
  testCases.forEach(testCase => {
    const isLargeFile = testCase.size > VERCEL_PAYLOAD_LIMIT;
    const useStreaming = !isLargeFile;
    const uploadMethod = useStreaming ? 'STREAM' : 'XHR (Direct)';
    
    console.log(`${testCase.name} (${(testCase.size / (1024 * 1024)).toFixed(2)} MB):`);
    console.log(`  - Large file: ${isLargeFile}`);
    console.log(`  - Use streaming: ${useStreaming}`);
    console.log(`  - Upload method: ${uploadMethod}`);
    console.log(`  - URL: ${isLargeFile ? 'Direct to Bunny.net' : 'Via proxy'}`);
    console.log('');
  });
}

// Run the test
testUploadLogic(); 