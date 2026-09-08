import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Playwright drives the dev server over 127.0.0.1; without this Next blocks
  // its own HMR resources as cross-origin and floods the e2e output.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
