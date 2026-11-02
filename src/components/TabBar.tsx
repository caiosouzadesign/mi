"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";

/** Navegação flutuante em vidro (celular); destaca a seção visível */
export function TabBar({ items }: { items: { id: string; label: string; icon: IconName }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="tabbar" aria-label="Seções">
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className={active === item.id ? "active" : ""} aria-label={item.label} title={item.label} onClick={() => setActive(item.id)}>
          <Icon name={item.icon} size={22} />
        </a>
      ))}
    </nav>
  );
}
