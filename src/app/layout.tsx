import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contas do Imóvel",
  description: "Contas de água e luz do seu imóvel",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceef1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1012" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
