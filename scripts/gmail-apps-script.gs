/**
 * Contas do Imóvel — leitor do Gmail
 *
 * Roda na sua conta Google (script.google.com), procura e-mails da Enel e da
 * Sabesp e envia os PDFs das contas (e os avisos sem PDF) para o seu site.
 *
 * Como instalar (uma vez, pelo computador):
 *  1. Acesse https://script.google.com > Novo projeto e cole este arquivo.
 *  2. Preencha SITE_URL e INGEST_SECRET abaixo (o mesmo valor da Vercel).
 *  3. Selecione a função "instalar" e clique em Executar. Autorize o acesso ao Gmail.
 *     Isso cria um gatilho que roda a cada hora e já processa os e-mails dos últimos 60 dias.
 */

const SITE_URL = "https://SEU-SITE.vercel.app"; // sem barra no final
const INGEST_SECRET = "cole-aqui-o-INGEST_SECRET";

// Domínios oficiais. Só e-mails AUTENTICADOS (DMARC/DKIM) desses domínios são
// importados. Se uma conta verdadeira cair no marcador "contas-suspeitas",
// confira o remetente e acrescente o domínio dele aqui.
const DOMINIOS_CONFIAVEIS = ["enel.com", "enel.com.br", "enelbrasil.com.br", "sabesp.com.br"];

const QUERY =
  "(from:enel.com OR from:enel.com.br OR from:enelbrasil.com.br OR from:sabesp.com.br) newer_than:60d -label:contas-processadas -label:contas-suspeitas";
const LABEL = "contas-processadas";
const LABEL_SUSPEITO = "contas-suspeitas";

function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("processarEmails").timeBased().everyHours(1).create();
  processarEmails();
}

function processarEmails() {
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const suspeito = GmailApp.getUserLabelByName(LABEL_SUSPEITO) || GmailApp.createLabel(LABEL_SUSPEITO);
  const threads = GmailApp.search(QUERY, 0, 30);

  threads.forEach((thread) => {
    let ok = true;
    let suspeita = false;
    thread.getMessages().forEach((msg) => {
      // golpistas imitam o nome "Enel"/"Sabesp" no remetente: exige autenticação do Google
      if (!remetenteAutenticado(msg)) {
        suspeita = true;
        console.log("ignorado (remetente não autenticado):", msg.getFrom(), msg.getSubject());
        return;
      }
      const pdfs = msg.getAttachments().filter((a) => /pdf/i.test(a.getContentType()) || /\.pdf$/i.test(a.getName()));
      if (pdfs.length > 0) {
        pdfs.forEach((pdf) => {
          ok =
            enviar({
              type: "bill",
              filename: pdf.getName(),
              contentBase64: Utilities.base64Encode(pdf.getBytes()),
              from: msg.getFrom(),
              subject: msg.getSubject(),
            }) && ok;
        });
      } else if (pareceAviso(msg.getSubject())) {
        ok =
          enviar({
            type: "notice",
            from: msg.getFrom(),
            subject: msg.getSubject(),
            body: msg.getPlainBody().slice(0, 4000),
          }) && ok;
      }
    });
    if (suspeita) thread.addLabel(suspeito);
    // só marca como processado se tudo deu certo; senão tenta de novo na próxima hora
    else if (ok) thread.addLabel(label);
  });
}

/** Domínio do remetente visível ("Fulano <contas@enel.com>" -> "enel.com") */
function dominioDoRemetente(from) {
  const m = String(from || "").match(/@([A-Za-z0-9.-]+)>?\s*$/);
  return m ? m[1].toLowerCase() : "";
}

function dominioConfiavel(dominio) {
  return DOMINIOS_CONFIAVEIS.some((d) => dominio === d || dominio.endsWith("." + d));
}

/**
 * Usa o resultado da verificação que o próprio Gmail grava no cabeçalho
 * Authentication-Results: DMARC aprovado para o domínio do remetente, ou DKIM
 * aprovado assinado pelo mesmo domínio.
 */
function remetenteAutenticado(msg) {
  const dominio = dominioDoRemetente(msg.getFrom());
  if (!dominioConfiavel(dominio)) return false;
  const raw = msg.getRawContent();
  const cabecalhos = raw.slice(0, raw.search(/\r?\n\r?\n/));
  // só vale o PRIMEIRO Authentication-Results (o do topo, gravado pelo Gmail na
  // chegada); cabeçalhos iguais mais abaixo podem ter sido forjados pelo remetente
  const linha = (cabecalhos.replace(/\r?\n[ \t]+/g, " ").match(/^Authentication-Results:.*$/im) || [""])[0];
  if (!/^Authentication-Results:\s*mx\.google\.com/i.test(linha)) return false;
  const dmarc = linha.match(/dmarc=pass[^;]*header\.from=([A-Za-z0-9.-]+)/i);
  if (dmarc && dmarc[1].toLowerCase() === dominio) return true;
  const dkim = linha.match(/dkim=pass[^;]*header\.(?:i|d)=@?([A-Za-z0-9.-]+)/i);
  return !!(dkim && (dkim[1].toLowerCase() === dominio || dominio.endsWith("." + dkim[1].toLowerCase())));
}

function pareceAviso(assunto) {
  return /aviso|interrup|desligamento|manuten|falta d|abastecimento|reajuste|bandeira|corte|suspens|d[eé]bito/i.test(assunto || "");
}

function enviar(payload) {
  const res = UrlFetchApp.fetch(SITE_URL + "/api/ingest", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + INGEST_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  console.log(payload.type, payload.subject, code, res.getContentText().slice(0, 300));
  // 422 = PDF ilegível (ex.: senha); não adianta tentar de novo
  return code === 200 || code === 422;
}
