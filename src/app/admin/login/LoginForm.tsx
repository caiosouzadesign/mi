"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm() {
  const [error, action] = useActionState(login, null);
  return (
    <form action={action} className="stack">
      <label>
        Senha
        <input type="password" name="password" autoComplete="current-password" required autoFocus />
      </label>
      {error && <p className="alert bad">{error}</p>}
      <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
    </form>
  );
}
