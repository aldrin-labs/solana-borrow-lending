/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // Configure webpack to handle polyfills for crypto modules needed by Solana
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        // Handle sharp module fallback
        sharp: false,
      };
    }
    
    // Handle sharp dynamic requires for better compatibility
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push('sharp');
    }
    
    return config;
  },
  // Configure image optimization to handle sharp issues
  images: {
    unoptimized: true, // Disable image optimization to prevent sharp issues during static export
  },
};

module.exports = nextConfig;
