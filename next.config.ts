import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  /* Keep Next from writing agent instruction files into the repo. */
  agentRules: false,
};

export default nextConfig;
