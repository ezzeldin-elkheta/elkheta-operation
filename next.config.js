/** @type {import('next').NextConfig} */
const nextConfig = {
  // We only need Next.js for API routes, not for pages
  experimental: {
    appDir: false, // Disable app directory since we're using pages API
  },
  
  // Disable Next.js features we don't need
  images: {
    unoptimized: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },

  // CORS Headers configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, AccessKey' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
