"use client";

import Link from "next/link";
import { useActionState } from "react";
import { uploadBills, type UploadState } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export function UploadForm({ properties }: { properties: { id: number; name: string }[] }) {
  const [state, action] = useActionState(uploadBills, { results: [] } as UploadState);
  return (
    <form action={action} className="stack">
      <label>
        PDFs das contas (pode selecionar vários)
        <input type="file" name="files" accept="application/pdf" multiple required />
      </label>
      <div className="form-grid">
        <label>
          Imóvel
          <select name="propertyId" defaultValue="">
            <option value="">Identificar automaticamente</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Distribuidora
          <select name="provider" defaultValue="">
            <option value="">Identificar automaticamente</option>
            <option value="enel">Enel (luz)</option>
            <option value="sabesp">Sabesp (água)</option>
          </select>
        </label>
      </div>
      <SubmitButton pendingText="Lendo PDFs…">Importar contas</SubmitButton>
      {state.results.length > 0 && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {state.results.map((r, i) => (
            <li key={i} style={{ color: r.ok ? undefined : "var(--bad)" }}>
              {r.filename}: {r.message} {r.billId && <Link href={`/admin/contas/${r.billId}`}>conferir</Link>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
