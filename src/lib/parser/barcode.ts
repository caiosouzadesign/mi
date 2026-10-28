/**
 * Código de barras de arrecadação (contas de consumo) no padrão FEBRABAN.
 *
 * Código de barras: 44 dígitos.
 *   pos 1     "8" (arrecadação)
 *   pos 2     segmento (2 = saneamento, 3 = energia elétrica e gás, ...)
 *   pos 3     identificador de valor (6/7 = módulo 10, 8/9 = módulo 11; 6/8 = valor efetivo em reais)
 *   pos 4     dígito verificador geral
 *   pos 5-15  valor (11 dígitos, em centavos) quando pos 3 é 6 ou 8
 * Linha digitável: 4 blocos de 11 dígitos, cada um seguido do seu DV = 48 dígitos.
 */

export type Segment = "saneamento" | "energia" | "outro";

export interface ParsedBarcode {
  /** 48 dígitos, sem formatação */
  digitable: string;
  /** 44 dígitos */
  barcode: string;
  segment: Segment;
  amountCents: number | null;
}

export function mod10(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    const product = Number(digits[i]) * weight;
    sum += product > 9 ? Math.floor(product / 10) + (product % 10) : product;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

export function mod11(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv >= 10 ? 0 : dv;
}

function checker(valueId: string): ((d: string) => number) | null {
  if (valueId === "6" || valueId === "7") return mod10;
  if (valueId === "8" || valueId === "9") return mod11;
  return null;
}

function segmentOf(barcode: string): Segment {
  if (barcode[1] === "2") return "saneamento";
  if (barcode[1] === "3") return "energia";
  return "outro";
}

function describe(barcode: string, digitable: string): ParsedBarcode {
  const valueId = barcode[2];
  const amountCents = valueId === "6" || valueId === "8" ? Number(barcode.slice(4, 15)) : null;
  return { digitable, barcode, segment: segmentOf(barcode), amountCents };
}

/** Valida uma linha digitável de 48 dígitos (DV de cada bloco + DV geral). */
export function parseDigitable(input: string): ParsedBarcode | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 48 || digits[0] !== "8") return null;
  const check = checker(digits[2]);
  if (!check) return null;
  let barcode = "";
  for (let b = 0; b < 4; b++) {
    const block = digits.slice(b * 12, b * 12 + 11);
    if (check(block) !== Number(digits[b * 12 + 11])) return null;
    barcode += block;
  }
  if (check(barcode.slice(0, 3) + barcode.slice(4)) !== Number(barcode[3])) return null;
  return describe(barcode, digits);
}

/** Converte um código de barras de 44 dígitos na linha digitável. */
export function barcodeToDigitable(barcode: string): string | null {
  if (!/^8\d{43}$/.test(barcode)) return null;
  const check = checker(barcode[2]);
  if (!check) return null;
  let out = "";
  for (let b = 0; b < 4; b++) {
    const block = barcode.slice(b * 11, b * 11 + 11);
    out += block + check(block);
  }
  return out;
}

export function parseBarcode44(input: string): ParsedBarcode | null {
  const digitable = barcodeToDigitable(input.replace(/\D/g, ""));
  return digitable ? parseDigitable(digitable) : null;
}

/** "836600000015 234500480105 ..." -> formato usual com hífen antes do DV de cada bloco */
export function formatDigitable(digitable: string): string {
  const blocks: string[] = [];
  for (let b = 0; b < 4; b++) {
    const block = digitable.slice(b * 12, b * 12 + 12);
    blocks.push(`${block.slice(0, 11)}-${block.slice(11)}`);
  }
  return blocks.join(" ");
}

/**
 * Procura a linha digitável em texto livre (texto extraído do PDF). Os dígitos
 * costumam vir com espaços, hífens ou pontos entre blocos; os DVs eliminam
 * falsos positivos.
 */
export function findDigitable(text: string): ParsedBarcode | null {
  const candidates = text.match(/8[\d\s.\-]{47,90}/g) ?? [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    for (let start = 0; start + 48 <= digits.length; start++) {
      if (digits[start] !== "8") continue;
      const parsed = parseDigitable(digits.slice(start, start + 48));
      if (parsed) return parsed;
    }
  }
  // Código de barras "cru" (44 dígitos seguidos) tem só um DV; exige o número isolado.
  for (const match of text.matchAll(/(?<!\d)8\d{43}(?!\d)/g)) {
    const parsed = parseBarcode44(match[0]);
    if (parsed) return parsed;
  }
  return null;
}
