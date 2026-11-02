import type { NavItem } from "@/components/TabBar";

/**
 * Abas do portal do inquilino. Para a futura aba de câmeras: criar
 * src/app/t/[token]/cameras/page.tsx e incluir aqui
 * { href: `${base}/cameras`, label: "Câmeras", icon: "camera" } quando o
 * proprietário liberar o acesso para o imóvel.
 */
export function tenantTabs(token: string): NavItem[] {
  const base = `/t/${token}`;
  return [
    { href: base, label: "Contas", icon: "receipt" },
    { href: `${base}/imovel`, label: "Contrato e fotos", icon: "home" },
  ];
}

/** Abas de um imóvel no painel do proprietário */
export function adminPropertyTabs(id: number): NavItem[] {
  const base = `/admin/imoveis/${id}`;
  return [
    { href: base, label: "Contas", icon: "receipt" },
    { href: `${base}/contrato`, label: "Contrato", icon: "pen" },
    { href: `${base}/fotos`, label: "Fotos", icon: "image" },
  ];
}
