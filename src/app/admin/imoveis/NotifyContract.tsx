"use client";

import { useActionState } from "react";
import { notifyContract, type NotifyState } from "../actions";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";

export function NotifyContract({
  propertyId,
  whatsappUrl,
  emailUrl,
  emailAutomatic,
}: {
  propertyId: number;
  whatsappUrl: string | null;
  emailUrl: string | null;
  emailAutomatic: boolean;
}) {
  const [state, action] = useActionState(notifyContract.bind(null, propertyId), { done: false } as NotifyState);
  return (
    <div className="stack">
      <div className="btn-row">
        <form action={action} style={{ display: "contents" }}>
          <SubmitButton className="btn primary" pendingText="Avisando…">
            <Icon name="bell" size={18} />
            Avisar no portal{emailAutomatic ? " e por e-mail" : ""}
          </SubmitButton>
        </form>
        {whatsappUrl && (
          <a className="btn" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={18} />
            WhatsApp
          </a>
        )}
        {!emailAutomatic && emailUrl && (
          <a className="btn" href={emailUrl}>
            <Icon name="mail" size={18} />
            E-mail
          </a>
        )}
      </div>
      {state.done && (
        <p className="small" style={{ color: "var(--good)", fontWeight: 500 }}>
          ✓ Aviso publicado no portal do inquilino{state.email ? " e enviado por e-mail" : ""}.
        </p>
      )}
      {state.error && <p className="form-error">{state.error}</p>}
    </div>
  );
}
