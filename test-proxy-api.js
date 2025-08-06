// Test video API through our server proxy
async function testVideoAPI() {
    const libraryId = '297723';
    const videoGuid = 'a9e55efa-2007-41c3-9a76-fb9770c03f45';
    const apiKey = 'c09f034e-5b1d-4f62-9c9dad335ca9-4f70-4d6a';
    
    console.log('=== Testing Video API through Server Proxy ===');
    
    try {
        // Test 1: Direct fetch to our proxy
        console.log('\n1. Testing server proxy...');
        const proxyUrl = `http://localhost:3000/api/proxy/video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}`;
        
        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'AccessKey': apiKey
            }
        });
        
        console.log('Proxy response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('\n=== Video Data Retrieved ===');
            console.log('Title:', data.title);
            console.log('GUID:', data.guid);
            console.log('Status:', data.status);
            console.log('Available Resolutions:', data.availableResolutions);
            console.log('Has MP4 Fallback:', data.hasMP4Fallback);
            console.log('Video Library ID:', data.videoLibraryId);
            
            // Test different download URL patterns
            console.log('\n=== Testing Download URL Patterns ===');
            
            const testUrls = [
                // Current problematic
                `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}.mp4?resolution=720p`,
                
                // CDN patterns
                `https://vz-${libraryId}.b-cdn.net/${videoGuid}/720p/video.mp4`,
                `https://video-${libraryId}.b-cdn.net/${videoGuid}/720p/video.mp4`,
                `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
                
                // Alternative patterns
                `https://iframe.mediadelivery.net/play/${libraryId}/${videoGuid}/720p.mp4`,
                `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?download=true&resolution=720p`
            ];
            
            console.log('\nURLs to test manually:');
            testUrls.forEach((url, index) => {
                console.log(`${index + 1}. ${url}`);
            });
            
            // Return the data for fixing the code
            return {
                success: true,
                videoData: data,
                recommendedUrls: testUrls
            };
            
        } else {
            const errorText = await response.text();
            console.error('Proxy error:', response.status, errorText);
            return { success: false, error: errorText };
        }
        
    } catch (error) {
        console.error('Network error:', error);
        return { success: false, error: error.message };
    }
}

// Run the test
testVideoAPI().then(result => {
    if (result.success) {
        console.log('\n✅ Test completed successfully');
        console.log('Now we can fix the download URLs in the code');
    } else {
        console.log('\n❌ Test failed:', result.error);
    }
});
