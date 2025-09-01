// Test script for real video API
const url = 'https://video.bunnycdn.com/library/297723/videos/a9e55efa-2007-41c3-9a76-fb9770c03f45';
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    AccessKey: 'c09f034e-5b1d-4f62-9c9dad335ca9-4f70-4d6a'
  }
};

console.log('=== Testing Real Video API ===');
console.log('Library ID: 297723');
console.log('Video GUID: a9e55efa-2007-41c3-9a76-fb9770c03f45');
console.log('Fetching from:', url);

fetch(url, options)
  .then(res => {
    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));
    return res.json();
  })
  .then(json => {
    console.log('=== Raw Video Response ===');
    console.log(JSON.stringify(json, null, 2));
    
    console.log('\n=== Key Properties for Download ===');
    console.log('Title:', json.title);
    console.log('GUID:', json.guid);
    console.log('Status:', json.status);
    console.log('Available Resolutions:', json.availableResolutions);
    console.log('Has MP4 Fallback:', json.hasMP4Fallback);
    console.log('Video Library ID:', json.videoLibraryId);
    
    // Test different URL formats based on real data
    console.log('\n=== Testing Different Download URL Formats ===');
    
    const libraryId = '297723';
    const videoGuid = json.guid;
    const quality = '720p';
    
    // Current problematic URL (what we're using now)
    const currentUrl = `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4?resolution=${quality}`;
    console.log('❌ Current URL (404):', currentUrl);
    
    // Alternative URL formats based on Bunny.net patterns
    const testUrls = [
      // 1. CDN direct access pattern
      `https://vz-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      
      // 2. Alternative CDN pattern
      `https://video-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`,
      
      // 3. MP4 fallback if available
      json.hasMP4Fallback ? `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4` : null,
      
      // 4. Direct download endpoint
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download?resolution=${quality}`,
      
      // 5. Stream endpoint
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?download=true&resolution=${quality}`,
      
      // 6. Simple MP4 access
      `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/${quality}.mp4`,
    ].filter(Boolean);
    
    console.log('\n=== Potential Working URLs to Test ===');
    testUrls.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
    
    // Suggest the most likely working pattern
    console.log('\n=== Most Likely Working Pattern ===');
    console.log(`https://vz-${libraryId}.b-cdn.net/${videoGuid}/${quality}/video.mp4`);
    
  })
  .catch(err => {
    console.error('Error fetching video details:', err);
  });
