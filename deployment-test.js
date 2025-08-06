/**
 * Test script for verifying Vercel deployment
 * Run this after deployment to ensure all endpoints work
 */

const BASE_URL = 'https://your-vercel-app-url.vercel.app'; // Update with actual URL

// Library 301922 API key (from lib data.txt)
const LIBRARY_API_KEY = 'b28a9aea-bb56-4812-acc7e2418442-2c9d-4e0d';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'AccessKey': LIBRARY_API_KEY,
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    console.log(`✅ Status: ${response.status}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2).substring(0, 300));
    
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runDeploymentTests() {
  console.log('🚀 Vercel Deployment Test Suite');
  console.log('================================\n');
  
  const tests = [
    {
      name: 'System Diagnostics',
      url: `${BASE_URL}/api/diagnostics`,
      method: 'GET'
    },
    {
      name: 'Authentication Check',
      url: `${BASE_URL}/api/auth-check`,
      method: 'GET'
    },
    {
      name: 'Video Libraries',
      url: `${BASE_URL}/api/proxy/base/videolibrary`,
      method: 'GET'
    },
    {
      name: 'Library Collections',
      url: `${BASE_URL}/api/proxy/video/library/301922/collections`,
      method: 'GET'
    },
    {
      name: 'Video Creation',
      url: `${BASE_URL}/api/proxy/create-video`,
      method: 'POST',
      body: JSON.stringify({
        libraryId: '301922',
        title: `Deployment Test ${new Date().toISOString()}`,
        accessToken: LIBRARY_API_KEY
      })
    },
    {
      name: 'Sheet Update Test',
      url: `${BASE_URL}/api/update-sheet`,
      method: 'POST',
      body: JSON.stringify({
        testMode: true,
        videoData: {
          guid: 'test-guid',
          title: 'Test Video',
          status: 'completed'
        }
      })
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, {
      method: test.method,
      body: test.body,
      headers: test.headers || {}
    });
    
    results.push({ ...test, ...result });
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.status || 'Error'}`);
  });
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! Deployment is successful.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the errors above.');
  }
}

// Instructions for use
console.log(`
📋 Deployment Test Instructions:
1. Update BASE_URL with your actual Vercel app URL
2. Ensure VITE_BUNNY_API_KEY is set in Vercel environment variables
3. Run: node deployment-test.js
4. Check that all endpoints return successful responses

🔑 API Key Info:
- Main API key: Set in Vercel environment as VITE_BUNNY_API_KEY
- Library 301922 key: ${LIBRARY_API_KEY}
- Use library-specific keys for video operations
`);

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runDeploymentTests, testEndpoint };
}

// Run tests if called directly
if (typeof window === 'undefined' && require.main === module) {
  runDeploymentTests();
}
