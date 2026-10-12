import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@google/genai'],
};
export default config;
