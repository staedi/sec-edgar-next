/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/sec-edgar-next',
  assetPrefix: '/sec-edgar-next/',
  images: { unoptimized: true },
}

module.exports = nextConfig
