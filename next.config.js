/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  compress: false,
  swcMinify: false,
  productionBrowserSourceMaps: false,
  webpack: (config) => {
    config.optimization.minimize = false
    config.cache = false
    return config
  }
}

module.exports = nextConfig