import { describe, expect, it } from "vitest";
import { contractInfo, contractMessage, dueReminder } from "@/lib/contract";
import { parseRemoteDoc } from "@/lib/signature/zapsign";
import { documentRefs } from "@/lib/signature/webhook";

describe("contractInfo", () => {
  const c = (end: string, start: string | null = "2025-01-01") => ({ contractStart: start, contractEnd: end });
  it("classifica pelo tempo restante", () => {
    expect(contractInfo(c("2027-06-01"), "2026-11-02")?.stage).toBe("ativo");
    expect(contractInfo(c("2027-01-15"), "2026-11-02")?.stage).toBe("atencao");
    expect(contractInfo(c("2026-11-20"), "2026-11-02")).toMatchObject({ stage: "urgente", daysLeft: 18 });
    expect(contractInfo(c("2026-10-01"), "2026-11-02")?.stage).toBe("vencido");
    expect(contractInfo({ contractStart: null, contractEnd: null })).toBeNull();
  });
  it("calcula o progresso do prazo", () => {
    expect(contractInfo(c("2027-01-01", "2026-01-01"), "2026-07-02")?.progress).toBe(50);
    expect(contractInfo(c("2027-01-01", null), "2026-07-02")?.progress).toBeNull();
  });
});

describe("dueReminder", () => {
  it("avisa uma vez em cada limite (90, 60, 30, 0)", () => {
    expect(dueReminder(120, null)).toBeNull();
    expect(dueReminder(90, null)).toBe(90);
    expect(dueReminder(85, 90)).toBeNull();
    expect(dueReminder(59, 90)).toBe(60);
    expect(dueReminder(10, 60)).toBe(30);
    expect(dueReminder(10, 30)).toBeNull();
    expect(dueReminder(-3, 30)).toBe(0);
    expect(dueReminder(-3, 0)).toBeNull();
  });
  it("cadastrar um contrato já perto do fim manda só o lembrete atual", () => {
    expect(dueReminder(20, null)).toBe(30);
  });
});

describe("contractMessage", () => {
  it("monta a mensagem para o inquilino", () => {
    const msg = contractMessage({ tenantName: "Ana Souza", propertyName: "Apto", contractEnd: "2027-01-15", daysLeft: 74, link: "https://x/t/abc/imovel" });
    expect(msg).toContain("Olá, Ana!");
    expect(msg).toContain("15/01/2027 (daqui a 74 dias)");
    expect(msg).toContain("https://x/t/abc/imovel");
  });
});

describe("ZapSign", () => {
  it("interpreta o documento e monta o link de assinatura se faltar", () => {
    const doc = parseRemoteDoc({
      token: "doc-1",
      status: "pending",
      signers: [
        { name: "Ana", email: "ana@x.com", status: "new", sign_url: "https://app.zapsign.com.br/verificar/s1" },
        { name: "Dono", token: "s2", status: "new" },
      ],
    });
    expect(doc).toMatchObject({ ref: "doc-1", status: "pending", signedFileUrl: null });
    expect(doc.signers[0].signUrl).toBe("https://app.zapsign.com.br/verificar/s1");
    expect(doc.signers[1].signUrl).toBe("https://app.zapsign.com.br/verificar/s2");
    expect(parseRemoteDoc({ token: "d", status: "signed", signed_file: "https://s3/x.pdf" })).toMatchObject({ status: "signed", signedFileUrl: "https://s3/x.pdf" });
  });

  it("encontra o documento em formatos diferentes de webhook", () => {
    expect(documentRefs({ token: "a", event_type: "doc_signed" })).toEqual(["a"]);
    expect(documentRefs({ event: "document.signed", data: { document: { token: "b" } } })).toEqual(["b"]);
    expect(documentRefs({ data: { signer: { token: "signer-token" } } })).toEqual([]);
    expect(documentRefs(null)).toEqual([]);
  });
});
