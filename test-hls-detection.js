// Test script to check HLS URL detection methods
const accessKey = '7eabe18c-4c2f-4921-b3af4531b8a7-01b1-481b';
const libraryId = '373439';
const videoId = 'dc3f5a40-83f1-49f8-aac3-95dfc86c0632';

async function testHlsDetection() {
    console.log('🔍 Testing HLS URL Detection Methods');
    console.log('=====================================');
    
    try {
        // First, get video details
        const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
        console.log(`📡 Fetching video data from: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                "AccessKey": accessKey,
                "accept": "application/json"
            }
        });
        
        if (response.status === 200) {
            const videoData = await response.json();
            console.log('✅ Video data fetched successfully');
            
            // Check all properties for HLS-related URLs
            console.log('\n🔍 Scanning video data for HLS/stream URLs...');
            
            for (const [key, value] of Object.entries(videoData)) {
                if (typeof value === 'string' && (
                    value.includes('.m3u8') || 
                    value.includes('playlist') ||
                    value.includes('stream') ||
                    value.includes('hls') ||
                    value.includes('vz-') ||
                    value.includes('b-cdn.net')
                )) {
                    console.log(`🎯 Found potential stream URL in "${key}": ${value}`);
                }
            }
            
            // Try alternative HLS URL patterns
            console.log('\n🔧 Testing alternative HLS URL patterns...');
            
            const potentialHlsUrls = [
                `https://vz-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`,
                `https://video-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`,
                `https://cdn-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`,
                `https://stream-${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`,
                `https://${libraryId}.b-cdn.net/${videoId}/playlist.m3u8`,
                `https://iframe.mediadelivery.net/play/${libraryId}/${videoId}/playlist.m3u8`,
                `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}/hls/playlist.m3u8`
            ];
            
            for (const hlsUrl of potentialHlsUrls) {
                console.log(`🧪 Testing: ${hlsUrl}`);
                try {
                    const hlsResponse = await fetch(hlsUrl, {
                        method: 'HEAD',
                        headers: {
                            "AccessKey": accessKey
                        }
                    });
                    console.log(`   📊 Status: ${hlsResponse.status}`);
                    
                    if (hlsResponse.status === 200) {
                        console.log(`✅ Found working HLS URL: ${hlsUrl}`);
                        
                        // Try to fetch the content
                        const contentResponse = await fetch(hlsUrl, {
                            headers: {
                                "AccessKey": accessKey
                            }
                        });
                        
                        if (contentResponse.ok) {
                            const hlsContent = await contentResponse.text();
                            console.log('\n📋 HLS Playlist Content:');
                            console.log(hlsContent);
                            
                            // Extract MP4 URLs from HLS content
                            console.log('\n🎬 Extracting MP4 URLs from HLS...');
                            const lines = hlsContent.split('\n');
                            const mp4Lines = lines.filter(line => line.includes('.mp4') || line.includes('.ts'));
                            
                            if (mp4Lines.length > 0) {
                                console.log('🎯 Found potential video segments:');
                                mp4Lines.forEach((line, index) => {
                                    console.log(`${index + 1}. ${line}`);
                                    
                                    // Try to construct full URL if relative
                                    if (line.startsWith('video_') || line.includes('.mp4')) {
                                        const baseHlsUrl = hlsUrl.substring(0, hlsUrl.lastIndexOf('/'));
                                        const fullUrl = line.startsWith('http') ? line : `${baseHlsUrl}/${line}`;
                                        console.log(`   Full URL: ${fullUrl}`);
                                    }
                                });
                            } else {
                                console.log('❌ No direct MP4 segments found in HLS playlist');
                            }
                        }
                        return hlsUrl;
                    }
                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }
            }
            
            console.log('\n💡 Alternative approach: Check for direct stream URLs...');
            
            // Try to construct stream URLs based on video properties
            if (videoData.availableResolutions) {
                const resolutions = videoData.availableResolutions.split(',');
                console.log(`📐 Available resolutions: ${resolutions.join(', ')}`);
                
                // Try authenticated CDN URLs
                for (const resolution of resolutions) {
                    const streamUrls = [
                        `https://vz-${libraryId}.b-cdn.net/${videoId}/${resolution.trim()}/video.mp4`,
                        `https://video-${libraryId}.b-cdn.net/${videoId}/${resolution.trim()}/video.mp4`
                    ];
                    
                    for (const streamUrl of streamUrls) {
                        console.log(`🧪 Testing authenticated stream: ${streamUrl}`);
                        try {
                            const streamResponse = await fetch(streamUrl, {
                                method: 'HEAD',
                                headers: {
                                    "AccessKey": accessKey,
                                    "Authorization": `Bearer ${accessKey}`,
                                    "X-API-Key": accessKey
                                }
                            });
                            console.log(`   📊 Status: ${streamResponse.status}`);
                            
                            if (streamResponse.status === 200) {
                                console.log(`✅ Found working authenticated stream: ${streamUrl}`);
                                return streamUrl;
                            }
                        } catch (error) {
                            console.log(`   ❌ Error: ${error.message}`);
                        }
                    }
                }
            }
            
        } else {
            console.error(`❌ Failed to fetch video data. Status: ${response.status}`);
        }
        
    } catch (error) {
        console.error('💥 Error in HLS detection:', error.message);
    }
    
    console.log('\n🏁 HLS detection test completed');
    return null;
}

// Run the test
testHlsDetection().catch(console.error);
