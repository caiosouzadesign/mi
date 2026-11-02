"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [error, action] = useActionState(login, null);
  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <label className="field">
        Senha
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {error && <p className="form-error">{error}</p>}
      <SubmitButton className="btn primary block" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
