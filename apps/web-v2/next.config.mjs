/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['@libsql/client'],
}

export default nextConfig
