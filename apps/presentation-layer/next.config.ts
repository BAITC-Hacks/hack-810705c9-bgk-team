import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // pdf.js inside officeparser loads its worker at runtime; bundling breaks that lookup.
  serverExternalPackages: ['officeparser'],
};

export default nextConfig;
