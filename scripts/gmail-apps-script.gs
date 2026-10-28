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

// Ajuste se as contas chegarem de outros remetentes
const QUERY =
  "(from:enel.com OR from:sabesp.com.br OR from:enel OR from:sabesp) newer_than:60d -label:contas-processadas";
const LABEL = "contas-processadas";

function instalar() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("processarEmails").timeBased().everyHours(1).create();
  processarEmails();
}

function processarEmails() {
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const threads = GmailApp.search(QUERY, 0, 30);

  threads.forEach((thread) => {
    let ok = true;
    thread.getMessages().forEach((msg) => {
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
    // só marca como processado se tudo deu certo; senão tenta de novo na próxima hora
    if (ok) thread.addLabel(label);
  });
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
