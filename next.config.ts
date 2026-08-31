import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mongodb", "googleapis", "bcryptjs"],
};

export default nextConfig;
