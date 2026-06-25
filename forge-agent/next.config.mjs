/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Force production builds to successfully complete even if the project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Prevents code formatting warnings from blocking your build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
