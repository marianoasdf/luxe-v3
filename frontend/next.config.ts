import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';
const configuredApiUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  process.env.API_BASE_URL?.trim() ||
  '';

if (isProd) {
  if (!configuredApiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL (o API_BASE_URL) es obligatorio en producción.');
  }
  if (/localhost|127\.0\.0\.1/i.test(configuredApiUrl)) {
    throw new Error('La API de producción no puede apuntar a localhost.');
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
  async rewrites() {
    const apiUrl = configuredApiUrl || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
