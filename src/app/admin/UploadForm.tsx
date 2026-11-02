"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { uploadBills, type UploadState } from "./actions";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";

export function UploadForm({ properties }: { properties: { id: number; name: string }[] }) {
  const [state, action] = useActionState(uploadBills, { results: [] } as UploadState);
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <label
        className={`dropzone${over ? " over" : ""}`}
        onDragEnter={() => setOver(true)}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
      >
        <input type="file" name="files" accept="application/pdf" multiple required onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        <strong>Solte os PDFs das contas aqui</strong>
        <span className="orb">
          <Icon name="upload" size={30} />
        </span>
        <span className="small faint" style={{ maxWidth: 360 }}>
          Baixe no app da Enel ou da Sabesp. O imóvel é identificado pelo nº da instalação ou RGI.
        </span>
      </label>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <div key={f.name} className="panel file-item">
              <span className="tile info">
                <Icon name="doc" />
              </span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div className="tiny">PDF · {(f.size / 1024).toFixed(0)} KB</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="form-grid">
        <label className="field">
          Imóvel
          <select name="propertyId" defaultValue="">
            <option value="">Automático</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Distribuidora
          <select name="provider" defaultValue="">
            <option value="">Automático</option>
            <option value="enel">Enel (luz)</option>
            <option value="sabesp">Sabesp (água)</option>
          </select>
        </label>
      </div>
      <SubmitButton className="btn primary" pendingText="Lendo PDFs…">
        Importar contas
      </SubmitButton>

      {state.results.length > 0 && (
        <div className="list">
          {state.results.map((r, i) => (
            <div key={i} className="list-row">
              <span className={`tile sm ${r.ok ? "good" : "bad"}`}>
                <Icon name={r.ok ? "check" : "alert"} size={17} />
              </span>
              <div className="meta">
                <span className="title">{r.filename}</span>
                <span className="tiny">{r.message}</span>
              </div>
              {r.billId && (
                <Link className="btn sm" href={`/admin/contas/${r.billId}`}>
                  Conferir
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
