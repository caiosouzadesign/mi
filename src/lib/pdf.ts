import { extractText, getDocumentProxy } from "unpdf";

function passwords(): (string | undefined)[] {
  const fromEnv = (process.env.PDF_PASSWORDS ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return [undefined, ...fromEnv];
}

/** Extrai o texto de um PDF, tentando as senhas de PDF_PASSWORDS se ele for protegido. */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  let lastError: unknown;
  for (const password of passwords()) {
    try {
      // pdf.js transfere (e esvazia) o buffer recebido, então passamos uma cópia
      const doc = await getDocumentProxy(new Uint8Array(bytes), password ? { password } : {});
      const { text } = await extractText(doc, { mergePages: false });
      return text.join("\n");
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Não foi possível ler o PDF: ${lastError instanceof Error ? lastError.message : lastError}`);
}
