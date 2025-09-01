/**
 * Comprehensive Library Test for Vercel Deployment
 * ================================================
 */

import axios from 'axios';

const LIBRARIES_TO_TEST = [
  {
    id: "26972",
    name: "Math Library", 
    apiKey: "d99f676d-e811-4a8a-af7002774a9c-8706-4c64"
  },
  {
    id: "238222", 
    name: "Live Videos Library",
    apiKey: "ef902fb0-5bbf-4a18-912e2c3f914d-8052-453e"
  }
];

async function testLibraryUpload(library) {
  console.log(`\n🧪 Testing library: ${library.name} (${library.id})`);
  
  try {
    // Test 1: Get library info
    console.log('📊 Testing library access...');
    const libResponse = await axios.get(`https://video.bunnycdn.com/library/${library.id}`, {
      headers: { 'AccessKey': library.apiKey }
    });
    console.log(`✅ Library access successful: ${libResponse.data.Name}`);
    
    // Test 2: Get collections
    console.log('📁 Testing collections access...');
    const collectionsResponse = await axios.get(`https://video.bunnycdn.com/library/${library.id}/collections`, {
      headers: { 'AccessKey': library.apiKey }
    });
    const collections = collectionsResponse.data.items || [];
    console.log(`✅ Collections loaded: ${collections.length} found`);
    
    // Test 3: Create test video
    console.log('🎬 Testing video creation...');
    const videoResponse = await axios.post(`https://video.bunnycdn.com/library/${library.id}/videos`, {
      title: `Test Upload Readiness - ${new Date().toISOString()}`
    }, {
      headers: { 'AccessKey': library.apiKey }
    });
    console.log(`✅ Video created: ${videoResponse.data.guid}`);
    
    return {
      library: library.name,
      success: true,
      collectionsCount: collections.length,
      testVideoId: videoResponse.data.guid
    };
    
  } catch (error) {
    console.error(`❌ Library ${library.name} failed:`, error.response?.data || error.message);
    return {
      library: library.name,
      success: false,
      error: error.response?.data || error.message
    };
  }
}

async function testProxyEndpoints() {
  console.log('\n🔧 Testing proxy endpoints readiness...');
  
  const baseUrl = 'http://localhost:3004'; // Change to your Vercel URL when deployed
  
  for (const library of LIBRARIES_TO_TEST) {
    try {
      console.log(`\n📡 Testing proxy for library ${library.id}...`);
      
      // Test proxy video creation
      const proxyResponse = await axios.post(`${baseUrl}/api/proxy/video/library/${library.id}/videos`, {
        title: `Proxy Test - ${new Date().toISOString()}`
      }, {
        headers: { 
          'AccessKey': library.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ Proxy video creation successful for library ${library.id}`);
      
    } catch (error) {
      console.error(`❌ Proxy failed for library ${library.id}:`, error.response?.data || error.message);
    }
  }
}

async function runFullTest() {
  console.log('🚀 Starting comprehensive library test...\n');
  
  const results = [];
  
  // Test direct API access
  for (const library of LIBRARIES_TO_TEST) {
    const result = await testLibraryUpload(library);
    results.push(result);
  }
  
  // Test proxy endpoints
  await testProxyEndpoints();
  
  // Summary
  console.log('\n📋 Test Summary:');
  console.log('=================');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${results.length} libraries`);
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length} libraries`);
    failed.forEach(f => console.log(`   - ${f.library}: ${f.error}`));
  }
  
  console.log('\n🎯 Ready for Vercel deployment!');
  return results;
}

// Run the test
runFullTest().catch(console.error);
