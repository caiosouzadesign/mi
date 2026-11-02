import { Icon } from "@/components/Icon";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Contas do Imóvel" };

export default function LoginPage() {
  return (
    <main className="page" style={{ maxWidth: 440, minHeight: "100dvh", alignContent: "center" }}>
      <div className="card" style={{ padding: 28, gap: 22 }}>
        <span className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Icon name="receipt" size={26} />
        </span>
        <div className="stack-sm">
          <h1 style={{ fontSize: "1.7rem" }}>
            <span className="light">Painel do</span> proprietário
          </h1>
          <p className="muted small">Contas de água e luz dos seus imóveis.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
