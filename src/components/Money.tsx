/** Valor em reais com contraste de pesos: inteiro forte, centavos leves */
export function Money({ cents, size = "md", className = "" }: { cents: number | null | undefined; size?: "xl" | "lg" | "md" | "sm"; className?: string }) {
  if (cents == null) return <span className={`money ${size} ${className}`}>—</span>;
  const [int, dec] = (Math.abs(cents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",");
  return (
    <span className={`money ${size} ${className}`} aria-label={`R$ ${int},${dec}`}>
      <span className="cur">R$</span>
      <span className="int">{cents < 0 ? "-" : ""}{int}</span>
      <span className="dec">,{dec}</span>
    </span>
  );
}
