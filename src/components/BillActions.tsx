"use client";

import { useState } from "react";
import { Icon } from "./Icon";

interface Props {
  title: string;
  text: string;
  /** URL absoluta do PDF desta conta (link que dá acesso só a ele) */
  pdfUrl: string;
  /** caminho relativo do PDF, para baixar/abrir */
  pdfPath: string;
  filename: string;
}

/** Atalhos redondos: baixar, ver, WhatsApp, e-mail e compartilhar o próprio PDF */
export function BillActions({ title, text, pdfUrl, pdfPath, filename }: Props) {
  const [busy, setBusy] = useState(false);
  const message = `${text}\n\nPDF da conta: ${pdfUrl}`;

  async function shareNative() {
    setBusy(true);
    try {
      const res = await fetch(pdfPath);
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
    <div className="actions">
      <a className="action" href={`${pdfPath}?download=1`}>
        <span className="orb">
          <Icon name="download" />
        </span>
        Baixar
      </a>
      <a className="action" href={pdfPath} target="_blank" rel="noopener noreferrer">
        <span className="orb">
          <Icon name="eye" />
        </span>
        Ver PDF
      </a>
      <a className="action" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        <span className="orb">
          <Icon name="chat" />
        </span>
        WhatsApp
      </a>
      <a className="action" href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}>
        <span className="orb">
          <Icon name="mail" />
        </span>
        E-mail
      </a>
      <button type="button" className="action" onClick={shareNative} disabled={busy}>
        <span className="orb">
          <Icon name="share" />
        </span>
        {busy ? "Abrindo…" : "Enviar"}
      </button>
    </div>
  );
}
