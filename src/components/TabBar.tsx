"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

function useActive(items: NavItem[]) {
  const pathname = usePathname();
  // a aba mais específica que contém o caminho atual
  return [...items].sort((a, b) => b.href.length - a.href.length).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.href;
}

/** Celular: barra flutuante em vidro, a aba ativa mostra o nome */
export function TabBar({ items }: { items: NavItem[] }) {
  const active = useActive(items);
  return (
    <nav className="tabbar" aria-label="Seções">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""} aria-label={item.label} aria-current={active === item.href ? "page" : undefined}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Desktop (no topo) ou dentro da página: controle segmentado */
export function SegmentedNav({ items, inline = false }: { items: NavItem[]; inline?: boolean }) {
  const active = useActive(items);
  return (
    <nav className={`segmented${inline ? " inline" : ""}`} aria-label="Seções">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={active === item.href ? "active" : ""} aria-current={active === item.href ? "page" : undefined}>
          <Icon name={item.icon} size={18} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
