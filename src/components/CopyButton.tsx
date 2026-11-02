"use client";

import { useState } from "react";
import { Icon } from "./Icon";

async function copyText(value: string) {
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
}

export function CopyButton({
  value,
  label,
  className = "btn",
  icon = "copy",
}: {
  value: string;
  label: string;
  className?: string;
  icon?: "copy" | "link" | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {icon && <Icon name={copied ? "check" : icon} size={18} />}
      {copied ? "Copiado" : label}
    </button>
  );
}

/** Botão redondo de cópia, para usar ao lado de um código */
export function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={async () => {
        await copyText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }}
      style={copied ? { color: "var(--good)" } : undefined}
    >
      <Icon name={copied ? "check" : "copy"} size={18} />
    </button>
  );
}
