// Test different download URL formats
const libraryId = '297723';
const videoGuid = 'a9e55efa-2007-41c3-9a76-fb9770c03f45';

// Based on Bunny.net documentation and common patterns
const testUrls = [
    // 1. Direct MP4 download (most likely to work)
    `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}?autoplay=false&download=true`,
    
    // 2. CDN direct access
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/720p/video.mp4`,
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/480p/video.mp4`,
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/360p/video.mp4`,
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/240p/video.mp4`,
    
    // 3. Alternative CDN patterns
    `https://video-${libraryId}.b-cdn.net/${videoGuid}/720p/video.mp4`,
    `https://video-${libraryId}.b-cdn.net/${videoGuid}/480p/video.mp4`,
    
    // 4. MP4 fallback access
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/mp4/video.mp4`,
    
    // 5. Playlist-based access
    `https://vz-${libraryId}.b-cdn.net/${videoGuid}/playlist.m3u8`,
    
    // 6. Different subdomain patterns
    `https://library-${libraryId}.b-cdn.net/${videoGuid}/720p/video.mp4`,
    
    // 7. Direct video server access
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download`,
    `https://video.bunnycdn.com/library/${libraryId}/videos/${videoGuid}/download?resolution=720p`,
];

console.log('=== Testing Download URLs ===');
console.log('Library ID:', libraryId);
console.log('Video GUID:', videoGuid);
console.log('Available Resolutions: 360p,480p,720p,240p');
console.log('Has MP4 Fallback: true');
console.log('');

testUrls.forEach((url, index) => {
    console.log(`${index + 1}. ${url}`);
});

console.log('');
console.log('=== Recommended Testing Order ===');
console.log('1. Test CDN direct access first: vz-{libraryId}.b-cdn.net/{videoGuid}/{quality}/video.mp4');
console.log('2. Test MP4 fallback: vz-{libraryId}.b-cdn.net/{videoGuid}/mp4/video.mp4');
console.log('3. Test embed with download parameter');
console.log('4. Test API download endpoint');
