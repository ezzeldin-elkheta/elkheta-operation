import React from "react";
import { Suspense } from "react";
import { useRoutes, Routes, Route } from "react-router-dom";
import Home from "./components/home";
import NotFound from "./components/NotFound";
import routes from "tempo-routes";
import { TestSheetsConnection } from "./components/TestSheetsConnection";
import { EnvironmentDebugger } from "./components/EnvironmentDebugger";
import { ToastProvider } from "./components/providers/toast-provider";
import { Toaster } from "./components/ui/toaster";

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              The application encountered an error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<p>Loading...</p>}>
          <div className="min-h-screen bg-background">
            <div className="p-4 space-y-4">
              <TestSheetsConnection />
              <EnvironmentDebugger />
              {/* SecurityManager temporarily disabled to fix React error */}
            </div>
            {/* Tempo routes first */}
            {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}

            <Routes>
              <Route path="/" element={<Home />} />
              {import.meta.env.VITE_TEMPO === "true" && (
                <Route path="/tempobook/*" />
              )}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </div>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
