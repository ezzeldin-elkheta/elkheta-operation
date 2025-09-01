#!/usr/bin/env node

/**
 * Environment and API Key Diagnostic Tool
 * Use this to test your Bunny.net API key before deployment
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const API_KEY = process.env.VITE_BUNNY_API_KEY;

console.log('🔍 Environment and API Key Diagnostics');
console.log('=====================================');

// Check environment variables
console.log('\n1. Environment Variables:');
console.log(`   VITE_BUNNY_API_KEY: ${API_KEY ? `✅ Set (${API_KEY.length} chars)` : '❌ Not set'}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'Not set'}`);

if (!API_KEY) {
  console.log('\n❌ ERROR: VITE_BUNNY_API_KEY is not set!');
  console.log('   1. Create a .env file in your project root');
  console.log('   2. Add: VITE_BUNNY_API_KEY=your_actual_api_key');
  console.log('   3. Get your API key from https://panel.bunny.net');
  process.exit(1);
}

// Test API key format
console.log('\n2. API Key Format:');
if (API_KEY.length < 20) {
  console.log('   ⚠️  API key seems too short');
} else if (API_KEY.length > 100) {
  console.log('   ⚠️  API key seems too long');
} else {
  console.log('   ✅ API key length looks good');
}

// Test API connectivity
console.log('\n3. Testing API Connectivity:');
console.log('   Testing connection to Bunny.net...');

try {
  const response = await fetch('https://api.bunny.net/videolibrary', {
    headers: {
      'AccessKey': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Response status: ${response.status}`);
  
  if (response.status === 200) {
    const data = await response.json();
    console.log('   ✅ API key is valid!');
    console.log(`   📚 Found ${data.items?.length || 0} video libraries`);
    
    if (data.items?.length > 0) {
      console.log('\n4. Available Libraries:');
      data.items.slice(0, 3).forEach((lib, index) => {
        console.log(`   ${index + 1}. ${lib.name} (ID: ${lib.id})`);
      });
      if (data.items.length > 3) {
        console.log(`   ... and ${data.items.length - 3} more libraries`);
      }
    }
  } else if (response.status === 401) {
    console.log('   ❌ API key is invalid or expired');
    console.log('   💡 Get a new API key from https://panel.bunny.net');
  } else {
    const errorText = await response.text();
    console.log(`   ❌ Unexpected error: ${errorText}`);
  }
} catch (error) {
  console.log(`   ❌ Network error: ${error.message}`);
  console.log('   💡 Check your internet connection');
}

console.log('\n=====================================');
console.log('✨ Diagnostic complete!');

if (API_KEY) {
  console.log('\n📋 Next Steps:');
  console.log('   1. If API key is valid, set it in Vercel environment variables');
  console.log('   2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('   3. Add VITE_BUNNY_API_KEY with your API key value');
  console.log('   4. Redeploy your application');
}