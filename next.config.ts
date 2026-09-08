import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Ship a self-contained server bundle so the runtime image needs no install.
  output: 'standalone',
  // Native and adapter packages must stay external; bundling breaks the .node binding.
  serverExternalPackages: ['@prisma/adapter-better-sqlite3', 'better-sqlite3'],
  // Playwright drives the dev server over 127.0.0.1; without this Next blocks
  // its own HMR resources as cross-origin and floods the e2e output.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
