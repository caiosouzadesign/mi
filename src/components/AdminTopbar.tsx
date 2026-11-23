import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { pendingCounts } from "@/lib/queries";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

export async function AdminTopbar() {
  const pending = await pendingCounts();
  return (
    <header className="topbar">
      <Brand href="/admin" subtitle="Painel do proprietário" />
      <nav className="row" style={{ gap: 6 }} aria-label="Painel">
        <Link className="icon-btn" href="/admin/conectar-gmail" aria-label="Conectar Gmail" title="Conectar Gmail">
          <Icon name="mail" size={18} />
        </Link>
        <Link
          className="icon-btn bell"
          href="/admin/notificacoes"
          aria-label={pending.total ? `Notificações: ${pending.total} pendentes` : "Notificações"}
          title="Notificações"
        >
          <Icon name="bell" size={18} />
          {pending.total > 0 && <span className="badge">{pending.total > 9 ? "9+" : pending.total}</span>}
        </Link>
        <form action={logout}>
          <button className="btn sm ghost" type="submit">
            <Icon name="logout" size={18} />
            Sair
          </button>
        </form>
      </nav>
    </header>
  );
}
