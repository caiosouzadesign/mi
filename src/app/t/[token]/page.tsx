import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BillCard } from "@/components/BillCard";
import { ConsumptionChart } from "@/components/ConsumptionChart";
import { consumptionAlert } from "@/lib/alerts";
import { brDate, brl, monthLabel, PROVIDER_LABEL } from "@/lib/format";
import { billsForProperty, getPropertyByToken, latestByProvider, noticesForProperty, parseNotices } from "@/lib/queries";
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

export default async function TenantPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await getPropertyByToken(token);
  if (!property) notFound();

  const [bills, notices, base] = await Promise.all([billsForProperty(property.id), noticesForProperty(property.id), baseUrl()]);
  const latest = latestByProvider(bills);

  // em destaque: a última de cada distribuidora + qualquer outra ainda não paga
  const featured = bills
    .filter((b) => b.status !== "pago" || b.id === latest.enel?.id || b.id === latest.sabesp?.id)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  const overdue = bills.filter((b) => displayStatus(b) === "vencida");
  const dueSoon = bills.filter((b) => b.status === "pendente" && b.dueDate && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 3);
  const alerts = PROVIDERS.map((p) => ({ provider: p, alert: consumptionAlert(bills.filter((b) => b.provider === p)) })).filter(
    (a) => a.alert,
  );
  const billNotices = PROVIDERS.flatMap((p) => {
    const bill = latest[p];
    return bill ? parseNotices(bill.notices).map((text) => ({ provider: p, text })) : [];
  });

  return (
    <main className="container">
      <header className="header">
        <div className="stack" style={{ gap: 4 }}>
          <span className="brand">Contas do imóvel</span>
          <h1>{property.name}</h1>
          {property.address && <p className="small muted">{property.address}</p>}
        </div>
      </header>
      {property.tenantName && <p className="muted">Olá, {property.tenantName.split(" ")[0]}! Aqui estão suas contas de água e luz.</p>}

      {(overdue.length > 0 || dueSoon.length > 0 || alerts.length > 0) && (
        <section className="stack" aria-label="Alertas">
          {overdue.map((b) => (
            <div key={`o${b.id}`} className="alert bad">
              <strong>⚠ {b.provider ? PROVIDER_LABEL[b.provider] : "Conta"} de {monthLabel(b.referenceMonth)} vencida</strong>
              <span>
                Venceu em {brDate(b.dueDate)} ({brl(b.amountCents)}). Pague o quanto antes para evitar juros e corte do fornecimento.
              </span>
            </div>
          ))}
          {dueSoon.map((b) => {
            const days = daysUntil(b.dueDate!);
            return (
              <div key={`s${b.id}`} className="alert warn">
                <strong>⏰ {b.provider ? PROVIDER_LABEL[b.provider] : "Conta"} vence {days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}</strong>
                <span>
                  {brl(b.amountCents)} — vencimento {brDate(b.dueDate)}.
                </span>
              </div>
            );
          })}
          {alerts.map(({ provider, alert }) => (
            <div key={`c${provider}`} className="alert warn">
              <strong>
                📈 Consumo de {provider === "enel" ? "luz" : "água"} {alert!.percent}% acima da média
              </strong>
              <span>
                {alert!.latest.toLocaleString("pt-BR")} {provider === "enel" ? "kWh" : "m³"} no último mês, contra média de{" "}
                {Math.round(alert!.average).toLocaleString("pt-BR")} nos meses anteriores.
                {provider === "sabesp"
                  ? " Vale verificar vazamentos (descarga, torneiras, caixa d'água)."
                  : " Vale verificar chuveiro, ar-condicionado e aparelhos ligados."}
              </span>
            </div>
          ))}
        </section>
      )}

      {featured.length === 0 && (
        <div className="card">
          <p className="muted">Nenhuma conta disponível ainda. Assim que chegarem, aparecem aqui.</p>
        </div>
      )}
      {featured.map((bill) => (
        <BillCard key={bill.id} bill={bill} baseUrl={base} onInformPayment={informPayment.bind(null, token, bill.id)} />
      ))}

      {(notices.length > 0 || billNotices.length > 0) && (
        <section className="card" aria-label="Avisos">
          <h2>Avisos</h2>
          {notices.map((n) => (
            <div key={`n${n.id}`} className="alert info">
              <strong>
                {n.provider ? `${PROVIDER_LABEL[n.provider]}: ` : ""}
                {n.title}
              </strong>
              {n.body && <span className="small" style={{ whiteSpace: "pre-line" }}>{n.body}</span>}
              <span className="tiny">{brDate(n.createdAt)}</span>
            </div>
          ))}
          {billNotices.map((n, i) => (
            <div key={`b${i}`} className="alert info">
              <span className="tiny">Na conta {PROVIDER_LABEL[n.provider]}</span>
              <span className="small">{n.text}</span>
            </div>
          ))}
        </section>
      )}

      {PROVIDERS.some((p) => bills.filter((b) => b.provider === p && b.consumption != null).length >= 2) && (
        <section className="card" aria-label="Consumo">
          <h2>Consumo mês a mês</h2>
          {PROVIDERS.map((p) => {
            const points = bills.filter((b) => b.provider === p);
            if (points.filter((b) => b.consumption != null).length < 2) return null;
            return (
              <div key={p} className="stack" style={{ gap: 4 }}>
                <h3 className="small muted">{PROVIDER_LABEL[p]}</h3>
                <ConsumptionChart points={points} color={COLORS[p]} title={`Consumo ${PROVIDER_LABEL[p]}`} />
              </div>
            );
          })}
        </section>
      )}

      {bills.length > 0 && (
        <section className="card" aria-label="Histórico">
          <h2>Histórico</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Conta</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const status = displayStatus(b);
                  return (
                    <tr key={b.id}>
                      <td>{monthLabel(b.referenceMonth)}</td>
                      <td>{b.provider === "enel" ? "Luz" : b.provider === "sabesp" ? "Água" : "—"}</td>
                      <td>{brl(b.amountCents)}</td>
                      <td>
                        <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>
                      </td>
                      <td>
                        <a className="small" href={`/f/${b.shareToken}`} target="_blank" rel="noopener noreferrer">
                          PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="tiny" style={{ textAlign: "center" }}>
        As contas estão no nome do proprietário. Dúvidas? Fale com ele pelo WhatsApp.
      </p>
    </main>
  );
}
