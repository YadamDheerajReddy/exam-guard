import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for student ID photos.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
