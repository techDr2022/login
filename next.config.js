/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Enable compression
  compress: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  
  
  // Enable React strict mode for better performance
  reactStrictMode: true,
  
  // Optimize bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Headers for caching and performance
  async headers() {
    const allowExtEmbed = process.env.ALLOW_CHROME_EXTENSION_EMBED === 'true'
    const extIds = (process.env.CHROME_EXTENSION_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const pageSecurity = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
    ]

    if (allowExtEmbed && extIds.length > 0) {
      const ancestors = ["'self'", ...extIds.map((id) => `chrome-extension://${id}`)].join(
        ' '
      )
      pageSecurity.push({
        key: 'Content-Security-Policy',
        value: `frame-ancestors ${ancestors}`,
      })
    } else {
      pageSecurity.push({
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      })
    }

    return [
      {
        source: '/:path*',
        headers: pageSecurity,
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=59',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig

