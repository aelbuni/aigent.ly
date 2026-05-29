import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const webAppDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(webAppDir, "../../");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
