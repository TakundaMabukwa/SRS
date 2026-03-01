/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false
}

module.exports = nextConfig
