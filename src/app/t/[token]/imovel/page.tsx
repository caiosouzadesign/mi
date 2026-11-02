import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Money } from "@/components/Money";
import { PhotoGallery } from "@/components/PhotoGallery";
import { contractInfo } from "@/lib/contract";
import { KIND_LABEL, SIGNATURE_LABEL, STAGE_LABEL } from "@/lib/documents";
import { brDate } from "@/lib/format";
import { documentsForProperty, getPropertyByToken, photosForProperty } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const property = await getPropertyByToken((await params).token);
  return { title: property ? `Contrato e fotos · ${property.name}` : "Contas do Imóvel" };
}

export default async function PropertyInfoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const property = await getPropertyByToken(token);
  if (!property) notFound();
  const [documents, photos] = await Promise.all([documentsForProperty(property.id, { tenantOnly: true }), photosForProperty(property.id)]);

  const info = contractInfo(property);
  const contractDoc = documents.find((d) => d.kind === "contrato");
  const toSign = documents.filter((d) => d.signatureStatus === "pending" && d.tenantSignUrl);

  return (
    <main className="page">
      <section className="intro">
        <span className="eyebrow">Seu imóvel</span>
        <h1>
          <span className="light">Contrato</span> e fotos
        </h1>
        <p className="muted">
          {property.name}
          {property.address ? ` · ${property.address}` : ""}
        </p>
      </section>

      <div className="layout">
        <div className="col">
          {info ? (
            <section className="hero" aria-label="Contrato">
              <div className="row between">
                <span className="eyebrow">Contrato de locação</span>
                <span className={`chip ${info.stage}`}>{STAGE_LABEL[info.stage]}</span>
              </div>
              <div className="stack-sm">
                <div className="contract-days">
                  <span className="n">{Math.abs(info.daysLeft)}</span>
                  <span className="u">{info.daysLeft < 0 ? "dias desde o fim" : `dia${info.daysLeft === 1 ? "" : "s"} para o fim`}</span>
                </div>
                <span className="muted small">{info.label}</span>
              </div>
              {info.progress != null && (
                <div className="stack-sm">
                  <div className={`progress ${info.stage === "atencao" ? "warn" : info.stage === "ativo" ? "" : "bad"}`} aria-label={`${info.progress}% do prazo`}>
                    <span style={{ width: `${Math.max(3, info.progress)}%` }} />
                  </div>
                  <div className="row between tiny" style={{ color: "rgba(244,245,247,.55)" }}>
                    <span>{brDate(property.contractStart)}</span>
                    <span>{info.progress}% do prazo</span>
                    <span>{brDate(property.contractEnd)}</span>
                  </div>
                </div>
              )}
              <dl className="stats">
                <div className="stat">
                  <dt>Início</dt>
                  <dd>{brDate(property.contractStart)}</dd>
                </div>
                <div className="stat">
                  <dt>Aluguel</dt>
                  <dd>{property.rentCents != null ? <Money cents={property.rentCents} size="sm" /> : "—"}</dd>
                </div>
              </dl>
              {contractDoc && (
                <div className="btn-row">
                  <a className="btn primary" href={`/d/${contractDoc.shareToken}`} target="_blank" rel="noopener noreferrer">
                    <Icon name="eye" size={18} />
                    Ver contrato
                  </a>
                  <a className="btn" href={`/d/${contractDoc.shareToken}?download=1`}>
                    <Icon name="download" size={18} />
                    Baixar
                  </a>
                </div>
              )}
            </section>
          ) : (
            <section className="card" style={{ justifyItems: "center", textAlign: "center", padding: "32px 20px" }}>
              <span className="tile lg info">
                <Icon name="pen" size={24} />
              </span>
              <div className="stack-sm">
                <h3>Contrato ainda não cadastrado</h3>
                <p className="small muted">Quando o proprietário adicionar, ele aparece aqui com as datas e o aviso de vencimento.</p>
              </div>
            </section>
          )}

          {toSign.map((d) => (
            <section key={d.id} className="card">
              <header className="bill-head">
                <span className="tile info">
                  <Icon name="pen" size={21} />
                </span>
                <div className="grow">
                  <h3>Assinatura pendente</h3>
                  <p className="small faint">
                    {KIND_LABEL[d.kind]} · {d.title}
                  </p>
                </div>
              </header>
              <p className="small muted">
                Leia o documento e assine digitalmente pelo celular. A assinatura eletrônica tem validade jurídica e você recebe uma cópia assinada.
              </p>
              <div className="btn-row">
                <a className="btn primary" href={d.tenantSignUrl!} target="_blank" rel="noopener noreferrer">
                  <Icon name="pen" size={18} />
                  Assinar agora
                </a>
                <a className="btn" href={`/d/${d.shareToken}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="eye" size={18} />
                  Ler antes
                </a>
              </div>
            </section>
          ))}

          <section className="card" aria-label="Documentos">
            <div className="row between">
              <h2>Documentos</h2>
              <span className="tiny">{documents.length}</span>
            </div>
            {documents.length === 0 ? (
              <p className="small muted">Nenhum documento por enquanto.</p>
            ) : (
              <div className="list">
                {documents.map((d) => (
                  <div key={d.id} className="list-row">
                    <span className={`tile sm ${d.signatureStatus === "signed" ? "good" : "info"}`}>
                      <Icon name={d.signatureStatus === "signed" ? "checkCircle" : "doc"} size={17} />
                    </span>
                    <div className="meta">
                      <span className="title">{d.title}</span>
                      <span className="tiny">
                        {KIND_LABEL[d.kind]} · {d.signedAt ? `assinado em ${brDate(d.signedAt)}` : `adicionado em ${brDate(d.createdAt)}`}
                      </span>
                      {SIGNATURE_LABEL[d.signatureStatus] && (
                        <span className={`chip ${d.signatureStatus}`} style={{ justifySelf: "start", marginTop: 4 }}>
                          {SIGNATURE_LABEL[d.signatureStatus]}
                        </span>
                      )}
                    </div>
                    <a className="icon-btn" href={`/d/${d.shareToken}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${d.title}`}>
                      <Icon name="eye" size={18} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="col side">
          <section className="card" aria-label="Fotos">
            <div className="row between">
              <h2>Fotos do imóvel</h2>
              <span className="tiny">{photos.length}</span>
            </div>
            {photos.length === 0 ? (
              <div className="inset small muted row" style={{ gap: 10 }}>
                <Icon name="image" size={18} />
                Nenhuma foto ainda.
              </div>
            ) : (
              <PhotoGallery photos={photos.map((p) => ({ src: `/t/${token}/fotos/${p.id}`, caption: p.caption }))} />
            )}
            <p className="tiny">Fotos da entrega do imóvel — servem de referência na vistoria de saída.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
