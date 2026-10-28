import { describe, expect, it } from "vitest";
import { pdfToText } from "@/lib/pdf";
import { parseBillText } from "@/lib/parser";
import { matchProperty } from "@/lib/ingest";
import { makeFormattedDigitable, makePdf } from "./helpers";

describe("PDF -> conta", () => {
  it("extrai o texto de um PDF e identifica o imóvel", async () => {
    const pdf = await makePdf([
      "ENEL DISTRIBUICAO SAO PAULO",
      "No DA INSTALACAO 12345678",
      "REFERENCIA OUT/2026   VENCIMENTO 10/11/2026",
      "Consumo kWh 245",
      makeFormattedDigitable("3", "6", 18_735),
    ]);
    const text = await pdfToText(pdf);
    const bill = parseBillText(text);
    expect(bill).toMatchObject({ provider: "enel", amountCents: 18_735, dueDate: "2026-11-10", consumption: 245 });
    const props = [
      { id: 1, enelInstallation: "87654321", sabespCode: null },
      { id: 2, enelInstallation: "1234567-8", sabespCode: "999" },
    ];
    expect(matchProperty(text, "enel", props)).toBe(2);
  });
});
