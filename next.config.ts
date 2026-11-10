import type { NextConfig } from "next";

const isJsonMode = process.env.JUNIPER_DATA_SOURCE === "json";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config, { isServer }) => {
    if (isJsonMode && isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      (config.resolve.alias as Record<string, string | false>)["better-sqlite3"] = false;
    }
    return config;
  },
};

export default nextConfig;
