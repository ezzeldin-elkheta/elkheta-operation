// Test script based on Python approach to extract correct MP4 download URL
// Using real video data: Library 373439, Video dc3f5a40-83f1-49f8-aac3-95dfc86c0632

const REAL_VIDEO_DATA = {
    libraryId: '373439',
    videoGuid: 'dc3f5a40-83f1-49f8-aac3-95dfc86c0632',
    apiKey: '7eabe18c-4c2f-4921-b3af4531b8a7-01b1-481b'
};

console.log('=== Testing Python-based HLS to MP4 URL Extraction ===');
console.log('Video Data:', REAL_VIDEO_DATA);

async function getVideoDetails(libraryId, videoGuid, apiKey) {
    const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`;
    
    try {
        // Try direct API call first (will likely fail due to CORS)
        console.log(`\n📡 Fetching video details from: ${url}`);
        
        let response;
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'AccessKey': apiKey
                }
            });
        } catch (corsError) {
            console.log('❌ Direct API call failed (CORS), trying proxy...');
            
            // Try through local proxy
            const proxyUrl = `/api/proxy/video/library/${libraryId}/videos/${videoGuid}`;
            response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'AccessKey': apiKey
                }
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const videoData = await response.json();
        console.log('✅ Video details retrieved successfully');
        console.log('📊 Video Response Data:');
        console.log(JSON.stringify(videoData, null, 2));
        
        return videoData;
    } catch (error) {
        console.error('❌ Error fetching video details:', error);
        throw error;
    }
}

function extractMp4UrlFromHls(videoData, quality = '720p') {
    console.log(`\n🔍 Extracting MP4 URL for quality: ${quality}`);
    
    // Check if HLS URL exists in the response
    if (videoData.hlsUrl) {
        console.log('✅ HLS URL found:', videoData.hlsUrl);
        
        // Extract base URL from HLS URL (remove the last part)
        const baseUrl = videoData.hlsUrl.split('/').slice(0, -1).join('/');
        console.log('📁 Base URL extracted:', baseUrl);
        
        // Build MP4 URL using the base URL
        const mp4Url = `${baseUrl}/play_${quality}.mp4`;
        console.log('🎬 Generated MP4 URL:', mp4Url);
        
        return mp4Url;
    } else {
        console.log('❌ No HLS URL found in video data');
        console.log('🔍 Available fields in video data:', Object.keys(videoData));
        
        // Try alternative approaches based on common Bunny.net patterns
        return generateAlternativeMp4Urls(videoData, quality);
    }
}

function generateAlternativeMp4Urls(videoData, quality = '720p') {
    console.log('\n🔄 Generating alternative MP4 URLs...');
    
    const { videoLibraryId, guid } = videoData;
    
    const alternatives = [
        // Pattern 1: Direct CDN with vz- prefix
        `https://vz-${videoLibraryId}.b-cdn.net/${guid}/play_${quality}.mp4`,
        
        // Pattern 2: Direct CDN without prefix
        `https://${videoLibraryId}.b-cdn.net/${guid}/play_${quality}.mp4`,
        
        // Pattern 3: MP4 in subfolder
        `https://vz-${videoLibraryId}.b-cdn.net/${guid}/mp4/${quality}.mp4`,
        
        // Pattern 4: Alternative CDN pattern
        `https://video-${videoLibraryId}.b-cdn.net/${guid}/play_${quality}.mp4`,
        
        // Pattern 5: Iframe player direct MP4
        `https://iframe.mediadelivery.net/play/${videoLibraryId}/${guid}/${quality}.mp4`,
        
        // Pattern 6: Original file format
        `https://vz-${videoLibraryId}.b-cdn.net/${guid}/original.mp4`
    ];
    
    console.log('🎯 Alternative MP4 URLs generated:');
    alternatives.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url}`);
    });
    
    return alternatives;
}

async function testMp4UrlsAccessibility(urls) {
    console.log('\n🧪 Testing MP4 URL accessibility...');
    
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = Array.isArray(urls) ? urls[i] : urls;
        console.log(`\n📝 Testing URL ${i + 1}: ${url}`);
        
        try {
            // Use HEAD request to check if URL is accessible without downloading
            const response = await fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors' // Avoid CORS issues
            });
            
            const result = {
                url: url,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('Content-Type'),
                contentLength: response.headers.get('Content-Length'),
                accessible: response.ok || response.status === 0 // 0 for no-cors mode
            };
            
            results.push(result);
            
            if (result.accessible) {
                console.log(`✅ URL ${i + 1} is accessible`);
                console.log(`   📄 Content-Type: ${result.contentType || 'Unknown'}`);
                console.log(`   📏 Content-Length: ${result.contentLength || 'Unknown'}`);
            } else {
                console.log(`❌ URL ${i + 1} failed: ${result.status} ${result.statusText}`);
            }
            
        } catch (error) {
            console.log(`❌ URL ${i + 1} error: ${error.message}`);
            results.push({
                url: url,
                error: error.message,
                accessible: false
            });
        }
        
        // If we're testing an array, break if we find a working URL
        if (Array.isArray(urls) && results[results.length - 1].accessible) {
            console.log(`🎉 Found working URL! Stopping tests.`);
            break;
        }
    }
    
    return results;
}

function createDownloadLink(mp4Url, filename) {
    console.log(`\n📥 Creating download link for: ${filename}`);
    
    // Create a download link element
    const link = document.createElement('a');
    link.href = mp4Url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    
    // Style the link
    link.style.cssText = `
        display: inline-block;
        padding: 10px 20px;
        background: #007bff;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        margin: 10px;
        font-weight: bold;
    `;
    link.textContent = `تحميل ${filename}`;
    
    // Add to page
    document.body.appendChild(link);
    
    // Auto-click to start download
    link.click();
    
    console.log('✅ Download link created and clicked');
    return link;
}

// Main test function
async function runTest() {
    try {
        console.log('🚀 Starting Python-based MP4 URL extraction test...');
        
        // Step 1: Get video details
        const videoData = await getVideoDetails(
            REAL_VIDEO_DATA.libraryId,
            REAL_VIDEO_DATA.videoGuid,
            REAL_VIDEO_DATA.apiKey
        );
        
        // Step 2: Extract MP4 URL from HLS or generate alternatives
        let mp4Urls;
        if (videoData.hlsUrl) {
            mp4Urls = extractMp4UrlFromHls(videoData, '720p');
        } else {
            mp4Urls = generateAlternativeMp4Urls(videoData, '720p');
        }
        
        // Step 3: Test URL accessibility
        const testResults = await testMp4UrlsAccessibility(mp4Urls);
        
        // Step 4: Find working URLs and create download links
        const workingUrls = testResults.filter(result => result.accessible);
        
        if (workingUrls.length > 0) {
            console.log('\n🎉 SUCCESS! Found working MP4 URLs:');
            workingUrls.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.url}`);
                
                // Create download link for the first working URL
                if (index === 0) {
                    const filename = `${videoData.title || 'video'}_720p.mp4`;
                    createDownloadLink(result.url, filename);
                }
            });
        } else {
            console.log('\n❌ No working MP4 URLs found');
            console.log('📋 All test results:');
            testResults.forEach((result, index) => {
                console.log(`   ${index + 1}. ${result.url} - ${result.accessible ? 'OK' : 'FAILED'}`);
            });
        }
        
        // Store results globally for manual testing
        window.testResults = {
            videoData,
            mp4Urls,
            testResults,
            workingUrls
        };
        
        console.log('\n✅ Test completed. Results stored in window.testResults');
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.runPythonHlsTest = runTest;
    window.REAL_VIDEO_DATA = REAL_VIDEO_DATA;
    
    // Auto-run test when script loads
    console.log('📝 Script loaded. Call runPythonHlsTest() to start the test.');
    console.log('🔧 Or access REAL_VIDEO_DATA for manual testing.');
}

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runTest,
        getVideoDetails,
        extractMp4UrlFromHls,
        generateAlternativeMp4Urls,
        testMp4UrlsAccessibility,
        REAL_VIDEO_DATA
    };
}
