import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { contractInfo, contractMessage, REMINDER_DAYS } from "@/lib/contract";
import { KIND_LABEL, SIGNATURE_LABEL, STAGE_LABEL } from "@/lib/documents";
import { brDate, whatsappNumber } from "@/lib/format";
import { emailConfigured } from "@/lib/notify";
import { documentsForProperty } from "@/lib/queries";
import { signatureConfigured } from "@/lib/signature";
import { baseUrl } from "@/lib/url";
import {
  deleteDocument,
  markDocumentSigned,
  refreshDocument,
  sendForSignature,
  toggleDocumentVisibility,
  updateContract,
  uploadDocument,
} from "../../../actions";
import { NotifyContract } from "../../NotifyContract";

export const dynamic = "force-dynamic";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const db = await getDb();
  const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, id));
  if (!property) notFound();
  const [documents, base] = await Promise.all([documentsForProperty(id), baseUrl()]);
  const info = contractInfo(property);
  const canSign = signatureConfigured();
  const link = `${base}/t/${property.accessToken}/imovel`;
  const message = info && property.contractEnd
    ? contractMessage({ tenantName: property.tenantName, propertyName: property.name, contractEnd: property.contractEnd, daysLeft: info.daysLeft, link })
    : null;
  const wa = whatsappNumber(property.tenantPhone);

  return (
    <div className="layout">
      <div className="col">
        <section className="card">
          <div className="row between">
            <h2>Contrato de locação</h2>
            {info && <span className={`chip ${info.stage}`}>{STAGE_LABEL[info.stage]}</span>}
          </div>
          {info && (
            <div className="inset stack-sm">
              <div className="contract-days">
                <span className="n" style={{ fontSize: "2.2rem" }}>
                  {Math.abs(info.daysLeft)}
                </span>
                <span className="u">{info.daysLeft < 0 ? "dias desde o fim" : `dia${info.daysLeft === 1 ? "" : "s"} para o fim`}</span>
              </div>
              {info.progress != null && (
                <div className={`progress ${info.stage === "atencao" ? "warn" : info.stage === "ativo" ? "" : "bad"}`}>
                  <span style={{ width: `${Math.max(3, info.progress)}%` }} />
                </div>
              )}
              <span className="tiny">{info.label}</span>
            </div>
          )}
          <form action={updateContract.bind(null, id)} className="stack" style={{ gap: 16 }}>
            <div className="form-grid">
              <label className="field">
                Início
                <input type="date" name="contractStart" defaultValue={property.contractStart ?? ""} />
              </label>
              <label className="field">
                Fim
                <input type="date" name="contractEnd" defaultValue={property.contractEnd ?? ""} required />
              </label>
              <label className="field">
                Aluguel (R$)
                <input name="rent" inputMode="decimal" placeholder="2.500,00" defaultValue={property.rentCents != null ? (property.rentCents / 100).toFixed(2).replace(".", ",") : ""} />
              </label>
            </div>
            <SubmitButton className="btn primary" pendingText="Salvando…">
              Salvar contrato
            </SubmitButton>
          </form>
        </section>

        <section className="card">
          <div className="stack-sm">
            <h2>Avisar o inquilino</h2>
            <p className="small muted">
              Lembretes automáticos {REMINDER_DAYS.filter((d) => d > 0).join(", ")} dias antes e no dia do fim: aparecem no portal
              {emailConfigured() ? " e vão por e-mail" : ""}.
              {property.contractReminderStage != null && ` Último lembrete: ${property.contractReminderStage === 0 ? "no dia do fim" : `${property.contractReminderStage} dias antes`}.`}
            </p>
          </div>
          {message ? (
            <>
              <div className="inset small" style={{ whiteSpace: "pre-line" }}>
                {message}
              </div>
              <NotifyContract
                propertyId={id}
                emailAutomatic={emailConfigured() && !!property.tenantEmail}
                whatsappUrl={wa ? `https://wa.me/${wa}?text=${encodeURIComponent(message)}` : null}
                emailUrl={property.tenantEmail ? `mailto:${property.tenantEmail}?subject=${encodeURIComponent(`Contrato de locação — ${property.name}`)}&body=${encodeURIComponent(message)}` : null}
              />
            </>
          ) : (
            <p className="small muted">Informe a data de fim do contrato para habilitar os avisos.</p>
          )}
        </section>
      </div>

      <aside className="col side">
        <section className="card">
          <div className="row between">
            <h2>Documentos</h2>
            <span className="tiny">{documents.length}</span>
          </div>
          {documents.length === 0 && <p className="small muted">Envie o contrato, aditivos ou o laudo de vistoria.</p>}
          <div className="list">
            {documents.map((d) => (
              <div key={d.id} className="list-row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
                <span className={`tile sm ${d.signatureStatus === "signed" ? "good" : "info"}`}>
                  <Icon name={d.signatureStatus === "signed" ? "checkCircle" : "doc"} size={17} />
                </span>
                <div className="meta" style={{ flexBasis: 160 }}>
                  <span className="title">{d.title}</span>
                  <span className="tiny">
                    {KIND_LABEL[d.kind]} · {brDate(d.createdAt)}
                    {!d.visibleToTenant && " · oculto do inquilino"}
                  </span>
                  <div className="row" style={{ gap: 6, marginTop: 4 }}>
                    {SIGNATURE_LABEL[d.signatureStatus] && <span className={`chip ${d.signatureStatus}`}>{SIGNATURE_LABEL[d.signatureStatus]}</span>}
                  </div>
                </div>
                <a className="icon-btn" href={`/d/${d.shareToken}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${d.title}`}>
                  <Icon name="eye" size={18} />
                </a>
                <div className="row" style={{ flexBasis: "100%", gap: 6, paddingLeft: 48 }}>
                  {d.signatureStatus === "none" && canSign && (
                    <ActionForm action={sendForSignature.bind(null, d.id)} style={{ display: "contents" }}>
                      <SubmitButton className="btn sm primary" pendingText="Enviando…">
                        <Icon name="send" size={16} />
                        Enviar para assinatura
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {d.signatureStatus === "pending" && (
                    <>
                      {d.tenantSignUrl && <CopyButton className="btn sm" value={d.tenantSignUrl} label="Link do inquilino" icon="link" />}
                      {d.ownerSignUrl && (
                        <a className="btn sm" href={d.ownerSignUrl} target="_blank" rel="noopener noreferrer">
                          <Icon name="pen" size={16} />
                          Assinar como proprietário
                        </a>
                      )}
                      {d.signatureProvider === "zapsign" && canSign && (
                        <ActionForm action={refreshDocument.bind(null, d.id)} style={{ display: "contents" }}>
                          <SubmitButton className="btn sm ghost" pendingText="Consultando…">
                            <Icon name="refresh" size={16} />
                            Atualizar
                          </SubmitButton>
                        </ActionForm>
                      )}
                    </>
                  )}
                  {d.signatureStatus !== "signed" && (
                    <details className="disclosure" style={{ flexBasis: "100%" }}>
                      <summary className="small">
                        <Icon name="chevron" size={14} />
                        Já foi assinado fora daqui?
                      </summary>
                      <ActionForm action={markDocumentSigned.bind(null, d.id)} className="row">
                        <input type="file" name="signedFile" accept="application/pdf" style={{ flex: "1 1 200px" }} />
                        <SubmitButton className="btn sm">Marcar como assinado</SubmitButton>
                      </ActionForm>
                    </details>
                  )}
                  <form action={toggleDocumentVisibility.bind(null, d.id)}>
                    <button className="btn sm ghost" type="submit">
                      <Icon name={d.visibleToTenant ? "x" : "eye"} size={16} />
                      {d.visibleToTenant ? "Ocultar do inquilino" : "Mostrar ao inquilino"}
                    </button>
                  </form>
                  <form action={deleteDocument.bind(null, d.id)}>
                    <button className="btn sm ghost danger" type="submit">
                      <Icon name="trash" size={16} />
                      Excluir
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Adicionar documento</h2>
          <ActionForm action={uploadDocument.bind(null, id)} className="stack" style={{ gap: 14 }}>
            <label className="field">
              Arquivo (PDF)
              <input type="file" name="file" accept="application/pdf" required />
            </label>
            <div className="form-grid">
              <label className="field">
                Título
                <input name="title" placeholder="Ex.: Contrato 2026–2029" />
              </label>
              <label className="field">
                Tipo
                <select name="kind" defaultValue="contrato">
                  <option value="contrato">Contrato</option>
                  <option value="aditivo">Aditivo / renovação</option>
                  <option value="vistoria">Laudo de vistoria</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
            </div>
            <label className="row small" style={{ gap: 10 }}>
              <input type="checkbox" name="visibleToTenant" defaultChecked style={{ width: 18, minHeight: 18 }} />
              Mostrar para o inquilino
            </label>
            <label className="row small" style={{ gap: 10, opacity: canSign ? 1 : 0.55 }}>
              <input type="checkbox" name="sign" disabled={!canSign} defaultChecked={canSign} style={{ width: 18, minHeight: 18 }} />
              Enviar para assinatura digital agora
            </label>
            <SubmitButton className="btn primary" pendingText="Enviando…">
              <Icon name="upload" size={18} />
              Adicionar documento
            </SubmitButton>
          </ActionForm>
          {!canSign && (
            <div className="inset small muted">
              <strong style={{ color: "var(--text)" }}>Assinatura digital desligada.</strong> Crie uma conta na ZapSign, gere o token da API e
              cadastre <span className="mono">ZAPSIGN_API_TOKEN</span> na Vercel (passo a passo no README). Enquanto isso, você pode marcar
              documentos como assinados manualmente.
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
