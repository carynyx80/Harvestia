import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Stage 1 concept lives at /concept/ as a static page.
  async redirects() {
    return [{ source: '/concept', destination: '/concept/index.html', permanent: false }];
  },
};

export default nextConfig;
