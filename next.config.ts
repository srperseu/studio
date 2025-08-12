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
  webpack: (config, { isServer }) => {
    // Add a rule to handle .js files with babel-loader
    config.module.rules.push({
      test: /\.js$/,
      use: 'babel-loader',
      exclude: /node_modules/,
    });

    return config;
  },
};

export default nextConfig;
