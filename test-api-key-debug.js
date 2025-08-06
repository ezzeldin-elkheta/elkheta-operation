import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

console.log('Environment variables loaded:');
console.log('VITE_BUNNY_API_KEY:', process.env.VITE_BUNNY_API_KEY?.substring(0, 8) + '...');

async function testApiKey() {
    try {
        // Test 1: Get library info
        console.log('\n🔍 Testing API key with GET library/301922...');
        const getResponse = await axios.get('https://video.bunnycdn.com/library/301922', {
            headers: {
                'AccessKey': 'b28a9aea-bb56-4812-acc7e2418442-2c9d-4e0d', // Library-specific API key
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ GET Success:', getResponse.data);
        
        // Test 2: Create video
        console.log('\n🎬 Testing video creation...');
        const postResponse = await axios.post('https://video.bunnycdn.com/library/301922/videos', {
            title: 'Test Video Creation Direct'
        }, {
            headers: {
                'AccessKey': 'b28a9aea-bb56-4812-acc7e2418442-2c9d-4e0d', // Library-specific API key
                'Content-Type': 'application/json'
            }
        });
        console.log('✅ POST Success:', postResponse.data);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
        console.error('Headers sent:', error.config?.headers);
    }
}

testApiKey();
