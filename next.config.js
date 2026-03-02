const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    webpackBuildWorker: false
  },
  outputFileTracingRoot: path.resolve(__dirname),
  compress: true,
  productionBrowserSourceMaps: false
}

module.exports = nextConfig
