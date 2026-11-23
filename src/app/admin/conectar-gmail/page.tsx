import Link from "next/link";
import { AdminTopbar } from "@/components/AdminTopbar";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { GMAIL_LAST_RUN, GMAIL_LAST_SEEN, getState, type GmailRun } from "@/lib/app-state";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { gmailScript } from "@/lib/gmail-script";
import { aiEnabled } from "@/lib/summarize";
import { baseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conectar Gmail · Contas do Imóvel" };

export default async function ConnectGmailPage() {
  await requireAdmin();
  const [site, seen, run] = await Promise.all([baseUrl(), getState<boolean>(GMAIL_LAST_SEEN), getState<GmailRun>(GMAIL_LAST_RUN)]);
  const secret = process.env.INGEST_SECRET ?? "";
  const local = /localhost|127\.0\.0\.1/.test(site);
  const problems = [
    !secret && "Cadastre INGEST_SECRET nas variáveis de ambiente da Vercel e publique de novo.",
    secret && secret.length < 32 && "INGEST_SECRET está curto: use 32+ caracteres aleatórios (ex.: openssl rand -base64 32).",
    local && "Você está vendo o site no seu computador (localhost). O Google não consegue acessar esse endereço: faça este passo no site publicado.",
  ].filter(Boolean) as string[];
  const script = secret ? gmailScript(site, secret) : "";
  const preview = script.replace(JSON.stringify(secret), '"••••••••••••"');
  const recent = seen && Date.now() - new Date(seen.updatedAt).getTime() < 3 * 60 * 60_000;

  return (
    <>
      <AdminTopbar />
      <main className="page narrow">
        <section className="intro">
          <Link href="/admin" className="eyebrow row" style={{ gap: 4 }}>
            <Icon name="back" size={16} />
            Painel
          </Link>
          <h1>
            <span className="light">Conectar</span> Gmail
          </h1>
          <p className="muted">
            Um pequeno programa roda na sua conta Google, lê só os e-mails da Enel e da Sabesp e manda as contas e os avisos para cá,
            de hora em hora. Você faz isso uma vez, pelo computador.
          </p>
        </section>

        <section className="card">
          <div className="row" style={{ gap: 12 }}>
            <span className={`status-dot ${recent ? "ok" : seen ? "warn" : ""}`} aria-hidden />
            <div className="grow">
              <h2>{seen ? (recent ? "Conectado" : "Sem contato recente") : "Ainda não conectado"}</h2>
              <p className="small muted">
                {seen
                  ? `Último contato do Gmail ${timeAgo(seen.updatedAt)}.${run ? ` Na última rodada: ${run.value.processed} e-mail(s) importado(s)${run.value.suspicious ? `, ${run.value.suspicious} suspeito(s) ignorado(s)` : ""}.` : ""}`
                  : "Siga os passos abaixo. Quando terminar, este quadro fica verde."}
                {seen && !recent && " A rotina roda de hora em hora: se ficar assim por mais tempo, rode a função testar no script."}
              </p>
            </div>
          </div>
        </section>

        {problems.length > 0 && (
          <section className="stack">
            {problems.map((p) => (
              <div key={p} className="alert-card warn">
                <span className="tile sm warn">
                  <Icon name="alert" size={18} />
                </span>
                <div className="body">
                  <span className="text" style={{ color: "var(--text)" }}>
                    {p}
                  </span>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="card">
          <h2>Passo a passo</h2>
          <ol className="steps">
            <li>
              <div>
                <strong>Receba as contas por e-mail</strong>
                <span className="small muted">
                  No app ou site da <strong>Enel</strong>, ative a conta por e-mail (fatura digital) de cada instalação; na Agência Virtual da{" "}
                  <strong>Sabesp</strong>, ative a conta digital de cada RGI. Use o mesmo Gmail em que você vai instalar o script.
                </span>
              </div>
            </li>
            <li>
              <div>
                <strong>Crie um projeto no Google Apps Script</strong>
                <span className="small muted">
                  Entre com esse Gmail em{" "}
                  <a href="https://script.google.com" target="_blank" rel="noopener noreferrer">
                    script.google.com
                  </a>{" "}
                  e clique em <strong>Novo projeto</strong>. Se quiser, renomeie para “Contas do Imóvel”.
                </span>
              </div>
            </li>
            <li>
              <div>
                <strong>Cole o script</strong>
                <span className="small muted">
                  Apague o texto que já vem no editor, cole o script abaixo e clique no ícone de disquete para salvar. Ele já vem com o endereço
                  do seu site e a sua chave.
                </span>
                {script ? (
                  <div className="row">
                    <CopyButton className="btn primary" value={script} label="Copiar script" />
                    <details className="disclosure" style={{ flexBasis: "100%" }}>
                      <summary className="small">
                        <Icon name="chevron" size={14} />
                        Ver o script
                      </summary>
                      <pre className="inset mono tiny" style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto", margin: 0 }}>
                        {preview}
                      </pre>
                    </details>
                  </div>
                ) : (
                  <span className="form-error">Configure INGEST_SECRET primeiro (veja o aviso acima).</span>
                )}
                <span className="tiny">Não compartilhe o script: ele contém a chave secreta do seu site.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Rode a instalação</strong>
                <span className="small muted">
                  Na barra de cima do editor, escolha a função <strong className="mono">instalar</strong> e clique em <strong>Executar</strong>.
                  O Google vai pedir permissão:
                </span>
                <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                  <li>
                    clique em <strong>Revisar permissões</strong> e escolha sua conta;
                  </li>
                  <li>
                    vai aparecer “O Google não verificou este app”: é normal, porque o app é seu. Clique em <strong>Avançado</strong> e depois em{" "}
                    <strong>Acessar Contas do Imóvel (não seguro)</strong>;
                  </li>
                  <li>
                    confira as permissões (ler e marcar e-mails do Gmail, falar com o seu site) e clique em <strong>Permitir</strong>.
                  </li>
                </ul>
                <span className="small muted">
                  Ele processa os e-mails dos últimos 60 dias e passa a rodar sozinho de hora em hora.
                </span>
              </div>
            </li>
            <li>
              <div>
                <strong>Pronto</strong>
                <span className="small muted">
                  Atualize esta página: o quadro lá em cima fica <strong>Conectado</strong>. As contas aparecem nos imóveis, as suspeitas em{" "}
                  <em>Contas para conferir</em> e os avisos no sino de notificações. Para testar a qualquer momento, rode a função{" "}
                  <strong className="mono">testar</strong>.
                </span>
              </div>
            </li>
          </ol>
        </section>

        <section className="card">
          <h2>Bom saber</h2>
          <div className="list">
            <div className="list-row">
              <span className="tile sm info">
                <Icon name="eye" size={17} />
              </span>
              <div className="meta">
                <span className="title">O que o script lê</span>
                <span className="small muted">
                  Só e-mails de domínios oficiais da Enel e da Sabesp dos últimos 60 dias, e só se o Google confirmar que vieram mesmo
                  deles. Os lidos ganham o marcador <em>contas-processadas</em>; os falsificados, <em>contas-suspeitas</em>.
                </span>
              </div>
            </div>
            <div className="list-row">
              <span className="tile sm info">
                <Icon name="bell" size={17} />
              </span>
              <div className="meta">
                <span className="title">Resumo dos avisos {aiEnabled() ? "com IA: ligado" : "com IA: desligado"}</span>
                <span className="small muted">
                  {aiEnabled()
                    ? "O texto dos avisos (não as contas) é enviado à API do Claude, da Anthropic, só para gerar o resumo."
                    : "Os avisos são resumidos de forma simples. Para resumos melhores, cadastre ANTHROPIC_API_KEY na Vercel; o texto dos avisos (não as contas) passa a ser enviado à API do Claude para gerar o resumo."}
                </span>
              </div>
            </div>
            <div className="list-row">
              <span className="tile sm info">
                <Icon name="x" size={17} />
              </span>
              <div className="meta">
                <span className="title">Para desconectar</span>
                <span className="small muted">
                  No Apps Script, abra <strong>Acionadores</strong> (ícone de relógio) e apague a rotina, ou exclua o projeto. Para trocar a
                  chave, mude INGEST_SECRET na Vercel e cole o script de novo.
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
