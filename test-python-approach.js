// Test implementation based on Python code approach
// This script tests extracting HLS URL and converting to MP4 download URL

async function getMP4Url(accessKey, libraryId, videoId) {
  try {
    console.log(`=== Getting MP4 URL for Video ===`);
    console.log(`Library ID: ${libraryId}`);
    console.log(`Video ID: ${videoId}`);
    console.log(`Access Key: ${accessKey}`);
    
    // Get video details
    const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
    const headers = {
      "AccessKey": accessKey,
      "accept": "application/json"
    };
    
    console.log(`Fetching from: ${url}`);
    
    const response = await fetch(url, { headers });
    
    if (response.status === 200) {
      const videoData = await response.json();
      console.log(`\n=== Video Data Response ===`);
      console.log(JSON.stringify(videoData, null, 2));
      
      // Extract HLS URL from video details
      if (videoData.hlsUrl) {
        const hlsUrl = videoData.hlsUrl;
        console.log(`\n=== HLS URL Found ===`);
        console.log(`HLS URL: ${hlsUrl}`);
        
        // Extract base URL from HLS URL
        const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/'));
        console.log(`Base URL: ${baseUrl}`);
        
        // Build MP4 URLs for different qualities
        const qualities = ['720p', '480p', '360p', '240p', '1080p'];
        const mp4Urls = [];
        
        console.log(`\n=== Generated MP4 URLs ===`);
        qualities.forEach(quality => {
          const mp4Url = `${baseUrl}/play_${quality}.mp4`;
          mp4Urls.push({ quality, url: mp4Url });
          console.log(`${quality}: ${mp4Url}`);
        });
        
        return mp4Urls;
      } else {
        console.log(`❌ No hlsUrl found in video data`);
        console.log(`Available fields:`, Object.keys(videoData));
        return null;
      }
    } else {
      console.log(`❌ Request failed with status: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error response: ${errorText}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error getting MP4 URL:`, error);
    return null;
  }
}

async function testMP4Urls(mp4Urls) {
  console.log(`\n=== Testing MP4 URLs ===`);
  
  for (const { quality, url } of mp4Urls) {
    try {
      console.log(`\nTesting ${quality}: ${url}`);
      
      // Test with HEAD request to check if URL exists
      const response = await fetch(url, { method: 'HEAD' });
      console.log(`Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log(`✅ ${quality} - URL is accessible`);
        const contentLength = response.headers.get('content-length');
        const contentType = response.headers.get('content-type');
        if (contentLength) {
          console.log(`   File size: ${(parseInt(contentLength) / (1024 * 1024)).toFixed(2)} MB`);
        }
        if (contentType) {
          console.log(`   Content type: ${contentType}`);
        }
      } else {
        console.log(`❌ ${quality} - URL not accessible (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ ${quality} - Error testing URL:`, error.message);
    }
  }
}

// Test with real video data from your system
async function testWithRealData() {
  console.log(`=== Testing with Real Video Data ===`);
  
  // Test data from your previous API call
  const testCases = [
    {
      name: "Video from ezz/5 system",
      accessKey: "c09f034e-5b1d-4f62-9c9dad335ca9-4f70-4d6a",
      libraryId: "297723",
      videoId: "a9e55efa-2007-41c3-9a76-fb9770c03f45"
    },
    {
      name: "Video from Python example",
      accessKey: "7eabe18c-4c2f-4921-b3af4531b8a7-01b1-481b",
      libraryId: "373439", 
      videoId: "dc3f5a40-83f1-49f8-aac3-95dfc86c0632"
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    
    const mp4Urls = await getMP4Url(testCase.accessKey, testCase.libraryId, testCase.videoId);
    
    if (mp4Urls && mp4Urls.length > 0) {
      await testMP4Urls(mp4Urls);
      
      // Return the best quality URL for further testing
      console.log(`\n=== Recommended Download URL ===`);
      const bestQuality = mp4Urls.find(u => u.quality === '720p') || mp4Urls[0];
      console.log(`Best quality URL: ${bestQuality.url}`);
      
    } else {
      console.log(`❌ Failed to get MP4 URLs for ${testCase.name}`);
    }
  }
}

// Additional test: Check if video has different URL patterns
async function testAlternativePatterns(videoData) {
  console.log(`\n=== Testing Alternative URL Patterns ===`);
  
  if (!videoData.hlsUrl) {
    console.log(`No HLS URL available for pattern testing`);
    return;
  }
  
  const hlsUrl = videoData.hlsUrl;
  const baseUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/'));
  
  // Alternative patterns based on Bunny.net documentation
  const patterns = [
    // Original Python approach
    `${baseUrl}/play_720p.mp4`,
    
    // Alternative patterns
    `${baseUrl}/video_720p.mp4`,
    `${baseUrl}/720p/video.mp4`,
    `${baseUrl}/720p.mp4`,
    
    // Direct access patterns
    hlsUrl.replace('/playlist.m3u8', '/720p.mp4'),
    hlsUrl.replace('/playlist.m3u8', '/play_720p.mp4'),
  ];
  
  console.log(`Base HLS URL: ${hlsUrl}`);
  console.log(`Extracted base URL: ${baseUrl}`);
  
  for (let i = 0; i < patterns.length; i++) {
    console.log(`\nPattern ${i + 1}: ${patterns[i]}`);
    try {
      const response = await fetch(patterns[i], { method: 'HEAD' });
      console.log(`Status: ${response.status} ${response.status === 200 ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`Error: ${error.message} ❌`);
    }
  }
}

// Run the tests
testWithRealData()
  .then(() => console.log(`\n=== Test Completed ===`))
  .catch(error => console.error(`Test failed:`, error));
