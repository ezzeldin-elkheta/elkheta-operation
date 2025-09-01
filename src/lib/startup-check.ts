/**
 * Environment startup checker
 * Validates required environment variables on application startup
 */

function checkEnvironmentOnStartup() {
  console.group('🚀 Environment Startup Check');
  
  const requiredVars = [
    {
      name: 'VITE_BUNNY_API_KEY',
      value: import.meta.env.VITE_BUNNY_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_BUNNY_API_KEY : undefined),
      required: true,
      description: 'Bunny.net API key for video operations'
    }
  ];
  
  const optionalVars = [
    {
      name: 'GOOGLE_SHEETS_SPREADSHEET_ID',
      value: import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || (typeof process !== 'undefined' ? process.env.GOOGLE_SHEETS_SPREADSHEET_ID : undefined),
      required: false,
      description: 'Google Sheets integration'
    },
    {
      name: 'GOOGLE_SHEETS_CREDENTIALS_JSON',
      value: import.meta.env.VITE_GOOGLE_SHEETS_CREDENTIALS_JSON || (typeof process !== 'undefined' ? process.env.GOOGLE_SHEETS_CREDENTIALS_JSON : undefined),
      required: false,
      description: 'Google Sheets credentials'
    }
  ];
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('📋 Required Variables:');
  requiredVars.forEach(variable => {
    if (!variable.value) {
      console.error(`❌ ${variable.name}: MISSING (${variable.description})`);
      hasErrors = true;
    } else {
      const preview = variable.name.includes('KEY') || variable.name.includes('SECRET') || variable.name.includes('CREDENTIALS')
        ? `[SET - ${variable.value.length} chars]`
        : variable.value.substring(0, 20) + '...';
      console.log(`✅ ${variable.name}: ${preview}`);
    }
  });
  
  // Check optional variables
  console.log('\n📝 Optional Variables:');
  optionalVars.forEach(variable => {
    if (!variable.value) {
      console.warn(`⚠️ ${variable.name}: NOT SET (${variable.description})`);
      hasWarnings = true;
    } else {
      const preview = variable.name.includes('KEY') || variable.name.includes('SECRET') || variable.name.includes('CREDENTIALS')
        ? `[SET - ${variable.value.length} chars]`
        : variable.value.substring(0, 20) + '...';
      console.log(`✅ ${variable.name}: ${preview}`);
    }
  });
  
  // Summary
  console.log('\n📊 Summary:');
  if (hasErrors) {
    console.error('❌ CRITICAL: Missing required environment variables!');
    console.error('   Please check your .env file and restart the application.');
    console.error('   Required variables are needed for core functionality.');
  } else {
    console.log('✅ All required environment variables are set');
  }
  
  if (hasWarnings) {
    console.warn('⚠️ Some optional features may not work due to missing variables');
  }
  
  console.groupEnd();
  
  return { hasErrors, hasWarnings };
}

// Run the check when this module loads
const startupResult = checkEnvironmentOnStartup();

// Export for use in other modules
export { checkEnvironmentOnStartup, startupResult };

export default {
  checkEnvironmentOnStartup,
  startupResult
};
