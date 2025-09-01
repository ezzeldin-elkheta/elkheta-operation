// Test script implementing the Python approach for video download
// Based on the Python code provided

async function getMP4Url(accessKey, libraryId, videoId) {
    try {
        // Get video details
        const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
        const headers = {
            "AccessKey": accessKey,
            "accept": "application/json"
        };
        
        console.log(`🔍 Fetching video details from: ${url}`);
        
        const response = await fetch(url, { 
            method: 'GET',
            headers: headers 
        });
        
        console.log(`📊 Response status: ${response.status}`);
        
        if (response.status === 200) {
            const videoData = await response.json();
            
            console.log('\n=== 📹 Video Data Analysis ===');
            console.log('Full video data:', JSON.stringify(videoData, null, 2));
            
            // Extract key information
            console.log('\n=== 🔑 Key Video Information ===');
            console.log('Title:', videoData.title);
            console.log('GUID:', videoData.guid);
            console.log('Status:', videoData.status);
            console.log('Video Library ID:', videoData.videoLibraryId);
            console.log('Available Resolutions:', videoData.availableResolutions);
            console.log('Has MP4 Fallback:', videoData.hasMP4Fallback);
            console.log('Length (seconds):', videoData.length);
            console.log('Width:', videoData.width);
            console.log('Height:', videoData.height);
            console.log('Frame Rate:', videoData.framerate);
            
            // Check for HLS URL (as in Python approach)
            if (videoData.hlsUrl) {
                console.log('\n✅ HLS URL found:', videoData.hlsUrl);
                
                // Extract base URL from HLS URL
                const baseUrl = videoData.hlsUrl.split('/').slice(0, -1).join('/');
                console.log('📍 Base URL extracted:', baseUrl);
                
                // Build MP4 URL for different qualities
                const qualities = ['720p', '480p', '360p', '1080p'];
                const mp4Urls = {};
                
                qualities.forEach(quality => {
                    mp4Urls[quality] = `${baseUrl}/play_${quality}.mp4`;
                });
                
                console.log('\n🎯 Generated MP4 URLs:');
                Object.entries(mp4Urls).forEach(([quality, url]) => {
                    console.log(`${quality}: ${url}`);
                });
                
                return mp4Urls;
            } else {
                console.log('\n❌ No HLS URL found in video data');
                
                // Try alternative approaches based on available data
                console.log('\n🔄 Trying alternative URL patterns...');
                
                const alternativeUrls = generateAlternativeUrls(libraryId, videoId, videoData);
                return alternativeUrls;
            }
        } else {
            console.error(`❌ Failed to fetch video details. Status: ${response.status}`);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return null;
        }
    } catch (error) {
        console.error('💥 Error in getMP4Url:', error);
        return null;
    }
}

function generateAlternativeUrls(libraryId, videoId, videoData) {
    console.log('\n🔧 Generating alternative URL patterns...');
    
    const qualities = ['720p', '480p', '360p', '1080p'];
    const alternativePatterns = {};
    
    qualities.forEach(quality => {
        alternativePatterns[quality] = [
            // Pattern 1: CDN direct access
            `https://vz-${libraryId}.b-cdn.net/${videoId}/${quality}/video.mp4`,
            
            // Pattern 2: Alternative CDN pattern  
            `https://video-${libraryId}.b-cdn.net/${videoId}/${quality}/video.mp4`,
            
            // Pattern 3: Play endpoint with quality
            `https://iframe.mediadelivery.net/play/${libraryId}/${videoId}/${quality}.mp4`,
            
            // Pattern 4: Embed with download parameter
            `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?download=true&resolution=${quality}`,
            
            // Pattern 5: Direct download endpoint
            `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/download?resolution=${quality}`,
        ];
    });
    
    return alternativePatterns;
}

