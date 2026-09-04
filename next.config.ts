import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product & review images are served from Cloudinary.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
