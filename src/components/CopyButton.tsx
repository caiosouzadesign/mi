"use client";

import { useState } from "react";

export function CopyButton({ value, label, className = "btn" }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // navegadores antigos / sem permissão
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "✓ Copiado" : label}
    </button>
  );
}
