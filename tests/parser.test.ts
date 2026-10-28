import { describe, expect, it } from "vitest";
import { crc16, findNotices, findPixCode, parseBillText, textContainsCode } from "@/lib/parser";
import { consumptionAlert } from "@/lib/alerts";
import { makeFormattedDigitable } from "./helpers";

const enelText = `ENEL DISTRIBUIÇÃO SÃO PAULO
Nº DA INSTALAÇÃO 12345678
REFERÊNCIA OUT/2026  VENCIMENTO 10/11/2026
TOTAL A PAGAR R$ 187,35
Consumo (kWh) 245
Bandeira tarifária vermelha patamar 1 vigente em outubro.
Cadastre-se no débito automático e ganhe praticidade.
AVISO: consta débito em aberto referente a 09/2026. Evite a suspensão do fornecimento.
${makeFormattedDigitable("3", "6", 18_735)}`;

const sabespText = `Sabesp - Companhia de Saneamento Básico
RGI 0123456789-0
Referência: 10/2026
Data de vencimento
15/11/2026
Consumo faturado 18 m³
Valor total R$ 132,40`;

describe("parseBillText", () => {
  it("lê uma conta da Enel", () => {
    const bill = parseBillText(enelText);
    expect(bill.provider).toBe("enel");
    expect(bill.amountCents).toBe(18_735);
    expect(bill.dueDate).toBe("2026-11-10");
    expect(bill.referenceMonth).toBe("2026-10");
    expect(bill.consumption).toBe(245);
    expect(bill.consumptionUnit).toBe("kWh");
    expect(bill.digitable).toHaveLength(48);
    expect(bill.notices.some((n) => n.includes("Bandeira"))).toBe(true);
    expect(bill.notices.some((n) => n.includes("suspensão"))).toBe(true);
    expect(bill.notices.some((n) => n.includes("débito automático"))).toBe(false);
  });

  it("lê uma conta da Sabesp sem código de barras (valor pelo texto)", () => {
    const bill = parseBillText(sabespText);
    expect(bill.provider).toBe("sabesp");
    expect(bill.amountCents).toBe(13_240);
    expect(bill.dueDate).toBe("2026-11-15");
    expect(bill.referenceMonth).toBe("2026-10");
    expect(bill.consumption).toBe(18);
    expect(bill.consumptionUnit).toBe("m³");
  });

  it("deduz a referência pelo vencimento quando falta", () => {
    expect(parseBillText("Enel\nVencimento: 05/01/2027").referenceMonth).toBe("2026-12");
  });
});

describe("PIX copia e cola", () => {
  it("encontra e valida o CRC, mesmo quebrado em linhas", () => {
    const body = "00020101021226580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865406187.355802BR5913ENEL SP6009SAO PAULO62070503***6304";
    const payload = body + crc16(body);
    const text = `Pague com PIX\n${payload.slice(0, 60)}\n${payload.slice(60)}\nfim`;
    expect(findPixCode(text)).toBe(payload);
    expect(findPixCode(text.replace(payload.slice(-4), "0000"))).toBeNull();
  });
});

describe("textContainsCode", () => {
  it("aceita separadores e rejeita números maiores", () => {
    expect(textContainsCode("RGI 0123456789-0", "01234567890")).toBe(true);
    expect(textContainsCode("instalação 12345678", "12345678")).toBe(true);
    expect(textContainsCode("instalação 912345678", "12345678")).toBe(false);
  });
});

describe("findNotices", () => {
  it("limita e remove duplicados", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Aviso importante número ${i % 3} sobre a conta`).join("\n");
    expect(findNotices(text)).toHaveLength(3);
  });
});

describe("consumptionAlert", () => {
  const months = (values: number[]) => values.map((v, i) => ({ referenceMonth: `2026-${String(i + 1).padStart(2, "0")}`, consumption: v }));
  it("alerta quando o último mês está bem acima da média", () => {
    expect(consumptionAlert(months([200, 210, 190, 300]))).toMatchObject({ level: "alto", percent: 50 });
    expect(consumptionAlert(months([200, 200, 200, 260]))).toMatchObject({ level: "atencao", percent: 30 });
  });
  it("não alerta com consumo normal ou pouco histórico", () => {
    expect(consumptionAlert(months([200, 210, 220]))).toBeNull();
    expect(consumptionAlert(months([100, 400]))).toBeNull();
  });
});
