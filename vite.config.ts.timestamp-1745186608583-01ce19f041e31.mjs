// vite.config.ts
import path from "path";
import { defineConfig } from "file:///D:/ezz/Elkheta/2/node_modules/vite/dist/node/index.js";
import react from "file:///D:/ezz/Elkheta/2/node_modules/@vitejs/plugin-react-swc/index.mjs";
import { tempo } from "file:///D:/ezz/Elkheta/2/node_modules/tempo-devtools/dist/vite/index.js";
var __vite_injected_original_dirname = "D:\\ezz\\Elkheta\\2";
var conditionalPlugins = [];
if (process.env.TEMPO === "true") {
  conditionalPlugins.push(["tempo-devtools/swc", {}]);
}
var vite_config_default = defineConfig({
  base: process.env.NODE_ENV === "development" ? "/" : process.env.VITE_BASE_PATH || "/",
  optimizeDeps: {
    entries: ["src/main.tsx", "src/tempobook/**/*"]
  },
  plugins: [
    react({
      plugins: conditionalPlugins
    }),
    tempo()
  ],
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    host: "0.0.0.0",
    // Listen on all network interfaces
    cors: true,
    // Enable CORS for all origins
    strictPort: true,
    // Don't try another port if 8000 is in use
    headers: {
      "Access-Control-Allow-Origin": "*",
      // Allow all origins (adjust as needed)
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, AccessKey, Authorization, Content-Length, Accept"
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3004",
        // Use explicit IP instead of localhost
        changeOrigin: true,
        secure: false,
        ws: true,
        // Support WebSockets if needed
        rewrite: (path2) => path2,
        timeout: 18e4,
        // 3 minute timeout for uploads
        configure: (proxy, _options) => {
          proxy.on("error", (err, req, res) => {
            console.error("Proxy error details:", {
              error: err.message,
              code: err.code || "UNKNOWN_ERROR",
              path: req.url,
              method: req.method,
              headers: req.headers ? Object.keys(req.headers).join(", ") : "No headers",
              body: req.body ? JSON.stringify(req.body).substring(0, 200) : "No body"
            });
            if (!res.headersSent) {
              res.writeHead(502, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                error: "Proxy Error",
                message: `Failed to communicate with backend server: ${err.message}`,
                code: err.code || "UNKNOWN_ERROR"
              }));
            }
          });
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log(`[Vite Proxy] ${req.method} ${req.url} \u2192 ${proxyReq.path}`);
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            const logInfo = {
              status: proxyRes.statusCode ?? 0,
              // Add null coalescing operator to provide a default value
              statusMessage: proxyRes.statusMessage ?? "Unknown Status",
              headers: {
                contentType: proxyRes.headers["content-type"],
                contentLength: proxyRes.headers["content-length"]
              }
            };
            if (proxyRes.statusCode !== void 0 && proxyRes.statusCode >= 400) {
              let responseBody = "";
              proxyRes.on("data", (chunk) => {
                responseBody += chunk;
              });
              proxyRes.on("end", () => {
                console.error(`Proxy error response: ${req.url} -> ${proxyRes.statusCode ?? "Unknown Status"}`, {
                  ...logInfo,
                  responseBody: responseBody.substring(0, 500)
                });
              });
            } else {
              console.log(`Proxy response: ${req.url} -> ${proxyRes.statusCode ?? "Unknown Status"}`, logInfo);
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            const reqBody = req.body ? typeof req.body === "object" ? JSON.stringify(req.body).substring(0, 100) + "..." : "[Binary data]" : "No body";
            console.log(`Proxy request: ${req.method} ${req.url} -> http://127.0.0.1:3004${req.url}`, {
              contentType: req.headers["content-type"],
              contentLength: req.headers["content-length"],
              body: reqBody
            });
            if ((req.method === "POST" || req.method === "PUT") && req.body) {
              if (!proxyReq.getHeader("Content-Type")) {
                proxyReq.setHeader("Content-Type", "application/json");
              }
              if (!proxyReq.getHeader("Accept")) {
                proxyReq.setHeader("Accept", "application/json");
              }
            }
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            const logInfo = {
              status: proxyRes.statusCode ?? 0,
              // Add null coalescing operator to provide a default value
              statusMessage: proxyRes.statusMessage ?? "Unknown Status",
              headers: {
                contentType: proxyRes.headers["content-type"],
                contentLength: proxyRes.headers["content-length"]
              }
            };
            if (proxyRes.statusCode !== void 0 && proxyRes.statusCode >= 400) {
              let responseBody = "";
              proxyRes.on("data", (chunk) => {
                responseBody += chunk;
              });
              proxyRes.on("end", () => {
                console.error(`Proxy error response: ${req.url} -> ${proxyRes.statusCode ?? "Unknown Status"}`, {
                  ...logInfo,
                  responseBody: responseBody.substring(0, 500)
                });
              });
            } else {
              console.log(`Proxy response: ${req.url} -> ${proxyRes.statusCode ?? "Unknown Status"}`, logInfo);
            }
          });
        }
      }
    },
    watch: {
      usePolling: true
      // Enable polling as a fallback
    },
    port: 8e3
  },
  build: {
    outDir: "dist",
    assetsDir: "assets"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxlenpcXFxcRWxraGV0YVxcXFwyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxlenpcXFxcRWxraGV0YVxcXFwyXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9lenovRWxraGV0YS8yL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHsgdGVtcG8gfSBmcm9tIFwidGVtcG8tZGV2dG9vbHMvZGlzdC92aXRlXCI7XG5pbXBvcnQgdHlwZSB7IEluY29taW5nTWVzc2FnZSB9IGZyb20gJ2h0dHAnO1xuaW1wb3J0IHR5cGUgeyBTZXJ2ZXJSZXNwb25zZSB9IGZyb20gJ2h0dHAnO1xuXG4vLyBDdXN0b20gaW50ZXJmYWNlIHRvIGV4dGVuZCBFcnJvciB3aXRoIG5ldHdvcmsgZXJyb3IgcHJvcGVydGllc1xuaW50ZXJmYWNlIE5ldHdvcmtFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29kZT86IHN0cmluZztcbiAgc3lzY2FsbD86IHN0cmluZztcbiAgYWRkcmVzcz86IHN0cmluZztcbiAgcG9ydD86IG51bWJlcjtcbn1cblxuLy8gQ3VzdG9tIGludGVyZmFjZSB0byBleHRlbmQgSW5jb21pbmdNZXNzYWdlIHdpdGggYm9keSBwcm9wZXJ0eVxuaW50ZXJmYWNlIEV4dGVuZGVkSW5jb21pbmdNZXNzYWdlIGV4dGVuZHMgSW5jb21pbmdNZXNzYWdlIHtcbiAgYm9keT86IGFueTtcbn1cblxuY29uc3QgY29uZGl0aW9uYWxQbHVnaW5zOiBbc3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+XVtdID0gW107XG5cbi8vIEB0cy1pZ25vcmVcbmlmIChwcm9jZXNzLmVudi5URU1QTyA9PT0gXCJ0cnVlXCIpIHtcbiAgY29uZGl0aW9uYWxQbHVnaW5zLnB1c2goW1widGVtcG8tZGV2dG9vbHMvc3djXCIsIHt9XSk7XG59XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBiYXNlOlxuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSBcImRldmVsb3BtZW50XCJcbiAgICAgID8gXCIvXCJcbiAgICAgIDogcHJvY2Vzcy5lbnYuVklURV9CQVNFX1BBVEggfHwgXCIvXCIsXG4gIG9wdGltaXplRGVwczoge1xuICAgIGVudHJpZXM6IFtcInNyYy9tYWluLnRzeFwiLCBcInNyYy90ZW1wb2Jvb2svKiovKlwiXSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KHtcbiAgICAgIHBsdWdpbnM6IGNvbmRpdGlvbmFsUGx1Z2lucyxcbiAgICB9KSxcbiAgICB0ZW1wbygpLFxuICBdLFxuICByZXNvbHZlOiB7XG4gICAgcHJlc2VydmVTeW1saW5rczogdHJ1ZSxcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCIwLjAuMC4wXCIsIC8vIExpc3RlbiBvbiBhbGwgbmV0d29yayBpbnRlcmZhY2VzXG4gICAgY29yczogdHJ1ZSwgLy8gRW5hYmxlIENPUlMgZm9yIGFsbCBvcmlnaW5zXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSwgLy8gRG9uJ3QgdHJ5IGFub3RoZXIgcG9ydCBpZiA4MDAwIGlzIGluIHVzZVxuICAgIGhlYWRlcnM6IHtcbiAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luXCI6IFwiKlwiLCAvLyBBbGxvdyBhbGwgb3JpZ2lucyAoYWRqdXN0IGFzIG5lZWRlZClcbiAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kc1wiOiBcIkdFVCwgUE9TVCwgUFVULCBERUxFVEUsIE9QVElPTlNcIixcbiAgICAgIFwiQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVyc1wiOiBcIkNvbnRlbnQtVHlwZSwgQWNjZXNzS2V5LCBBdXRob3JpemF0aW9uLCBDb250ZW50LUxlbmd0aCwgQWNjZXB0XCIsXG4gICAgfSxcbiAgICBwcm94eToge1xuICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6MzAwMFwiLCAvLyBVc2UgZXhwbGljaXQgSVAgaW5zdGVhZCBvZiBsb2NhbGhvc3RcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB3czogdHJ1ZSwgLy8gU3VwcG9ydCBXZWJTb2NrZXRzIGlmIG5lZWRlZFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aCxcbiAgICAgICAgdGltZW91dDogMTgwMDAwLCAvLyAzIG1pbnV0ZSB0aW1lb3V0IGZvciB1cGxvYWRzXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBfb3B0aW9ucykgPT4ge1xuICAgICAgICAgIC8vIEVuaGFuY2VkIGVycm9yIGhhbmRsaW5nIHdpdGggbW9yZSBkZXRhaWxlZCBsb2dnaW5nXG4gICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVycjogTmV0d29ya0Vycm9yLCByZXE6IEV4dGVuZGVkSW5jb21pbmdNZXNzYWdlLCByZXM6IFNlcnZlclJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdQcm94eSBlcnJvciBkZXRhaWxzOicsIHtcbiAgICAgICAgICAgICAgZXJyb3I6IGVyci5tZXNzYWdlLFxuICAgICAgICAgICAgICBjb2RlOiBlcnIuY29kZSB8fCAnVU5LTk9XTl9FUlJPUicsXG4gICAgICAgICAgICAgIHBhdGg6IHJlcS51cmwsXG4gICAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcbiAgICAgICAgICAgICAgaGVhZGVyczogcmVxLmhlYWRlcnMgPyBPYmplY3Qua2V5cyhyZXEuaGVhZGVycykuam9pbignLCAnKSA6ICdObyBoZWFkZXJzJyxcbiAgICAgICAgICAgICAgYm9keTogcmVxLmJvZHkgPyBKU09OLnN0cmluZ2lmeShyZXEuYm9keSkuc3Vic3RyaW5nKDAsIDIwMCkgOiAnTm8gYm9keSdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBSZXR1cm4gYSBwcm9wZXIgZXJyb3IgcmVzcG9uc2UgdG8gdGhlIGNsaWVudFxuICAgICAgICAgICAgaWYgKCFyZXMuaGVhZGVyc1NlbnQpIHtcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDIsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgICAgIGVycm9yOiAnUHJveHkgRXJyb3InLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRmFpbGVkIHRvIGNvbW11bmljYXRlIHdpdGggYmFja2VuZCBzZXJ2ZXI6ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICAgICAgICBjb2RlOiBlcnIuY29kZSB8fCAnVU5LTk9XTl9FUlJPUidcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gQWRkIGFkZGl0aW9uYWwgbG9nZ2luZyBmb3IgcHJveHkgcmVxdWVzdHNcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW1ZpdGUgUHJveHldICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfSBcdTIxOTIgJHtwcm94eVJlcS5wYXRofWApO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgLy8gQWRkIGxvZ2dpbmcgZm9yIHByb3h5IHJlc3BvbnNlc1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcycsIChwcm94eVJlcywgcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIC8vIE1vcmUgZGV0YWlsZWQgcmVzcG9uc2UgbG9nZ2luZ1xuICAgICAgICAgICAgY29uc3QgbG9nSW5mbyA9IHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBwcm94eVJlcy5zdGF0dXNDb2RlID8/IDAsIC8vIEFkZCBudWxsIGNvYWxlc2Npbmcgb3BlcmF0b3IgdG8gcHJvdmlkZSBhIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgICAgICAgc3RhdHVzTWVzc2FnZTogcHJveHlSZXMuc3RhdHVzTWVzc2FnZSA/PyAnVW5rbm93biBTdGF0dXMnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgY29udGVudFR5cGU6IHByb3h5UmVzLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddLFxuICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGg6IHByb3h5UmVzLmhlYWRlcnNbJ2NvbnRlbnQtbGVuZ3RoJ11cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHByb3h5UmVzLnN0YXR1c0NvZGUgIT09IHVuZGVmaW5lZCAmJiBwcm94eVJlcy5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgICAgICAgICAvLyBGb3IgZXJyb3IgcmVzcG9uc2VzLCBjb2xsZWN0IGFuZCBsb2cgdGhlIHJlc3BvbnNlIGJvZHlcbiAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlQm9keSA9ICcnO1xuICAgICAgICAgICAgICBwcm94eVJlcy5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQm9keSArPSBjaHVuaztcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBwcm94eVJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFByb3h5IGVycm9yIHJlc3BvbnNlOiAke3JlcS51cmx9IC0+ICR7cHJveHlSZXMuc3RhdHVzQ29kZSA/PyAnVW5rbm93biBTdGF0dXMnfWAsIHtcbiAgICAgICAgICAgICAgICAgIC4uLmxvZ0luZm8sXG4gICAgICAgICAgICAgICAgICByZXNwb25zZUJvZHk6IHJlc3BvbnNlQm9keS5zdWJzdHJpbmcoMCwgNTAwKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQcm94eSByZXNwb25zZTogJHtyZXEudXJsfSAtPiAke3Byb3h5UmVzLnN0YXR1c0NvZGUgPz8gJ1Vua25vd24gU3RhdHVzJ31gLCBsb2dJbmZvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxOiBFeHRlbmRlZEluY29taW5nTWVzc2FnZSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgLy8gTW9yZSBkZXRhaWxlZCByZXF1ZXN0IGxvZ2dpbmdcbiAgICAgICAgICAgIGNvbnN0IHJlcUJvZHkgPSByZXEuYm9keSA/IFxuICAgICAgICAgICAgICAodHlwZW9mIHJlcS5ib2R5ID09PSAnb2JqZWN0JyA/IEpTT04uc3RyaW5naWZ5KHJlcS5ib2R5KS5zdWJzdHJpbmcoMCwgMTAwKSArICcuLi4nIDogJ1tCaW5hcnkgZGF0YV0nKSA6IFxuICAgICAgICAgICAgICAnTm8gYm9keSc7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc29sZS5sb2coYFByb3h5IHJlcXVlc3Q6ICR7cmVxLm1ldGhvZH0gJHtyZXEudXJsfSAtPiBodHRwOi8vMTI3LjAuMC4xOjMwMDAke3JlcS51cmx9YCwge1xuICAgICAgICAgICAgICBjb250ZW50VHlwZTogcmVxLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddLFxuICAgICAgICAgICAgICBjb250ZW50TGVuZ3RoOiByZXEuaGVhZGVyc1snY29udGVudC1sZW5ndGgnXSxcbiAgICAgICAgICAgICAgYm9keTogcmVxQm9keVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEVuc3VyZSBwcm9wZXIgaGVhZGVycyBhcmUgc2V0IGZvciBKU09OIGNvbnRlbnRcbiAgICAgICAgICAgIGlmICgocmVxLm1ldGhvZCA9PT0gJ1BPU1QnIHx8IHJlcS5tZXRob2QgPT09ICdQVVQnKSAmJiByZXEuYm9keSkge1xuICAgICAgICAgICAgICBpZiAoIXByb3h5UmVxLmdldEhlYWRlcignQ29udGVudC1UeXBlJykpIHtcbiAgICAgICAgICAgICAgICBwcm94eVJlcS5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLy8gQWRkIG1pc3NpbmcgaGVhZGVycyB0aGF0IG1pZ2h0IGJlIHJlcXVpcmVkIGJ5IHRoZSBzZXJ2ZXJcbiAgICAgICAgICAgICAgaWYgKCFwcm94eVJlcS5nZXRIZWFkZXIoJ0FjY2VwdCcpKSB7XG4gICAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgXG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIC8vIE1vcmUgZGV0YWlsZWQgcmVzcG9uc2UgbG9nZ2luZ1xuICAgICAgICAgICAgY29uc3QgbG9nSW5mbyA9IHtcbiAgICAgICAgICAgICAgc3RhdHVzOiBwcm94eVJlcy5zdGF0dXNDb2RlID8/IDAsIC8vIEFkZCBudWxsIGNvYWxlc2Npbmcgb3BlcmF0b3IgdG8gcHJvdmlkZSBhIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgICAgICAgc3RhdHVzTWVzc2FnZTogcHJveHlSZXMuc3RhdHVzTWVzc2FnZSA/PyAnVW5rbm93biBTdGF0dXMnLFxuICAgICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgY29udGVudFR5cGU6IHByb3h5UmVzLmhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddLFxuICAgICAgICAgICAgICAgIGNvbnRlbnRMZW5ndGg6IHByb3h5UmVzLmhlYWRlcnNbJ2NvbnRlbnQtbGVuZ3RoJ11cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKHByb3h5UmVzLnN0YXR1c0NvZGUgIT09IHVuZGVmaW5lZCAmJiBwcm94eVJlcy5zdGF0dXNDb2RlID49IDQwMCkge1xuICAgICAgICAgICAgICAvLyBGb3IgZXJyb3IgcmVzcG9uc2VzLCBjb2xsZWN0IGFuZCBsb2cgdGhlIHJlc3BvbnNlIGJvZHlcbiAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlQm9keSA9ICcnO1xuICAgICAgICAgICAgICBwcm94eVJlcy5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgICAgIHJlc3BvbnNlQm9keSArPSBjaHVuaztcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBwcm94eVJlcy5vbignZW5kJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFByb3h5IGVycm9yIHJlc3BvbnNlOiAke3JlcS51cmx9IC0+ICR7cHJveHlSZXMuc3RhdHVzQ29kZSA/PyAnVW5rbm93biBTdGF0dXMnfWAsIHtcbiAgICAgICAgICAgICAgICAgIC4uLmxvZ0luZm8sXG4gICAgICAgICAgICAgICAgICByZXNwb25zZUJvZHk6IHJlc3BvbnNlQm9keS5zdWJzdHJpbmcoMCwgNTAwKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQcm94eSByZXNwb25zZTogJHtyZXEudXJsfSAtPiAke3Byb3h5UmVzLnN0YXR1c0NvZGUgPz8gJ1Vua25vd24gU3RhdHVzJ31gLCBsb2dJbmZvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgdXNlUG9sbGluZzogdHJ1ZSwgLy8gRW5hYmxlIHBvbGxpbmcgYXMgYSBmYWxsYmFja1xuICAgIH0sXG4gICAgcG9ydDogODAwMCxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBME8sT0FBTyxVQUFVO0FBQzNQLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sV0FBVztBQUNsQixTQUFTLGFBQWE7QUFIdEIsSUFBTSxtQ0FBbUM7QUFvQnpDLElBQU0scUJBQXNELENBQUM7QUFHN0QsSUFBSSxRQUFRLElBQUksVUFBVSxRQUFRO0FBQ2hDLHFCQUFtQixLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO0FBQ3BEO0FBR0EsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFDRSxRQUFRLElBQUksYUFBYSxnQkFDckIsTUFDQSxRQUFRLElBQUksa0JBQWtCO0FBQUEsRUFDcEMsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGdCQUFnQixvQkFBb0I7QUFBQSxFQUNoRDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLE1BQ0osU0FBUztBQUFBLElBQ1gsQ0FBQztBQUFBLElBQ0QsTUFBTTtBQUFBLEVB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
