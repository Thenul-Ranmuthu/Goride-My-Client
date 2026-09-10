// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
//   reactCompiler: true,
//   /* Keep Next from writing agent instruction files into the repo. */
//   agentRules: false,
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  /* Keep Next from writing agent instruction files into the repo. */
  agentRules: false,

  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "https://localhost:7136";
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/login", destination: `${backend}/login` },
      { source: "/logout", destination: `${backend}/logout` },
      { source: "/signin-oidc", destination: `${backend}/signin-oidc` },
      { source: "/signout-callback-oidc", destination: `${backend}/signout-callback-oidc` },
    ];
  },
};

export default nextConfig;