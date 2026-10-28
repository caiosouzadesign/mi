"use client";

import { useState } from "react";

interface Props {
  title: string;
  text: string;
  pdfUrl: string;
  filename: string;
}

/** WhatsApp, e-mail e o compartilhamento nativo do celular (que envia o próprio PDF) */
export function ShareButtons({ title, text, pdfUrl, filename }: Props) {
  const [busy, setBusy] = useState(false);
  const message = `${text}\n\nPDF da conta: ${pdfUrl}`;

  async function shareNative() {
    setBusy(true);
    try {
      const res = await fetch(pdfUrl);
      const file = new File([await res.blob()], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title, text: message });
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
      }
    } catch {
      // usuário cancelou o compartilhamento
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <a className="btn" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}>
        E-mail
      </a>
      <button type="button" className="btn full" onClick={shareNative} disabled={busy}>
        {busy ? "Preparando…" : "Compartilhar PDF…"}
      </button>
    </>
  );
}
