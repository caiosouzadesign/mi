const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const PROVIDER_LABEL = { enel: "Luz · Enel", sabesp: "Água · Sabesp" } as const;

export function brl(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "2026-11-10" -> "10/11/2026" */
export function brDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-10" -> "out/2026" */
export function monthLabel(ym: string | null | undefined): string {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]}/${y}`;
}

/** Data de hoje em São Paulo, YYYY-MM-DD */
export function todaySP(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export function formatConsumption(value: number | null, unit: string | null): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR")} ${unit ?? ""}`.trim();
}

/** Só dígitos, com DDI 55 quando faltar (para links wa.me) */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
}

/** Data do SQLite ("2026-11-23 14:05:00", UTC) ou ISO para Date */
export function parseDbDate(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

/** "agora", "há 5 min", "há 3 h", "ontem", "12/11" */
export function timeAgo(value: string, now = new Date()): string {
  const date = parseDbDate(value);
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  if (hours < 48) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date);
}
