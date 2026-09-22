import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev hosts are distinct per app so each gets its own cookie jar (cookies
  // ignore port). See src/lib/pcg-demos.ts.
  allowedDevOrigins: ["127.0.0.1", "localhost", "photiades.localhost", "crm.localhost", "hr.localhost"],
  reactStrictMode: true,
};

export default nextConfig;
