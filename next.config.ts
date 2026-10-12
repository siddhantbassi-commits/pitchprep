import type { NextConfig } from 'next';

// Security headers for a public site. The microphone is allowed for the same origin only (answer dictation).
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=(), payment=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@google/genai'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default config;
