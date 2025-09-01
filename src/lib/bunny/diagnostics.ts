/**
 * Diagnostics utility for Bunny.net API connectivity
 */

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export class BunnyDiagnostics {
  
  static async runAllTests(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    
    console.log('🔍 Running Bunny.net API diagnostics...');
    
    // Test 1: Environment variables
    results.push(this.testEnvironmentVariables());
    
    // Test 2: API key format
    results.push(this.testApiKeyFormat());
    
    // Test 3: Network connectivity
    results.push(await this.testNetworkConnectivity());
    
    // Test 4: API authentication
    results.push(await this.testApiAuthentication());
    
    // Test 5: Proxy endpoints
    results.push(await this.testProxyEndpoints());
    
    this.logResults(results);
    return results;
  }
  
  private static testEnvironmentVariables(): DiagnosticResult {
    const envApiKey = import.meta.env.VITE_BUNNY_API_KEY || 
                      process.env.VITE_BUNNY_API_KEY ||
                      (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY);
    
    if (!envApiKey) {
      return {
        test: 'Environment Variables',
        status: 'fail',
        message: 'VITE_BUNNY_API_KEY is not set',
        details: {
          hasImportMeta: !!import.meta.env.VITE_BUNNY_API_KEY,
          hasProcess: !!(typeof process !== 'undefined' && process.env?.VITE_BUNNY_API_KEY),
          hasWindow: !!(typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY)
        }
      };
    }
    
    return {
      test: 'Environment Variables',
      status: 'pass',
      message: `API key found (${envApiKey.length} characters)`,
      details: {
        keyLength: envApiKey.length,
        keyPreview: envApiKey.substring(0, 8) + '...'
      }
    };
  }
  
  private static testApiKeyFormat(): DiagnosticResult {
    const envApiKey = import.meta.env.VITE_BUNNY_API_KEY || 
                      process.env.VITE_BUNNY_API_KEY ||
                      (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY);
    
    if (!envApiKey) {
      return {
        test: 'API Key Format',
        status: 'fail',
        message: 'No API key to validate'
      };
    }
    
    // Bunny.net API keys are typically 32-40 characters long
    const isValidLength = envApiKey.length >= 20 && envApiKey.length <= 50;
    const hasValidChars = /^[a-zA-Z0-9\-]+$/.test(envApiKey);
    
    if (!isValidLength || !hasValidChars) {
      return {
        test: 'API Key Format',
        status: 'warning',
        message: 'API key format may be invalid',
        details: {
          length: envApiKey.length,
          hasValidChars,
          expectedLength: '20-50 characters',
          expectedChars: 'alphanumeric and hyphens only'
        }
      };
    }
    
    return {
      test: 'API Key Format',
      status: 'pass',
      message: 'API key format appears valid'
    };
  }
  
  private static async testNetworkConnectivity(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('https://api.bunny.net', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      return {
        test: 'Network Connectivity',
        status: 'pass',
        message: 'Can reach Bunny.net API',
        details: {
          status: response.status,
          statusText: response.statusText
        }
      };
    } catch (error) {
      return {
        test: 'Network Connectivity',
        status: 'fail',
        message: 'Cannot reach Bunny.net API',
        details: {
          error: error.message,
          type: error.name
        }
      };
    }
  }
  
  private static async testApiAuthentication(): Promise<DiagnosticResult> {
    const envApiKey = import.meta.env.VITE_BUNNY_API_KEY || 
                      process.env.VITE_BUNNY_API_KEY ||
                      (typeof window !== 'undefined' && (window as any).__env?.VITE_BUNNY_API_KEY);
    
    if (!envApiKey) {
      return {
        test: 'API Authentication',
        status: 'fail',
        message: 'No API key available for testing'
      };
    }
    
    try {
      const response = await fetch('https://api.bunny.net/videolibrary?page=1&perPage=1', {
        method: 'GET',
        headers: {
          'AccessKey': envApiKey,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.status === 401) {
        return {
          test: 'API Authentication',
          status: 'fail',
          message: 'API key is invalid or expired',
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      }
      
      if (response.ok) {
        const data = await response.json();
        return {
          test: 'API Authentication',
          status: 'pass',
          message: 'API key is valid',
          details: {
            status: response.status,
            librariesFound: data.items?.length || 0
          }
        };
      }
      
      return {
        test: 'API Authentication',
        status: 'warning',
        message: `Unexpected response: ${response.status}`,
        details: {
          status: response.status,
          statusText: response.statusText
        }
      };
      
    } catch (error) {
      return {
        test: 'API Authentication',
        status: 'fail',
        message: 'Failed to test authentication',
        details: {
          error: error.message,
          type: error.name
        }
      };
    }
  }
  
  private static async testProxyEndpoints(): Promise<DiagnosticResult> {
    try {
      const response = await fetch('/api/auth-check', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          test: 'Proxy Endpoints',
          status: 'pass',
          message: 'Proxy endpoints are accessible',
          details: data
        };
      }
      
      return {
        test: 'Proxy Endpoints',
        status: 'warning',
        message: `Proxy returned status ${response.status}`,
        details: {
          status: response.status,
          statusText: response.statusText
        }
      };
      
    } catch (error) {
      return {
        test: 'Proxy Endpoints',
        status: 'fail',
        message: 'Cannot reach proxy endpoints',
        details: {
          error: error.message,
          type: error.name
        }
      };
    }
  }
  
  private static logResults(results: DiagnosticResult[]): void {
    console.group('🔍 Bunny.net Diagnostics Results');
    
    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.details) {
        console.log('   Details:', result.details);
      }
    });
    
    const failures = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const passes = results.filter(r => r.status === 'pass').length;
    
    console.log(`\n📊 Summary: ${passes} passed, ${warnings} warnings, ${failures} failed`);
    console.groupEnd();
  }
}

// Auto-run diagnostics in development mode
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  setTimeout(() => {
    BunnyDiagnostics.runAllTests();
  }, 2000);
}

export default BunnyDiagnostics;
