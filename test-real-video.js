// Test script to fetch real video details and test download URL generation
const url = 'https://video.bunnycdn.com/library/297723/videos/a9e55efa-2007-41c3-9a76-fb9770c03f45';
const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    AccessKey: 'c09f034e-5b1d-4f62-9c9dad335ca9-4f70-4d6a'
  }
};

console.log('=== Fetching Real Video Details ===');
console.log('Library ID: 297723');
console.log('Video GUID: a9e55efa-2007-41c3-9a76-fb9770c03f45');
console.log('Fetching from:', url);

fetch(url, options)
  .then(res => {
    console.log('Response status:', res.status);
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
    
    // Test different URL formats
    console.log('\n=== Testing Different Download URL Formats ===');
    
    const libraryId = '297723';
    const videoGuid = json.guid;
    const quality = '720p';
    
    // Current problematic URL (what we're using now)
    const currentUrl = `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4?resolution=${quality}`;
    console.log('❌ Current URL (404):', currentUrl);
    
    // Alternative URL formats to test
    const alternatives = [
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}`,
      `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}`,
      `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}.mp4`,
      `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}?resolution=${quality}`,
      `https://video.bunnycdn.com/play/${libraryId}/${videoGuid}.mp4?resolution=${quality}`,
      `https://cdn.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4`,
      `https://cdn.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4?resolution=${quality}`,
      `https://iframe.mediadelivery.net/download/${libraryId}/${videoGuid}.mp4`,
      `https://iframe.mediadelivery.net/download/${libraryId}/${videoGuid}.mp4?resolution=${quality}`
    ];
    
    console.log('\n🔍 Alternative URL formats to investigate:');
    alternatives.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
    
    // Check if video has specific download URLs in response
    console.log('\n=== Checking for Download-Specific Properties ===');
    const possibleDownloadFields = [
      'downloadUrl', 'directUrl', 'mp4Url', 'videoUrl', 
      'playlistUrl', 'streamUrl', 'files', 'renditions'
    ];
    
    possibleDownloadFields.forEach(field => {
      if (json[field]) {
        console.log(`✅ Found ${field}:`, json[field]);
      }
    });
    
    console.log('\n=== Analysis Complete ===');
    console.log('We need to test these URLs to find the correct download endpoint.');
  })
  .catch(err => {
    console.error('❌ Error fetching video details:', err);
  });
