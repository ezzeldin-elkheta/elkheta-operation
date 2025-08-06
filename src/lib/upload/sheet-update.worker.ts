// Worker code must be self-contained and not use TypeScript-specific features
const workerBlob = new Blob([`
      // Improved             console.log(`[Worker] Sending request to: ${origin}/api/update-sheet`);
            const requestStartTime = Date.now();

            // data should now have a consistent structure from validateResponse
            const data = await fetchWithRetry(
              `${origin}/api/update-sheet`,handling utilities
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      // Add proper response validation with more context
      const validateResponse = async (response) => {
        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          throw new Error(\`Invalid JSON response from server: \${text}\`);
        }

        if (!response.ok) {
          // If response is not ok, use message from parsed data if available, else use status text
          const errorMessage = data?.message || response.statusText || \`HTTP error! status: \${response.status}\`;
          throw new Error(errorMessage);
        }
        
        // Ensure data has expected structure, even if success is false
        if (typeof data !== 'object' || data === null) {
          throw new Error(\`Invalid data structure received: \${text}\`);
        }

        // Add default values if properties are missing, especially for error cases
        data.success = data.success ?? false;
        data.message = data.message || (data.success ? 'Success' : 'Unknown error');
        data.results = data.results || []; // Ensure results is always an array

        if (!data.success) {
          // Add more context to error messages or handle specific cases
          const errorMessage = data.message;
          if (errorMessage.includes('already exists')) {
            // Return a structure consistent with success case for easier handling later
            return { 
              ...data, 
              results: [{ status: 'skipped', details: 'Video already has embed code' }], // Ensure results[0] exists
              message: 'Video already has embed code' // Update top-level message
            };
          }
          // For other failures, ensure the structure is somewhat consistent
          // The API should ideally return a consistent structure even on failure
          return {
            ...data,
            results: data.results.length > 0 ? data.results : [{ status: 'error', details: data.message }] // Provide a default result item
          };
        }

        return data; // Return the potentially modified data object
      };

      // Improved retry logic with better error handling
      const fetchWithRetry = async (url, options, maxRetries = 3) => {
        let attempt = 0;
        let lastError;
        while (attempt < maxRetries) {
          try {
            const response = await fetch(url, options);
            const data = await validateResponse(response); // data is now guaranteed to be an object with results array
            return data;
          } catch (error) {
            console.warn(\`Sheet update attempt \${attempt + 1} failed:\`, error);
            lastError = error;
            
            // Check if we should stop retrying based on the error message
            const errorMsg = error instanceof Error ? error.message.toLowerCase() : '';
            if (errorMsg.includes('already exists') || 
                errorMsg.includes('not found') ||
                errorMsg.includes('invalid json')) { // Don't retry fatal errors
              throw error; // Don't retry these cases
            }
            
            attempt++;
            if (attempt < maxRetries) {
              await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
            }
          }
        }
        throw lastError; // Throw the last encountered error after all retries fail
      };

      self.addEventListener('message', async (e) => {
        if (e.data.type === 'updateSheet') {
          const { videoName, videoGuid, libraryId, origin, sheetConfig } = e.data;

          try {
            // First post a status update that we're processing
            self.postMessage({
              success: true,
              status: 'processing',
              message: 'Sheet update in progress...',
              videoName: videoName,
              updateTime: Date.now()
            });
            
            console.warn(\`Sheet update attempt started for \${videoName}\`);

            // Generate embed code
            const embedCode = \`<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/\${libraryId}/\${videoGuid}?autoplay=false&loop=false&muted=false&preload=true&responsive=true" loading="lazy" style="border:0;position:absolute;top:0;height:100%;width:100%;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;" allowfullscreen="true"></iframe></div>\`;

            // *** FIX: تعريف nameToSend بشكل صحيح ***
            const nameToSend = videoName.replace(/\\.mp4$/i, ''); 
            console.log(\`[Worker] Sending name to API: "\${nameToSend}" (Original: "\${videoName}")\`);

            // Prepare request body with custom sheet config if available
            const requestBody = {
              videos: [{
                name: nameToSend, // Use the name without extension
                embed_code: embedCode
              }]
            };

            // Add custom sheet configuration if provided
            if (sheetConfig) {
              requestBody.spreadsheetId = sheetConfig.spreadsheetId;
              requestBody.sheetName = sheetConfig.sheetName;
              requestBody.nameColumn = sheetConfig.videoNameColumn;
              requestBody.embedColumn = sheetConfig.embedCodeColumn;
              requestBody.finalMinutesColumn = sheetConfig.finalMinutesColumn;
              console.log(\`[Worker] Using custom sheet config: "\${sheetConfig.name}"\`);
              console.log(\`[Worker] Sheet ID: \${sheetConfig.spreadsheetId}, Name: \${sheetConfig.sheetName}\`);
              console.log(\`[Worker] Columns - Names: \${sheetConfig.videoNameColumn}, Embed: \${sheetConfig.embedCodeColumn}, Minutes: \${sheetConfig.finalMinutesColumn}\`);
              console.log(\`[Worker] Full request body:\`, JSON.stringify(requestBody, null, 2));
            } else {
              console.log(\`[Worker] No custom sheet config provided, using environment defaults\`);
              console.log(\`[Worker] Request body (env defaults):\`, JSON.stringify(requestBody, null, 2));
            }

            console.log(\`[Worker] Sending request to: \${origin}/api/sheets/update-bunny-embeds\`);
            const requestStartTime = Date.now();

            // data should now have a consistent structure from validateResponse
            const data = await fetchWithRetry(
              \`\${origin}/api/sheets/update-bunny-embeds\`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
              }
            );
            
            const requestTime = Date.now() - requestStartTime;
            console.log(\`[Worker] Request completed in \${requestTime}ms\`);
            
            // Safely access properties, using defaults from validateResponse
            // Ensure results[0] exists before accessing its properties
            const firstResult = data.results && data.results.length > 0 ? data.results[0] : {};
            const status = firstResult?.status || (data.success ? 'updated' : 'error');
            const details = firstResult?.details || data.message; // Use top-level message as fallback detail
            
            console.log(\`[Worker] Sheet update API response for \${videoName}:\`, { 
              success: data.success,
              status: status,
              results: data.results,
              stats: data.stats
            });
            
            // Send the final result back to main thread
            self.postMessage({
              success: data.success, // Use success from data
              status: status,
              message: details, // Use resolved details/message
              embedCode: status === 'updated' ? embedCode : undefined, // Only send embedCode if status is 'updated'
              videoName: videoName, // Add videoName to response for better tracking
              updateTime: Date.now()
            });
          } catch (error) {
            // Ensure error is an Error object
            const err = error instanceof Error ? error : new Error(String(error));
            
            // Determine status based on error message
            let status = 'error';
            const errorMsg = err.message.toLowerCase();
            if (errorMsg.includes('not found')) {
              status = 'not-found';
            } else if (errorMsg.includes('already exists')) {
              status = 'skipped';
            }

            self.postMessage({
              success: false,
              status: status,
              message: err.message || 'Sheet update failed',
              updateTime: Date.now()
            });
          }
        }
      });
    `], { type: 'application/javascript' });