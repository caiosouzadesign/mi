import { describe, expect, it } from "vitest";
import { gmailScript } from "@/lib/gmail-script";

/** Executa o script gerado fora do Google, com GmailApp/UrlFetchApp falsos */
function load(script: string, fakes: Record<string, unknown> = {}) {
  const names = Object.keys(fakes);
  return new Function(...names, `${script}; return { remetenteAutenticado, processarEmails, testar, SITE_URL, INGEST_SECRET };`)(
    ...names.map((n) => fakes[n]),
  );
}

const msg = (from: string, headers: string, extra: Record<string, unknown> = {}) => ({
  getFrom: () => from,
  getRawContent: () => `${headers}\r\n\r\ncorpo`,
  getSubject: () => "Aviso de interrupção programada",
  getPlainBody: () => "Haverá interrupção no dia 05/12 das 8h às 17h.",
  getAttachments: () => [],
  ...extra,
});
const AUTH_OK = "Authentication-Results: mx.google.com;\r\n       dkim=pass header.i=@enel.com;\r\n       dmarc=pass (p=REJECT) header.from=enel.com";

describe("script do Gmail gerado pelo painel", () => {
  it("vem preenchido e sem quebrar com aspas no segredo", () => {
    const s = load(gmailScript("https://meu-site.vercel.app/", 'abc"def\\ghi'));
    expect(s.SITE_URL).toBe("https://meu-site.vercel.app");
    expect(s.INGEST_SECRET).toBe('abc"def\\ghi');
  });

  it("só aceita remetente autenticado pelo Gmail", () => {
    const s = load(gmailScript("https://x", "y"));
    expect(s.remetenteAutenticado(msg("Enel <conta@enel.com>", AUTH_OK))).toBe(true);
    expect(s.remetenteAutenticado(msg("Enel <contas@enel-pagamentos.com>", AUTH_OK))).toBe(false);
    const forged = "Authentication-Results: mx.google.com; dmarc=fail header.from=enel.com\r\nX: y\r\nAuthentication-Results: mx.google.com; dmarc=pass header.from=enel.com";
    expect(s.remetenteAutenticado(msg("Enel <conta@enel.com>", forged))).toBe(false);
  });

  it("envia aviso autenticado, ignora o forjado e avisa o site no fim", () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const labels: string[] = [];
    const thread = (m: unknown) => ({ getMessages: () => [m], addLabel: (l: { name: string }) => labels.push(l.name) });
    const fakes = {
      GmailApp: {
        getUserLabelByName: (name: string) => ({ name }),
        createLabel: (name: string) => ({ name }),
        search: () => [thread(msg("Sabesp <avisos@sabesp.com.br>", AUTH_OK.replaceAll("enel.com", "sabesp.com.br"))), thread(msg("Enel <x@enel.com>", "Received: x"))],
      },
      UrlFetchApp: {
        fetch: (url: string, opts: { payload: string; headers: Record<string, string> }) => {
          expect(opts.headers.Authorization).toBe("Bearer segredo");
          sent.push({ url, body: JSON.parse(opts.payload) });
          return { getResponseCode: () => 200, getContentText: () => "{}" };
        },
      },
      Utilities: { base64Encode: () => "" },
      ScriptApp: {},
      console: { log: () => {} },
    };
    load(gmailScript("https://site", "segredo"), fakes).processarEmails();
    expect(sent.map((s) => s.body.type)).toEqual(["notice", "ping"]);
    expect(sent[1].body).toMatchObject({ processed: 1, suspicious: 1 });
    expect(labels).toEqual(["contas-processadas", "contas-suspeitas"]);
    expect(sent[0].url).toBe("https://site/api/ingest");
  });
});
