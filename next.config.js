/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: false,
  eslint: {
    // Allow CI builds to proceed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client'],
  },
  // Remove assetPrefix for proper static file handling
  // The standalone server handles this correctly
}

module.exports = nextConfig
