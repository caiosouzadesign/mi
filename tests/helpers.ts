import { mod10, mod11, barcodeToDigitable, formatDigitable } from "@/lib/parser/barcode";
import { PDFDocument, StandardFonts } from "pdf-lib";

/** Monta um código de barras de arrecadação válido (44 dígitos) */
export function makeBarcode(segment: "2" | "3", valueId: "6" | "8", cents: number, free = "0048123456789012345678901"): string {
  const value = String(cents).padStart(11, "0");
  const company = "0123";
  const without = `8${segment}${valueId}${value}${company}${free}`.slice(0, 43);
  const dv = (valueId === "6" ? mod10 : mod11)(without);
  return `${without.slice(0, 3)}${dv}${without.slice(3)}`;
}

export function makeFormattedDigitable(...args: Parameters<typeof makeBarcode>): string {
  return formatDigitable(barcodeToDigitable(makeBarcode(...args))!);
}

export async function makePdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 800;
  for (const line of lines) {
    page.drawText(line, { x: 40, y, size: 10, font });
    y -= 16;
  }
  return doc.save();
}
