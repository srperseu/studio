import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  compiler: {
    // This is needed to fix the babel error.
    // See: https://nextjs.org/docs/architecture/next-compiler#why-am-i-seeing-it-looks-like-there-is-a-custom-babel-configuration-that-can-be-removed
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
