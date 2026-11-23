import { describe, expect, it } from "vitest";
import { configProblem } from "@/lib/auth";
import { billMessage, needsDueReminder } from "@/lib/bill-notify";
import { companyCode, reviewReasons } from "@/lib/fraud";
import { evaluate } from "@/lib/rate-limit";
import { safeExternalUrl, sniffImage, sniffMime } from "@/lib/upload-safety";
import { barcodeToDigitable } from "@/lib/parser/barcode";
import { makeBarcode } from "./helpers";

const bytes = (s: string | number[]) => (typeof s === "string" ? new TextEncoder().encode(s) : new Uint8Array(s));

describe("tipo de arquivo pelos bytes", () => {
  it("reconhece PDF e imagens comuns", () => {
    expect(sniffMime(bytes("%PDF-1.7\n..."))).toBe("application/pdf");
    expect(sniffMime(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(bytes("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffMime(bytes("\0\0\0\x18ftypheic"))).toBe("image/heic");
  });
  it("recusa HTML/SVG disfarçados, mesmo com nome de imagem", () => {
    expect(sniffMime(bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffMime(bytes("<html><script>fetch('/admin')</script>"))).toBeNull();
    expect(sniffImage(bytes("%PDF-1.4"))).toBeNull();
  });
});

describe("links vindos de serviços externos", () => {
  it("só aceita https ou caminho interno", () => {
    expect(safeExternalUrl("https://app.zapsign.com.br/verificar/x")).toBe("https://app.zapsign.com.br/verificar/x");
    expect(safeExternalUrl("/d/abc")).toBe("/d/abc");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://exemplo.com")).toBeNull();
    expect(safeExternalUrl("//golpe.com/x")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("boleto falso (contas por e-mail)", () => {
  const enel = (cents: number, free = "0048123456789012345678901") => barcodeToDigitable(makeBarcode("3", "6", cents, free))!;
  const history = [{ digitable: enel(18000), amountCents: 18000 }, { digitable: enel(19000), amountCents: 19000 }];

  it("libera conta parecida com as anteriores", () => {
    expect(reviewReasons({ provider: "enel", digitable: enel(20000), amountCents: 20000 }, history)).toEqual([]);
  });
  it("segura a primeira conta do imóvel", () => {
    expect(reviewReasons({ provider: "enel", digitable: enel(20000), amountCents: 20000 }, [])).toContain("Primeira conta desta distribuidora neste imóvel");
  });
  it("segura código de empresa diferente (outro favorecido)", () => {
    const fake = barcodeToDigitable(makeBarcode("3", "6", 20000, "0048123456789012345678901", "9999"))!;
    expect(companyCode(fake)).toBe("9999");
    expect(companyCode(enel(1))).toBe("0123");
    expect(reviewReasons({ provider: "enel", digitable: fake, amountCents: 20000 }, history).join()).toMatch(/possível boleto falso/);
  });
  it("segura conta sem código de barras, de outro segmento ou com valor absurdo", () => {
    expect(reviewReasons({ provider: "enel", digitable: null, amountCents: 1 }, history)[0]).toMatch(/Sem código de barras/);
    const agua = barcodeToDigitable(makeBarcode("2", "6", 20000))!;
    expect(reviewReasons({ provider: "enel", digitable: agua, amountCents: 20000 }, history).join()).toMatch(/não é de conta/);
    expect(reviewReasons({ provider: "enel", digitable: enel(90000), amountCents: 90000 }, history)).toContain("Valor muito acima do normal");
  });
});

describe("limite de tentativas de login", () => {
  const limits = [{ max: 5, windowMs: 900_000 }, { max: 50, windowMs: 3_600_000 }];
  it("bloqueia após 5 erros e libera depois da janela", () => {
    const now = 1_000_000_000;
    expect(evaluate([{ failures: 4, windowStart: now - 1000 }, { failures: 4, windowStart: now - 1000 }], limits, now).allowed).toBe(true);
    const blocked = evaluate([{ failures: 5, windowStart: now - 60_000 }, { failures: 5, windowStart: now - 60_000 }], limits, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(840_000);
    expect(evaluate([{ failures: 5, windowStart: now - 900_000 }, { failures: 5, windowStart: now - 900_000 }], limits, now).allowed).toBe(true);
  });
  it("o limite global segura ataque de vários IPs", () => {
    const now = 1_000_000_000;
    expect(evaluate([{ failures: 0, windowStart: 0 }, { failures: 50, windowStart: now - 10 }], limits, now).allowed).toBe(false);
  });
});

describe("configuração de produção", () => {
  it("recusa senha e segredo fracos em produção", () => {
    const prod = { NODE_ENV: "production" } as const;
    expect(configProblem({ ...prod, ADMIN_PASSWORD: "123456", SESSION_SECRET: "x".repeat(40) } as NodeJS.ProcessEnv)).toMatch(/12 caracteres/);
    expect(configProblem({ ...prod, ADMIN_PASSWORD: "uma-senha-bem-longa", SESSION_SECRET: "curto" } as NodeJS.ProcessEnv)).toMatch(/32 caracteres/);
    expect(configProblem({ ...prod, ADMIN_PASSWORD: "uma-senha-bem-longa", SESSION_SECRET: "x".repeat(40) } as NodeJS.ProcessEnv)).toBeNull();
    expect(configProblem({ NODE_ENV: "development", ADMIN_PASSWORD: "demo", SESSION_SECRET: "x" } as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("avisos de conta", () => {
  it("lembra só contas pendentes que vencem em até 3 dias, uma vez", () => {
    expect(needsDueReminder({ status: "pendente", dueDate: "2026-11-25", dueRemindedAt: null }, "2026-11-23")).toBe(true);
    expect(needsDueReminder({ status: "pendente", dueDate: "2026-11-30", dueRemindedAt: null }, "2026-11-23")).toBe(false);
    expect(needsDueReminder({ status: "pendente", dueDate: "2026-11-25", dueRemindedAt: "2026-11-22" }, "2026-11-23")).toBe(false);
    expect(needsDueReminder({ status: "pago", dueDate: "2026-11-25", dueRemindedAt: null }, "2026-11-23")).toBe(false);
    expect(needsDueReminder({ status: "pendente", dueDate: "2026-11-20", dueRemindedAt: null }, "2026-11-23")).toBe(false);
  });
  it("monta a mensagem com valor, vencimento e link", () => {
    const msg = billMessage(
      { provider: "enel", referenceMonth: "2026-10", amountCents: 18735, dueDate: "2026-11-10", digitable: null },
      { tenantName: "Ana Souza", link: "https://x/t/abc", kind: "nova" },
    );
    expect(msg).toContain("Olá, Ana! Chegou a conta Luz · Enel — out/2026.");
    expect(msg).toContain("R$ 187,35");
    expect(msg).toContain("https://x/t/abc");
  });
});
