import { describe, expect, it } from "vitest";
import { findEventInfo, heuristicSummary, parseModelOutput, summarizeNotice, type SummaryClient } from "@/lib/summarize";

const email = {
  provider: "sabesp" as const,
  subject: "RES: [Sabesp] Aviso de manutenção programada na rede",
  body: `Prezado cliente,

A Sabesp informa que realizará manutenção na rede de distribuição da Rua Modelo e arredores no dia 05/12/2026, das 8h às 17h.
Durante o serviço poderá haver falta de água. A previsão de retorno do abastecimento é às 22h.
Recomendamos manter a caixa d'água abastecida.

Baixe o app Sabesp Mobile na Google Play.
Este e-mail é automático, não responda.`,
};

describe("resumo simples (sem IA)", () => {
  it("limpa o assunto e pega as frases importantes", () => {
    const s = heuristicSummary(email);
    expect(s.title).toBe("Aviso de manutenção programada na rede");
    expect(s.summary).toMatch(/^Realizará manutenção na rede/);
    expect(heuristicSummary({ ...email, subject: "Desligamento programado - instalação 11223344" }).title).toBe("Desligamento programado");
    expect(s.summary).not.toMatch(/app|não responda/i);
    expect(s.summary.length).toBeLessThanOrEqual(200);
    expect(s.source).toBe("auto");
  });
  it("acha data e horário", () => {
    expect(findEventInfo("no dia 05/12/2026, das 8h às 17h")).toBe("05/12/2026, das 8h às 17h");
    expect(findEventInfo("entre 08:00 às 12:30")).toBe("das 08h às 12:30");
    expect(findEventInfo("sem data nenhuma")).toBeNull();
  });
});

function fakeClient(response: unknown, captured: unknown[] = []): SummaryClient {
  return {
    beta: {
      messages: {
        create: (async (params: unknown) => {
          captured.push(params);
          if (response instanceof Error) throw response;
          return response;
        }) as unknown as SummaryClient["beta"]["messages"]["create"],
      },
    },
  };
}

const ok = (json: object) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(json) }] });

describe("resumo com o Claude", () => {
  it("usa a resposta estruturada do modelo", async () => {
    const captured: Record<string, unknown>[] = [];
    const s = await summarizeNotice(
      email,
      fakeClient(ok({ titulo: "Falta de água programada", resumo: "Manutenção na Rua Modelo pode deixar o imóvel sem água; volta prevista às 22h.", quando: "05/12, das 8h às 17h" }), captured),
    );
    expect(s).toEqual({ title: "Falta de água programada", summary: "Manutenção na Rua Modelo pode deixar o imóvel sem água; volta prevista às 22h.", eventInfo: "05/12, das 8h às 17h", source: "ia" });
    const params = captured[0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.output_config).toMatchObject({ effort: "low", format: { type: "json_schema" } });
    expect(JSON.stringify(params.messages)).toContain("<email>");
  });
  it("cai no resumo simples se o modelo recusar, sair do formato ou a API falhar", async () => {
    expect((await summarizeNotice(email, fakeClient({ stop_reason: "refusal", content: [] }))).source).toBe("auto");
    expect((await summarizeNotice(email, fakeClient({ stop_reason: "end_turn", content: [{ type: "text", text: "não é json" }] }))).source).toBe("auto");
    expect((await summarizeNotice(email, fakeClient(new Error("rede fora")))).source).toBe("auto");
  });
  it("corta respostas longas demais", () => {
    const parsed = parseModelOutput(JSON.stringify({ titulo: "x".repeat(200), resumo: "y".repeat(500), quando: "" }));
    expect(parsed!.title.length).toBeLessThanOrEqual(70);
    expect(parsed!.summary.length).toBeLessThanOrEqual(200);
    expect(parsed!.eventInfo).toBeNull();
    expect(parseModelOutput(JSON.stringify({ titulo: "", resumo: "a", quando: "" }))).toBeNull();
  });
});
