import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',  // For static site generation
  trailingSlash: true,  // Required for GitHub Pages
  images: {
    unoptimized: true,  // Required for static export
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
