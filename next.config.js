/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // Allow CI builds to proceed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client'],
  },
}

module.exports = nextConfig
