import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  
  // Output configuration for Vercel
  output: 'standalone',
  
  // Transpile shared packages
  transpilePackages: ['bulk-email-platform-shared'],
};

export default nextConfig;
