import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL) {
      return [];
    }

    const backendOrigin = (
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3002"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
