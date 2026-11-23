import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillCard, PROVIDER_META } from "@/components/BillCard";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { consumptionAlert, consumptionDelta } from "@/lib/alerts";
import { brDate, brl, monthLabel } from "@/lib/format";
import Link from "next/link";
import { contractInfo } from "@/lib/contract";
import { billsForProperty, documentsForProperty, getPropertyByToken, latestByProvider, noticesForProperty, parseNotices, type BillSummary } from "@/lib/queries";
import { daysUntil, displayStatus, STATUS_LABEL } from "@/lib/status";
import { baseUrl } from "@/lib/url";
import { informPayment } from "./actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const property = await getPropertyByToken((await params).token);
  return { title: property ? `Contas · ${property.name}` : "Contas do Imóvel" };
}

const PROVIDERS = ["enel", "sabesp"] as const;
const COLORS = { enel: "var(--enel)", sabesp: "var(--sabesp)" };

function longDate() {
  const s = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function historyRow(b: BillSummary) {
  const status = displayStatus(b);
  const meta = b.provider ? PROVIDER_META[b.provider] : null;
  return (
    <div key={b.id} className="list-row">
      <span className={`tile sm ${b.provider ?? ""}`}>
        <Icon name={meta?.icon ?? "doc"} size={17} />
      </span>
      <div className="meta">
        <span className="title">
          {meta?.title ?? "Conta"} <span className="light">· {monthLabel(b.referenceMonth)}</span>
        </span>
        <span className="tiny">Venc. {brDate(b.dueDate)}</span>
      </div>
      <div className="end">
        <Money cents={b.amountCents} size="sm" />
        <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <a className="icon-btn" href={`/f/${b.shareToken}`} target="_blank" rel="noopener noreferrer" aria-label={`PDF ${meta?.title ?? ""} ${monthLabel(b.referenceMonth)}`}>
        <Icon name="doc" size={18} />
      </a>
    </div>
  );
}

export default async function TenantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await getPropertyByToken(token);
  if (!property) notFound();

  const [bills, notices, base, documents] = await Promise.all([
    billsForProperty(property.id, { tenant: true }),
    noticesForProperty(property.id),
    baseUrl(),
    documentsForProperty(property.id, { tenantOnly: true }),
  ]);
  const contract = contractInfo(property);
  const contractAlert = contract && contract.stage !== "ativo" ? contract : null;
  const toSign = documents.filter((d) => d.signatureStatus === "pending" && d.tenantSignUrl);
  const latest = latestByProvider(bills);
  const byProvider = (p: (typeof PROVIDERS)[number]) => bills.filter((b) => b.provider === p);

  // em destaque: a última de cada distribuidora + qualquer outra ainda não paga
  const featured = bills
    .filter((b) => b.status !== "pago" || b.id === latest.enel?.id || b.id === latest.sabesp?.id)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const open = bills.filter((b) => b.status === "pendente");
  const openTotal = open.reduce((s, b) => s + (b.amountCents ?? 0), 0);
  const nextDue = open.filter((b) => b.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];

  const overdue = bills.filter((b) => displayStatus(b) === "vencida");
  const dueSoon = open.filter((b) => b.dueDate && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 3);
  const alerts = PROVIDERS.map((p) => ({ provider: p, alert: consumptionAlert(byProvider(p)) })).filter((a) => a.alert);
  const billNotices = PROVIDERS.flatMap((p) => {
    const bill = latest[p];
    return bill ? parseNotices(bill.notices).map((text) => ({ provider: p, text })) : [];
  });
  const charts = PROVIDERS.filter((p) => byProvider(p).filter((b) => b.consumption != null).length >= 2);
  const hasNotices = notices.length > 0 || billNotices.length > 0;


  return (
    <>

      <main className="page">
        <section className="intro">
          <span className="eyebrow">{longDate()}</span>
          <h1>
            <span className="light">Olá,</span> {property.tenantName ? property.tenantName.split(" ")[0] : "bem-vindo"}
          </h1>
          <p className="muted">
            {property.name}
            {property.address ? ` · ${property.address}` : ""}
          </p>
        </section>

        <div className="layout">
          <div className="col">
            <section className="hero" id="contas" aria-label="Resumo">
              <div className="stack-sm">
                <span className="eyebrow">{open.length ? "Total a pagar" : "Situação"}</span>
                {open.length ? (
                  <Money cents={openTotal} size="xl" />
                ) : (
                  <span style={{ fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Tudo em dia ✓</span>
                )}
                <span className="muted small">
                  {open.length
                    ? `${open.length} conta${open.length > 1 ? "s" : ""} em aberto${nextDue ? ` · próximo vencimento ${brDate(nextDue.dueDate)}` : ""}`
                    : "Nenhuma conta em aberto no momento."}
                </span>
              </div>
              <div className="hero-split">
                {PROVIDERS.map((p) => {
                  const bill = latest[p];
                  return (
                    <div key={p} className="hero-pill">
                      <span className="label">
                        <Icon name={PROVIDER_META[p].icon} size={15} />
                        {PROVIDER_META[p].title} · {bill ? monthLabel(bill.referenceMonth) : "—"}
                      </span>
                      <span className="value">{bill ? brl(bill.amountCents) : "Sem conta"}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {(overdue.length > 0 || dueSoon.length > 0 || alerts.length > 0 || contractAlert || toSign.length > 0) && (
              <section className="stack" aria-label="Alertas">
                {toSign.map((d) => (
                  <Link key={`d${d.id}`} href={`/t/${token}/imovel`} className="alert-card" style={{ color: "inherit", textDecoration: "none" }}>
                    <span className="tile sm info">
                      <Icon name="pen" size={18} />
                    </span>
                    <div className="body grow">
                      <span className="title">Documento para assinar</span>
                      <span className="text">{d.title} — toque para ver e assinar.</span>
                    </div>
                    <Icon name="chevron" size={18} />
                  </Link>
                ))}
                {contractAlert && (
                  <Link href={`/t/${token}/imovel`} className={`alert-card ${contractAlert.stage === "atencao" ? "warn" : "bad"}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <span className={`tile sm ${contractAlert.stage === "atencao" ? "warn" : "bad"}`}>
                      <Icon name="calendar" size={18} />
                    </span>
                    <div className="body grow">
                      <span className="title">
                        {contractAlert.daysLeft < 0 ? "Contrato encerrado" : `Contrato termina em ${contractAlert.daysLeft} dia${contractAlert.daysLeft === 1 ? "" : "s"}`}
                      </span>
                      <span className="text">{contractAlert.label}. Converse com o proprietário sobre a renovação.</span>
                    </div>
                    <Icon name="chevron" size={18} />
                  </Link>
                )}
                {overdue.map((b) => (
                  <div key={`o${b.id}`} className="alert-card bad">
                    <span className="tile sm bad">
                      <Icon name="alert" size={18} />
                    </span>
                    <div className="body">
                      <span className="title">
                        {b.provider ? PROVIDER_META[b.provider].title : "Conta"} de {monthLabel(b.referenceMonth)} vencida
                      </span>
                      <span className="text">
                        Venceu em {brDate(b.dueDate)} ({brl(b.amountCents)}). Pague o quanto antes para evitar juros e corte do fornecimento.
                      </span>
                    </div>
                  </div>
                ))}
                {dueSoon.map((b) => {
                  const days = daysUntil(b.dueDate!);
                  return (
                    <div key={`s${b.id}`} className="alert-card warn">
                      <span className="tile sm warn">
                        <Icon name="clock" size={18} />
                      </span>
                      <div className="body">
                        <span className="title">
                          {b.provider ? PROVIDER_META[b.provider].title : "Conta"} vence {days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}
                        </span>
                        <span className="text">
                          {brl(b.amountCents)} · vencimento {brDate(b.dueDate)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {alerts.map(({ provider, alert }) => (
                  <div key={`c${provider}`} className="alert-card warn">
                    <span className="tile sm warn">
                      <Icon name="trend" size={18} />
                    </span>
                    <div className="body">
                      <span className="title">
                        Consumo de {provider === "enel" ? "luz" : "água"} {alert!.percent}% acima da média
                      </span>
                      <span className="text">
                        {alert!.latest.toLocaleString("pt-BR")} {provider === "enel" ? "kWh" : "m³"} no último mês, contra média de{" "}
                        {Math.round(alert!.average).toLocaleString("pt-BR")} nos meses anteriores.
                        {provider === "sabesp"
                          ? " Vale verificar vazamentos (descarga, torneiras, caixa d'água)."
                          : " Vale verificar chuveiro, ar-condicionado e aparelhos ligados."}
                      </span>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {featured.length === 0 && (
              <div className="card" style={{ justifyItems: "center", textAlign: "center", padding: "36px 20px" }}>
                <span className="tile lg info">
                  <Icon name="receipt" size={24} />
                </span>
                <div className="stack-sm">
                  <h3>Nenhuma conta ainda</h3>
                  <p className="small muted">Assim que as contas chegarem, elas aparecem aqui.</p>
                </div>
              </div>
            )}
            {featured.map((bill) => (
              <BillCard
                key={bill.id}
                bill={bill}
                baseUrl={base}
                consumptionDelta={bill.provider ? consumptionDelta(byProvider(bill.provider), bill.referenceMonth) : null}
                onInformPayment={informPayment.bind(null, token, bill.id)}
              />
            ))}

            {bills.length > 0 && (
              <section className="card" id="historico" aria-label="Histórico">
                <div className="row between">
                  <h2>Histórico</h2>
                  <span className="tiny">
                    {bills.length} conta{bills.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="list">{bills.slice(0, 6).map(historyRow)}</div>
                {bills.length > 6 && (
                  <details className="disclosure">
                    <summary className="small">
                      <Icon name="chevron" size={16} />
                      Ver mais {bills.length - 6}
                    </summary>
                    <div className="list">{bills.slice(6).map(historyRow)}</div>
                  </details>
                )}
              </section>
            )}
          </div>

          <aside className="col side">
            {charts.length > 0 && (
              <section className="card" id="consumo" aria-label="Consumo">
                <h2>Consumo mês a mês</h2>
                {charts.map((p, i) => (
                  <div key={p} className="stack">
                    {i > 0 && <hr className="divider" />}
                    <ConsumptionChart
                      points={byProvider(p)}
                      color={COLORS[p]}
                      title={PROVIDER_META[p].title}
                      delta={consumptionDelta(byProvider(p), latest[p]?.referenceMonth ?? null)}
                    />
                  </div>
                ))}
              </section>
            )}

            {hasNotices && (
              <section className="card" id="avisos" aria-label="Avisos">
                <h2>Avisos</h2>
                <div className="list">
                  {notices.map((n) => (
                    <div key={`n${n.id}`} className="list-row notice">
                      <span className={`tile sm ${n.provider ?? "info"}`}>
                        <Icon name={n.provider ? PROVIDER_META[n.provider].icon : "bell"} size={17} />
                      </span>
                      <div className="body">
                        <span className="title">{n.title}</span>
                        {n.summary ? (
                          <>
                            <span className="text">{n.summary}</span>
                            {n.eventInfo && (
                              <span className="chip plain" style={{ justifySelf: "start" }}>
                                <Icon name="calendar" size={13} />
                                {n.eventInfo}
                              </span>
                            )}
                            {n.body && (
                              <details className="disclosure">
                                <summary className="small">
                                  <Icon name="chevron" size={14} />
                                  Ver aviso completo
                                </summary>
                                <p className="inset small" style={{ whiteSpace: "pre-line", maxHeight: 280, overflow: "auto" }}>
                                  {n.body}
                                </p>
                              </details>
                            )}
                          </>
                        ) : (
                          n.body && (
                            <span className="text" style={{ whiteSpace: "pre-line" }}>
                              {n.body}
                            </span>
                          )
                        )}
                        <span className="tiny">
                          {n.provider ? `${PROVIDER_META[n.provider].company} · ` : ""}
                          {brDate(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {billNotices.map((n, i) => (
                    <div key={`b${i}`} className="list-row notice">
                      <span className={`tile sm ${n.provider}`}>
                        <Icon name="doc" size={17} />
                      </span>
                      <div className="body">
                        <span className="text">{n.text}</span>
                        <span className="tiny">Na conta {PROVIDER_META[n.provider].company}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="footer-note">As contas estão no nome do proprietário. Dúvidas? Fale com ele pelo WhatsApp.</p>
          </aside>
        </div>
      </main>

    </>
  );
}
