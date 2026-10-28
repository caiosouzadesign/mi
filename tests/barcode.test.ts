import { describe, expect, it } from "vitest";
import { barcodeToDigitable, findDigitable, formatDigitable, parseDigitable } from "@/lib/parser/barcode";
import { makeBarcode } from "./helpers";

describe("linha digitável de arrecadação", () => {
  it("valida e extrai valor e segmento (módulo 10)", () => {
    const barcode = makeBarcode("3", "6", 23_456);
    const digitable = barcodeToDigitable(barcode)!;
    expect(digitable).toHaveLength(48);
    const parsed = parseDigitable(digitable)!;
    expect(parsed.barcode).toBe(barcode);
    expect(parsed.segment).toBe("energia");
    expect(parsed.amountCents).toBe(23_456);
  });

  it("valida módulo 11 (segmento saneamento)", () => {
    const parsed = parseDigitable(barcodeToDigitable(makeBarcode("2", "8", 9_870))!)!;
    expect(parsed.segment).toBe("saneamento");
    expect(parsed.amountCents).toBe(9_870);
  });

  it("rejeita dígito verificador errado", () => {
    const digitable = barcodeToDigitable(makeBarcode("3", "6", 100))!;
    const broken = digitable.slice(0, 11) + ((Number(digitable[11]) + 1) % 10) + digitable.slice(12);
    expect(parseDigitable(broken)).toBeNull();
  });

  it("encontra a linha no meio do texto com espaços e hífens", () => {
    const digitable = barcodeToDigitable(makeBarcode("3", "6", 15_099))!;
    const text = `Pague até o vencimento\nTelefone 0800 72 72 196\n${formatDigitable(digitable)}\nObrigado`;
    expect(findDigitable(text)?.digitable).toBe(digitable);
  });

  it("encontra a linha quebrada em vários trechos", () => {
    const digitable = barcodeToDigitable(makeBarcode("2", "6", 7_712))!;
    const spaced = digitable.match(/.{1,6}/g)!.join(" ");
    expect(findDigitable(`codigo: ${spaced} fim`)?.amountCents).toBe(7_712);
  });

  it("ignora números longos que não são linha digitável", () => {
    expect(findDigitable("8".repeat(10) + " 12345678901234567890123456789012345678")).toBeNull();
  });
});
