import React, { useState, useEffect } from 'react';
import { Button, Box, Typography, CircularProgress, Card, Alert, AlertTitle } from '@mui/material';
import { NetworkCheck, WifiOff, CheckCircle, ErrorOutline } from '@mui/icons-material';
import { bunnyService } from '../lib/bunny-service';

interface ConnectionTestResult {
  endpoint: string;
  success: boolean;
  latency: number;
  error?: string;
}

interface ConnectionStatusTestProps {
  onComplete?: (results: ConnectionTestResult[]) => void;
  autoStart?: boolean;
  compact?: boolean;
}

export const ConnectionStatusTest: React.FC<ConnectionStatusTestProps> = ({
  onComplete,
  autoStart = false,
  compact = false
}) => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<ConnectionTestResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'success' | 'warning' | 'error' | 'pending'>('pending');
  const [progress, setProgress] = useState(0);

  const testConnection = async () => {
    setTesting(true);
    setProgress(0);
    setResults([]);
    
    const endpoints = [
      { name: 'API Proxy Health', path: '/api/proxy/health' },
      { name: 'Bunny API', path: '/api/proxy/video' },
      { name: 'Video Library', path: '/api/proxy/video/library' }
    ];
    
    const testResults: ConnectionTestResult[] = [];
    
    for (let i = 0; i < endpoints.length; i++) {
      setProgress(Math.round((i / endpoints.length) * 100));
      
      try {
        const startTime = performance.now();
        const response = await fetch(endpoints[i].path, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const endTime = performance.now();
        
        testResults.push({
          endpoint: endpoints[i].name,
          success: response.ok,
          latency: Math.round(endTime - startTime)
        });
      } catch (error) {
        testResults.push({
          endpoint: endpoints[i].name,
          success: false,
          latency: 0,
          error: error.message
        });
      }
    }

    // If library API is available, also test connection validation via upload service
    try {
      const { isConnected, latency } = await bunnyService.uploadService.validateConnection();
      
      testResults.push({
        endpoint: 'Connection Validation',
        success: isConnected,
        latency: latency
      });
    } catch (error) {
      testResults.push({
        endpoint: 'Connection Validation',
        success: false,
        latency: 0,
        error: error.message
      });
    }
    
    setProgress(100);
    setTesting(false);
    setResults(testResults);
    
    // Determine overall status
    const allSuccessful = testResults.every(result => result.success);
    const anySuccessful = testResults.some(result => result.success);
    
    if (allSuccessful) {
      setOverallStatus('success');
    } else if (anySuccessful) {
      setOverallStatus('warning');
    } else {
      setOverallStatus('error');
    }
    
    if (onComplete) {
      onComplete(testResults);
    }
  };
  
  // Auto-start if specified
  useEffect(() => {
    if (autoStart) {
      testConnection();
    }
  }, [autoStart]);
  
  // Helper to get status icon
  const getStatusIcon = (status: 'success' | 'warning' | 'error' | 'pending') => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <ErrorOutline color="warning" />;
      case 'error':
        return <WifiOff color="error" />;
      case 'pending':
      default:
        return <NetworkCheck color="action" />;
    }
  };

  if (compact) {
    // Compact version for embedding in other components
    return (
      <Box sx={{ mb: 2 }}>
        {testing ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress
              variant="determinate"
              value={progress}
              size={24}
              thickness={4}
              sx={{ mr: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Testing connection...
            </Typography>
          </Box>
        ) : results.length > 0 ? (
          <Alert 
            severity={overallStatus === 'success' ? 'success' : overallStatus === 'warning' ? 'warning' : 'error'}
            icon={getStatusIcon(overallStatus)}
          >
            <AlertTitle>
              {overallStatus === 'success' 
                ? 'All connections successful' 
                : overallStatus === 'warning' 
                  ? 'Partial connection issues' 
                  : 'Connection failed'}
            </AlertTitle>
            {results.map((result, index) => (
              <Typography key={index} variant="body2" sx={{ fontSize: '0.8rem' }}>
                {result.endpoint}: {result.success 
                  ? `✅ Connected (${result.latency}ms)` 
                  : `❌ Failed ${result.error ? `(${result.error})` : ''}`}
              </Typography>
            ))}
            <Button 
              variant="outlined" 
              size="small" 
              onClick={testConnection}
              startIcon={<NetworkCheck />}
              sx={{ mt: 1 }}
            >
              Test Again
            </Button>
          </Alert>
        ) : (
          <Button 
            variant="outlined" 
            size="small" 
            onClick={testConnection}
            startIcon={<NetworkCheck />}
          >
            Test API Connection
          </Button>
        )}
      </Box>
    );
  }

  // Full version
  return (
    <Card sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        Connection Status Test
      </Typography>
      
      {testing ? (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress
            variant="determinate"
            value={progress}
            size={24}
            thickness={4}
            sx={{ mr: 2 }}
          />
          <Typography>Testing connection to API servers...</Typography>
        </Box>
      ) : (
        <Box sx={{ mb: 2 }}>
          {results.length > 0 && (
            <Alert 
              severity={overallStatus === 'success' ? 'success' : overallStatus === 'warning' ? 'warning' : 'error'}
              sx={{ mb: 2 }}
            >
              <AlertTitle>
                {overallStatus === 'success' 
                  ? 'All connections successful' 
                  : overallStatus === 'warning' 
                    ? 'Partial connection issues detected' 
                    : 'Connection failed'}
              </AlertTitle>
              <Typography variant="body2">
                {overallStatus === 'success' 
                  ? 'Your connection to all API servers is working correctly.' 
                  : overallStatus === 'warning' 
                    ? 'Some API endpoints are not responding. Uploads may be unreliable.' 
                    : 'Unable to connect to API servers. Check your network connection.'}
              </Typography>
            </Alert>
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={testConnection}
            startIcon={<NetworkCheck />}
            disabled={testing}
          >
            {results.length > 0 ? 'Test Again' : 'Test Connection'}
          </Button>
        </Box>
      )}
      
      {results.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Test Results
          </Typography>
          
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 1,
            maxHeight: '200px',
            overflowY: 'auto',
            p: 1
          }}>
            {results.map((result, index) => (
              <Box 
                key={index} 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: 1,
                  bgcolor: result.success ? 'success.50' : 'error.50',
                  border: 1,
                  borderColor: result.success ? 'success.200' : 'error.200'
                }}
              >
                <Typography variant="body2">{result.endpoint}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {result.success ? (
                    <>
                      <CheckCircle fontSize="small" color="success" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="success.main">
                        {result.latency}ms
                      </Typography>
                    </>
                  ) : (
                    <>
                      <ErrorOutline fontSize="small" color="error" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="error.main">
                        Failed
                      </Typography>
                    </>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {overallStatus === 'success' 
                ? 'Your connection is stable and ready for uploads.'
                : overallStatus === 'warning'
                  ? 'Some connection issues detected. You may experience intermittent upload failures.'
                  : 'Connection problems detected. Uploads will likely fail until connection is restored.'}
            </Typography>
            {overallStatus !== 'success' && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Suggestions:
                <ul>
                  <li>Check your network connection and firewall settings</li>
                  <li>Try using a different network if available</li>
                  <li>In Advanced Upload Settings, enable "API Proxy Fallback" and increase retry attempts</li>
                </ul>
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Card>
  );
}; 