// Test script to fetch real video details and generate correct download URLs
const libraryId = '297723';
const videoGuid = 'a9e55efa-2007-41c3-9a76-fb9770c03f45';
const apiKey = 'c09f034e-5b1d-4f62-9c9dad335ca9-4f70-4d6a';

console.log('=== Testing Real Video Download URLs ===');
console.log('Library ID:', libraryId);
console.log('Video GUID:', videoGuid);

// First, let's try to fetch video details
const videoDetailsUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`;
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    AccessKey: apiKey
  }
};

console.log('Fetching video details from:', videoDetailsUrl);

fetch(videoDetailsUrl, options)
  .then(res => {
    console.log('API Response status:', res.status);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
  })
  .then(videoData => {
    console.log('\n=== Video Details ===');
    console.log('Title:', videoData.title);
    console.log('Status:', videoData.status);
    console.log('Available Resolutions:', videoData.availableResolutions);
    console.log('Has MP4 Fallback:', videoData.hasMP4Fallback);
    console.log('Video Library ID:', videoData.videoLibraryId);
    
    console.log('\n=== Testing Download URL Formats ===');
    
    // Test different download URL patterns
    const quality = '720p';
    
    // Current problematic URL
    const currentUrl = `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4?resolution=${quality}`;
    console.log('❌ Current URL (causes 404):', currentUrl);
    
    // Potential correct download URLs based on Bunny.net patterns
    const downloadUrls = [
      // CDN direct access patterns
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      `https://library-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      
      // MP4 fallback patterns
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
      
      // API download endpoints
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download`,
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download?resolution=${quality}`,
      
      // Media delivery patterns
      `https://iframe.mediadelivery.net/download/${libraryId}/${videoGuid}.mp4?resolution=${quality}`,
      `https://cdn.mediadelivery.net/${libraryId}/${videoGuid}/${quality}/video.mp4`,
    ];
    
    console.log('\n=== Recommended Download URLs to Test ===');
    downloadUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
    
    // Test if any of these URLs work by making HEAD requests
    testDownloadUrls(downloadUrls);
  })
  .catch(err => {
    console.error('Error fetching video details:', err);
    
    // If API fails, still test the URL patterns
    console.log('\n=== Testing Download URLs Without API Data ===');
    const quality = '720p';
    const fallbackUrls = [
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
    ];
    
    fallbackUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
    
    testDownloadUrls(fallbackUrls);
  });

async function testDownloadUrls(urls) {
  console.log('\n=== Testing URL Accessibility ===');
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`Testing ${i + 1}/${urls.length}: ${url}`);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors' // To avoid CORS issues
      });
      
      console.log(`  ✅ Status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        console.log(`  🎉 WORKING URL FOUND: ${url}`);
        break;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}
