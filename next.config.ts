import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "unpdf"],
  experimental: {
    // PDFs das contas e comprovantes passam por server actions
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
