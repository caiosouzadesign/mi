import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Política de conteúdo das páginas: só carrega recursos do próprio site e não
 * pode ser embutida em outro site. Os scripts inline são os do próprio Next.js.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** Para arquivos enviados por usuários (fotos, comprovantes): nada executa */
export const fileCsp = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // os links do portal carregam o token na URL: nunca enviar a URL para outros sites
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "unpdf"],
  poweredByHeader: false,
  experimental: {
    // PDFs das contas e comprovantes passam por server actions
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    const pageHeaders = production ? [...baseHeaders, { key: "Content-Security-Policy", value: csp }] : baseHeaders;
    return [
      { source: "/:path*", headers: baseHeaders },
      // páginas (a CSP fica fora dos PDFs, que o leitor do navegador não abre com ela)
      { source: "/", headers: pageHeaders },
      { source: "/admin/:path*", headers: pageHeaders },
      { source: "/t/:path*", headers: pageHeaders },
      // arquivos enviados por usuários: caixa de areia, nada executa (a última regra vale)
      { source: "/t/:token/fotos/:photoId", headers: [{ key: "Content-Security-Policy", value: fileCsp }] },
      { source: "/admin/contas/:id/comprovante", headers: [{ key: "Content-Security-Policy", value: fileCsp }] },
    ];
  },
};

export default nextConfig;
