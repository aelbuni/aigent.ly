import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: require("path").join(__dirname, "../../"),
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
