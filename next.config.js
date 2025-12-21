/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: false,
  eslint: {
    // Allow CI builds to proceed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  // Moved from experimental.serverComponentsExternalPackages in Next.js 15
  serverExternalPackages: ['@libsql/client'],
  // Remove assetPrefix for proper static file handling
  // The standalone server handles this correctly
}

module.exports = nextConfig
