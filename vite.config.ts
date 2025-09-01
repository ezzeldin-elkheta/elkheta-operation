import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tempo } from "tempo-devtools/dist/vite";
import type { IncomingMessage } from 'http';
import type { ServerResponse } from 'http';

// Custom interface to extend Error with network error properties
interface NetworkError extends Error {
  code?: string;
  syscall?: string;
  address?: string;
  port?: number;
}

// Custom interface to extend IncomingMessage with body property
interface ExtendedIncomingMessage extends IncomingMessage {
  body?: any;
}

const conditionalPlugins: [string, Record<string, any>][] = [];

// @ts-ignore
if (process.env.TEMPO === "true") {
  conditionalPlugins.push(["tempo-devtools/swc", {}]);
}

// https://vitejs.dev/config/
export default defineConfig({
  base:
    process.env.NODE_ENV === "development"
      ? "/"
      : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"],
  },
  plugins: [
    react({
      plugins: conditionalPlugins,
    }),
    tempo(),
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    cors: true, // Enable CORS for all origins
    strictPort: true, // Don't try another port if 8000 is in use
    headers: {
      "Access-Control-Allow-Origin": "*", // Allow all origins (adjust as needed)
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, AccessKey, Authorization, Content-Length, Accept",
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3004", // Use explicit IP instead of localhost
        changeOrigin: true,
        secure: false,
        ws: true, // Support WebSockets if needed
        rewrite: (path) => path,
        timeout: 180000, // 3 minute timeout for uploads
        configure: (proxy, _options) => {
          // Enhanced error handling with more detailed logging
          proxy.on('error', (err: NetworkError, req: ExtendedIncomingMessage, res: ServerResponse) => {
            console.error('Proxy error details:', {
              error: err.message,
              code: err.code || 'UNKNOWN_ERROR',
              path: req.url,
              method: req.method,
              headers: req.headers ? Object.keys(req.headers).join(', ') : 'No headers',
              body: req.body ? JSON.stringify(req.body).substring(0, 200) : 'No body'
            });

            // Return a proper error response to the client
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                error: 'Proxy Error', 
                message: `Failed to communicate with backend server: ${err.message}`,
                code: err.code || 'UNKNOWN_ERROR'
              }));
            }
          });

          // Add additional logging for proxy requests
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[Vite Proxy] ${req.method} ${req.url} → ${proxyReq.path}`);
          });

          // Add logging for proxy responses
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // More detailed response logging
            const logInfo = {
              status: proxyRes.statusCode ?? 0, // Add null coalescing operator to provide a default value
              statusMessage: proxyRes.statusMessage ?? 'Unknown Status',
              headers: {
                contentType: proxyRes.headers['content-type'],
                contentLength: proxyRes.headers['content-length']
              }
            };
            
            if (proxyRes.statusCode !== undefined && proxyRes.statusCode >= 400) {
              // For error responses, collect and log the response body
              let responseBody = '';
              proxyRes.on('data', (chunk) => {
                responseBody += chunk;
              });
              
              proxyRes.on('end', () => {
                console.error(`Proxy error response: ${req.url} -> ${proxyRes.statusCode ?? 'Unknown Status'}`, {
                  ...logInfo,
                  responseBody: responseBody.substring(0, 500)
                });
              });
            } else {
              console.log(`Proxy response: ${req.url} -> ${proxyRes.statusCode ?? 'Unknown Status'}`, logInfo);
            }
          });

          proxy.on('proxyReq', (proxyReq, req: ExtendedIncomingMessage, _res) => {
            // More detailed request logging
            const reqBody = req.body ? 
              (typeof req.body === 'object' ? JSON.stringify(req.body).substring(0, 100) + '...' : '[Binary data]') : 
              'No body';
              
            console.log(`Proxy request: ${req.method} ${req.url} -> http://127.0.0.1:3004${req.url}`, {
              contentType: req.headers['content-type'],
              contentLength: req.headers['content-length'],
              body: reqBody
            });
            
            // Ensure proper headers are set for JSON content
            if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
              if (!proxyReq.getHeader('Content-Type')) {
                proxyReq.setHeader('Content-Type', 'application/json');
              }
              // Add missing headers that might be required by the server
              if (!proxyReq.getHeader('Accept')) {
                proxyReq.setHeader('Accept', 'application/json');
              }
            }
          });
          
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // More detailed response logging
            const logInfo = {
              status: proxyRes.statusCode ?? 0, // Add null coalescing operator to provide a default value
              statusMessage: proxyRes.statusMessage ?? 'Unknown Status',
              headers: {
                contentType: proxyRes.headers['content-type'],
                contentLength: proxyRes.headers['content-length']
              }
            };
            
            if (proxyRes.statusCode !== undefined && proxyRes.statusCode >= 400) {
              // For error responses, collect and log the response body
              let responseBody = '';
              proxyRes.on('data', (chunk) => {
                responseBody += chunk;
              });
              
              proxyRes.on('end', () => {
                console.error(`Proxy error response: ${req.url} -> ${proxyRes.statusCode ?? 'Unknown Status'}`, {
                  ...logInfo,
                  responseBody: responseBody.substring(0, 500)
                });
              });
            } else {
              console.log(`Proxy response: ${req.url} -> ${proxyRes.statusCode ?? 'Unknown Status'}`, logInfo);
            }
          });
        },
      },
    },
    watch: {
      usePolling: true, // Enable polling as a fallback
    },
    port: 5173,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  },
});
