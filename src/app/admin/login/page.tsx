import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Contas do Imóvel" };

export default function LoginPage() {
  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 64 }}>
      <div className="card">
        <span className="brand">Contas do imóvel</span>
        <h1>Painel do proprietário</h1>
        <LoginForm />
      </div>
    </main>
  );
}
