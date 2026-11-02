"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

/** "Já paguei": o inquilino informa o pagamento, com comprovante opcional */
export function PaymentForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <details className="sheet">
      <summary className="btn block">
        <Icon name="checkCircle" size={18} />
        Já paguei esta conta
      </summary>
      <form action={action} className="stack">
        <label className="dropzone" style={{ padding: "18px 16px" }}>
          <input type="file" name="receipt" accept="image/*,application/pdf" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
          <span className="tile info">
            <Icon name={fileName ? "doc" : "upload"} />
          </span>
          {fileName ? (
            <span className="small">
              <strong>{fileName}</strong>
            </span>
          ) : (
            <span className="small">
              <strong>Anexar comprovante</strong> <span className="faint">· opcional</span>
            </span>
          )}
        </label>
        <label className="field">
          Observação
          <input type="text" name="note" maxLength={500} placeholder="Ex.: pago pelo app do banco" />
        </label>
        <SubmitButton className="btn primary block">Informar pagamento</SubmitButton>
      </form>
    </details>
  );
}
