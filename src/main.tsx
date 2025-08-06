import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";

import { TempoDevtools } from "tempo-devtools";

// Add error boundary for startup
const handleStartupError = (error: Error) => {
  console.error('🚨 Application startup error:', error);
  // Show user-friendly error message
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>Application Error</h2>
        <p>Sorry, there was an error starting the application. Please refresh the page to try again.</p>
        <p>Error: ${error.message}</p>
      </div>
    `;
  }
};

// Wrap startup code in try-catch
try {
  // Import startup modules with error handling
  import("./lib/startup-check").catch(error => {
    console.warn('Startup check failed:', error);
  });
  
  import('./lib/security-migration').then(({ initializeSecurityMigration }) => {
    try {
      initializeSecurityMigration();
    } catch (error) {
      console.warn('Security migration failed:', error);
    }
  }).catch(error => {
    console.warn('Security migration import failed:', error);
  });

  TempoDevtools.init();

  const basename = import.meta.env.BASE_URL;

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
} catch (error) {
  handleStartupError(error as Error);
}
