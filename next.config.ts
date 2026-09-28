import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.100:3000", "192.168.1.100", "192.168.1.24"],
};

export default nextConfig;