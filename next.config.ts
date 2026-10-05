import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Node server for Azure App Service.
  output: "standalone",
  serverExternalPackages: ["mssql"],
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ],
    }];
  },
};

export default nextConfig;
