/** Procura identificadores de documento nos formatos de payload conhecidos */
export function documentRefs(body: unknown): string[] {
  const refs = new Set<string>();
  const visit = (v: unknown, depth: number) => {
    if (!v || typeof v !== "object" || depth > 3) return;
    const o = v as Record<string, unknown>;
    for (const key of ["token", "document_token", "doc_token"]) {
      if (typeof o[key] === "string") refs.add(o[key] as string);
    }
    for (const key of ["data", "document", "doc"]) visit(o[key], depth + 1);
  };
  visit(body, 0);
  return [...refs];
}
