import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server serve JS/CSS/HMR to other devices on the LAN (e.g.
  // testing on a phone at http://<lan-ip>:3000) instead of only localhost.
  // Dev-only — allowedDevOrigins has no effect in production builds.
  allowedDevOrigins: ["192.168.3.20"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "public-otman-img.s3.eu-north-1.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