async function testVideoDownload(mp4Url) {
    try {
        console.log(`\n🧪 Testing download URL: ${mp4Url}`);
        
        const response = await fetch(mp4Url, { method: 'HEAD' }); // HEAD request to check without downloading
        
        console.log(`📊 Status: ${response.status}`);
        console.log(`📏 Content-Length: ${response.headers.get('content-length') || 'Unknown'}`);
        console.log(`📋 Content-Type: ${response.headers.get('content-type') || 'Unknown'}`);
        
        if (response.status === 200) {
            console.log('✅ URL appears to be working!');
            return true;
        } else {
            console.log(`❌ URL failed with status ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`💥 Error testing URL: ${error.message}`);
        return false;
    }
}

async function downloadVideo(mp4Url, filename) {
    try {
        console.log(`\n⬇️ Attempting to download from: ${mp4Url}`);
        
        const response = await fetch(mp4Url);
        
        if (response.status === 200) {
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            console.log(`✅ Download initiated successfully for ${filename}`);
            return true;
        } else {
            console.log(`❌ Download failed with status ${response.status}`);
            return false;
        }
    } catch (error) {
        console.error(`💥 Download error: ${error.message}`);
        return false;
    }
}

// Main test function
async function runVideoDownloadTest() {
    console.log('🚀 Starting Video Download Test (Python Approach)');
    console.log('=' .repeat(50));
    
    // Test with provided video data
    const accessKey = "7eabe18c-4c2f-4921-b3af4531b8a7-01b1-481b";
    const libraryId = "373439";
    const videoId = "dc3f5a40-83f1-49f8-aac3-95dfc86c0632";
    
    console.log(`🎯 Testing with:`);
    console.log(`   Library ID: ${libraryId}`);
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Access Key: ${accessKey.substring(0, 8)}...`);
    
    // Step 1: Get video details and potential MP4 URLs
    const urlResults = await getMP4Url(accessKey, libraryId, videoId);
    
    if (urlResults) {
        console.log('\n🎉 Successfully obtained potential URLs!');
        
        // Step 2: Test each URL to find working ones
        console.log('\n🧪 Testing URLs for accessibility...');
        
        const workingUrls = [];
        
        for (const [quality, urls] of Object.entries(urlResults)) {
            console.log(`\n🎬 Testing ${quality} quality:`);
            
            if (Array.isArray(urls)) {
                // Multiple URLs to test for this quality
                for (let i = 0; i < urls.length; i++) {
                    const url = urls[i];
                    console.log(`  Testing pattern ${i + 1}:`);
                    const works = await testVideoDownload(url);
                    if (works) {
                        workingUrls.push({ quality, url, pattern: i + 1 });
                        break; // Found working URL for this quality
                    }
                }
            } else {
                // Single URL for this quality
                const works = await testVideoDownload(urls);
                if (works) {
                    workingUrls.push({ quality, url: urls });
                }
            }
        }
        
        // Step 3: Report results
        console.log('\n📋 TEST RESULTS:');
        console.log('=' .repeat(30));
        
        if (workingUrls.length > 0) {
            console.log('✅ Working URLs found:');
            workingUrls.forEach(({ quality, url, pattern }) => {
                console.log(`   ${quality}: ${url}${pattern ? ` (Pattern ${pattern})` : ''}`);
            });
            
            // Offer to download the best quality
            const bestQuality = workingUrls.find(u => u.quality === '720p') || workingUrls[0];
            console.log(`\n🎯 Best available quality: ${bestQuality.quality}`);
            console.log(`📁 URL: ${bestQuality.url}`);
            
            // In a real browser environment, you could uncomment this to actually download:
            // await downloadVideo(bestQuality.url, `video_${videoId}_${bestQuality.quality}.mp4`);
            
        } else {
            console.log('❌ No working URLs found');
            console.log('💡 This might indicate:');
            console.log('   - Video is not publicly accessible');
            console.log('   - Different authentication is required');
            console.log('   - Different URL pattern is needed');
        }
        
    } else {
        console.log('❌ Failed to get video details or generate URLs');
    }
    
    console.log('\n🏁 Test completed!');
}

// Auto-run the test
runVideoDownloadTest().catch(console.error);
