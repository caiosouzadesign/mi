import { logout } from "@/app/admin/actions";
import { Brand } from "./Brand";
import { Icon } from "./Icon";

export function AdminTopbar() {
  return (
    <header className="topbar">
      <Brand href="/admin" subtitle="Painel do proprietário" />
      <form action={logout}>
        <button className="btn sm ghost" type="submit">
          <Icon name="logout" size={18} />
          Sair
        </button>
      </form>
    </header>
  );
}
