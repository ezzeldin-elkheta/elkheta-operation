// This file is required for Next.js API routes to work
// even though we're using Vite for the main app
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
