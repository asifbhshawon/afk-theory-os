import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/next/dist/compiled/source-map/**/*",
      "../../node_modules/next/dist/compiled/source-map/**/*",
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
