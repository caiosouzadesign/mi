import { findDigitable, type ParsedBarcode } from "./barcode";

export type Provider = "enel" | "sabesp";

export interface ParsedBill {
  provider: Provider | null;
  digitable: string | null;
  amountCents: number | null;
  /** YYYY-MM-DD */
  dueDate: string | null;
  /** YYYY-MM */
  referenceMonth: string | null;
  consumption: number | null;
  consumptionUnit: "kWh" | "m³" | null;
  pixCode: string | null;
  notices: string[];
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** minúsculas e sem acentos, preservando quebras de linha */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function toIsoDate(d: string, m: string, y: string): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseBrNumber(s: string): number {
  // "1.234,56" -> 1234.56 ; "1.234" -> 1234 ; "12,5" -> 12.5
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s.replace(/\./g, ""));
}

function detectProvider(norm: string, barcode: ParsedBarcode | null): Provider | null {
  if (/\benel\b|eletropaulo/.test(norm)) return "enel";
  if (/\bsabesp\b/.test(norm)) return "sabesp";
  if (barcode?.segment === "energia") return "enel";
  if (barcode?.segment === "saneamento") return "sabesp";
  return null;
}

function findDueDate(norm: string): string | null {
  const patterns = [
    /(?:data\s+de\s+)?vencimento[^0-9]{0,60}?(\d{2})\/(\d{2})\/(\d{4}|\d{2})/,
    /vence\s+em[^0-9]{0,20}?(\d{2})\/(\d{2})\/(\d{4}|\d{2})/,
    /pagavel\s+ate[^0-9]{0,20}?(\d{2})\/(\d{2})\/(\d{4}|\d{2})/,
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (m) {
      const iso = toIsoDate(m[1], m[2], m[3]);
      if (iso) return iso;
    }
  }
  return null;
}

function findReferenceMonth(norm: string, dueDate: string | null): string | null {
  const numeric = norm.match(/referen?cia[^0-9a-z]{0,6}(?:mes[^0-9]{0,6})?(\d{2})\/(\d{4})/);
  if (numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12) {
    return `${numeric[2]}-${numeric[1]}`;
  }
  const named = norm.match(
    new RegExp(`referen?cia[^\\n]{0,40}?\\b(${MONTHS.join("|")})[a-z]*[\\s/.-]*(\\d{4}|\\d{2})\\b`),
  );
  if (named) {
    const year = named[2].length === 2 ? `20${named[2]}` : named[2];
    return `${year}-${String(MONTHS.indexOf(named[1]) + 1).padStart(2, "0")}`;
  }
  if (dueDate) {
    // sem referência explícita: o consumo costuma ser do mês anterior ao vencimento
    const [y, m] = dueDate.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return null;
}

function findAmount(norm: string): number | null {
  const m = norm.match(
    /(?:total\s+a\s+pagar|valor\s+a\s+pagar|valor\s+total|total\s+da\s+(?:conta|fatura))[^0-9]{0,30}?(\d{1,3}(?:\.\d{3})*,\d{2})/,
  );
  return m ? Math.round(parseBrNumber(m[1]) * 100) : null;
}

function findConsumption(norm: string, provider: Provider | null): Pick<ParsedBill, "consumption" | "consumptionUnit"> {
  const energy = provider !== "sabesp";
  const unit = energy ? "kwh" : "m(?:3|³)";
  const max = energy ? 10000 : 500;
  const patterns = [
    new RegExp(`consumo[^0-9\\n]{0,40}?(\\d[\\d.,]*)\\s*${unit}(?![a-z0-9])`),
    new RegExp(`consumo[^\\n]{0,30}?\\(?${unit}\\)?[^0-9\\n]{0,30}?(\\d[\\d.,]*)`),
    new RegExp(`(\\d[\\d.,]*)\\s*${unit}(?![a-z0-9])`),
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (!m) continue;
    const value = parseBrNumber(m[1]);
    if (Number.isFinite(value) && value >= 0 && value <= max) {
      return { consumption: value, consumptionUnit: energy ? "kWh" : "m³" };
    }
  }
  return { consumption: null, consumptionUnit: null };
}

/** CRC16-CCITT (0x1021, init 0xFFFF), usado no "PIX copia e cola" */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function findPixCode(text: string): string | null {
  // o código pode vir quebrado em várias linhas no PDF
  const joined = text.replace(/\s*\n\s*/g, "");
  for (const start of joined.matchAll(/000201/g)) {
    const rest = joined.slice(start.index);
    for (const end of rest.matchAll(/6304([0-9A-Fa-f]{4})/g)) {
      const payload = rest.slice(0, end.index + 8);
      if (payload.length > 600) break;
      if (!/br\.gov\.bcb\.pix/i.test(payload)) continue;
      if (crc16(payload.slice(0, -4)) === end[1].toUpperCase()) return payload;
    }
  }
  return null;
}

const NOTICE_KEYWORDS = [
  "aviso", "reaviso", "corte", "suspens", "debito", "em aberto", "atraso", "bandeira", "reajuste",
  "interrup", "desligamento", "vazamento", "comunicado", "importante", "atencao", "tarifa social",
];
const NOTICE_IGNORE = ["debito automatico", "cadastre", "baixe o app", "aplicativo"];

export function findNotices(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 15) continue;
    const norm = normalize(line);
    if (!NOTICE_KEYWORDS.some((k) => norm.includes(k))) continue;
    if (NOTICE_IGNORE.some((k) => norm.includes(k))) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(line.length > 280 ? `${line.slice(0, 277)}...` : line);
    if (out.length >= 8) break;
  }
  return out;
}

export function parseBillText(text: string): ParsedBill {
  const norm = normalize(text);
  const barcode = findDigitable(text);
  const provider = detectProvider(norm, barcode);
  const dueDate = findDueDate(norm);
  return {
    provider,
    digitable: barcode?.digitable ?? null,
    amountCents: barcode?.amountCents ?? findAmount(norm),
    dueDate,
    referenceMonth: findReferenceMonth(norm, dueDate),
    ...findConsumption(norm, provider),
    pixCode: findPixCode(text),
    notices: findNotices(text),
  };
}

/**
 * Verifica se um código (instalação Enel / RGI ou fornecimento Sabesp) aparece no
 * texto, tolerando separadores ("1234567-8", "123.456.78") e exigindo que não esteja
 * colado a outros dígitos.
 */
export function textContainsCode(text: string, code: string): boolean {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 5) return false;
  const pattern = digits.split("").join("[\\s.\\-/]?");
  return new RegExp(`(?<![\\d])${pattern}(?![\\d])`).test(text);
}
