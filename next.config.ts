import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next 16 guards against two dev servers by locking `<distDir>/lock`, so a
  // running `next dev` blocks the e2e suite from starting its own. Giving the
  // e2e server its own build directory is what lets the two coexist.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Ship a self-contained server bundle so the runtime image needs no install.
  output: 'standalone',
  // Native and adapter packages must stay external; bundling breaks the .node binding.
  serverExternalPackages: ['@prisma/adapter-better-sqlite3', 'better-sqlite3'],
  // Playwright drives the dev server over 127.0.0.1; without this Next blocks
  // its own HMR resources as cross-origin and floods the e2e output.
  allowedDevOrigins: ['127.0.0.1'],
  // The dev overlay badge would otherwise sit in the corner of every README
  // screenshot. Only the capture run (npm run screenshots) sets this.
  devIndicators: process.env.SCREENSHOTS ? false : undefined,
}

export default nextConfig
