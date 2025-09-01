/**
 * Test script to verify API fixes
 * 1. Test sheet update endpoint
 * 2. Test video creation with correct API key
 * 3. Test collection fetching
 */

const BASE_URL = 'https://014-dpjeywich-ezzeldinelkhateebs-projects.vercel.app';

async function testSheetUpdate() {
  console.log('\n🧪 Testing Sheet Update Endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/update-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videos: [{
          name: 'Test Video',
          embed_code: '<div>Test Embed Code</div>'
        }],
        sheetConfig: {
          spreadsheetId: '1Hm7noXxv8ITMU3dNXQmqFEzfZY1mZlBJ4bQ9_ZIR0-M',
          sheetName: 'OPERATIONS',
          nameColumn: 'M',
          embedColumn: 'Q',
          finalMinutesColumn: 'P'
        }
      })
    });
    
    console.log(`Sheet Update Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Sheet Update Success:', {
        success: data.success,
        updated: data.stats?.updated || 0,
        notFound: data.stats?.notFound || 0
      });
    } else {
      const error = await response.text();
      console.log('❌ Sheet Update Failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Sheet Update Error:', error.message);
  }
}

async function testVideoCreation() {
  console.log('\n🧪 Testing Video Creation...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/proxy/create-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        libraryId: '301922', // Library that should have specific API key
        title: 'API Test Video - ' + new Date().toISOString(),
        collectionId: 'ece9a919-bd04-4a70-a172-b296de3e8e41'
      })
    });
    
    console.log(`Video Creation Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Video Creation Success:', {
        guid: data.guid,
        title: data.title,
        status: data.status
      });
    } else {
      const error = await response.text();
      console.log('❌ Video Creation Failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Video Creation Error:', error.message);
  }
}

async function testCollectionFetch() {
  console.log('\n🧪 Testing Collection Fetch...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/proxy/video/library/301922/collections`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`Collection Fetch Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Collection Fetch Success:', {
        totalItems: data.totalItems,
        collectionsFound: data.items?.length || 0,
        firstCollection: data.items?.[0]?.name || 'none'
      });
    } else {
      const error = await response.text();
      console.log('❌ Collection Fetch Failed:', error);
    }
    
  } catch (error) {
    console.error('❌ Collection Fetch Error:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Running API Fix Verification Tests');
  console.log('=====================================');
  
  await testSheetUpdate();
  await testVideoCreation();
  await testCollectionFetch();
  
  console.log('\n📊 Test Summary Complete');
  console.log('========================');
  console.log('Check the results above to verify all endpoints are working correctly.');
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  window.runAPITests = runAllTests;
  console.log('API tests loaded. Run window.runAPITests() to start testing.');
} else {
  runAllTests();
}
