"use client";

import { useActionState } from "react";

/** Formulário de server action que devolve uma mensagem de erro (ou null) */
export function ActionForm({
  action,
  children,
  className,
  style,
}: {
  action: (prev: string | null, formData: FormData) => Promise<string | null>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [error, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className} style={style}>
      {children}
      {error && (
        <p className="form-error" role="alert" style={{ flexBasis: "100%" }}>
          {error}
        </p>
      )}
    </form>
  );
}
