import { assignNotice, deleteNotice } from "@/app/admin/actions";
import type { Notice } from "@/db/schema";
import { timeAgo } from "@/lib/format";
import { PROVIDER_META } from "./BillCard";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";

interface Props {
  notice: Notice;
  properties: { id: number; name: string }[];
  /** nome do imóvel quando já publicado */
  publishedTo?: string;
}

/** Aviso de e-mail como notificação: título curto, resumo e ações */
export function NoticeNotification({ notice, properties, publishedTo }: Props) {
  const meta = notice.provider ? PROVIDER_META[notice.provider] : null;
  return (
    <article className={`notif${publishedTo ? "" : " unread"}`}>
      <span className={`tile sm ${notice.provider ?? "info"}`}>
        <Icon name={meta?.icon ?? "bell"} size={17} />
      </span>
      <div className="body">
        <div className="head">
          <span className="title">{notice.title}</span>
          <span className="tiny" style={{ whiteSpace: "nowrap" }}>
            {timeAgo(notice.createdAt)}
          </span>
        </div>
        <span className="text">{notice.summary ?? notice.body?.slice(0, 180)}</span>
        <div className="row" style={{ gap: 6 }}>
          {meta && <span className="chip plain">{meta.company}</span>}
          {notice.eventInfo && (
            <span className="chip plain">
              <Icon name="calendar" size={13} />
              {notice.eventInfo}
            </span>
          )}
          {publishedTo && <span className="chip pago">Publicado · {publishedTo}</span>}
          {notice.summarySource === "ia" && <span className="tiny">resumo por IA</span>}
        </div>
        {notice.body && (
          <details className="disclosure">
            <summary className="small">
              <Icon name="chevron" size={14} />
              Ver e-mail original
            </summary>
            <p className="inset small" style={{ whiteSpace: "pre-line", maxHeight: 280, overflow: "auto" }}>
              {notice.body}
            </p>
          </details>
        )}
        {!publishedTo && (
          <div className="actions-row">
            <form action={assignNotice.bind(null, notice.id)} className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
              <select
                name="propertyId"
                required
                defaultValue={notice.suggestedPropertyId ?? ""}
                aria-label="Imóvel para publicar"
                style={{ minWidth: 150, minHeight: 36, padding: "6px 34px 6px 12px" }}
              >
                <option value="">Mostrar para…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <SubmitButton className="btn sm primary" pendingText="…">
                Publicar
              </SubmitButton>
            </form>
            <form action={deleteNotice.bind(null, notice.id)}>
              <button className="btn sm ghost" type="submit">
                Descartar
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
