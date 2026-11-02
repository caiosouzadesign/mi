import { monthLabel } from "@/lib/format";

interface Point {
  referenceMonth: string | null;
  consumption: number | null;
  consumptionUnit: string | null;
}

/**
 * Consumo dos últimos 12 meses (uma série): meses anteriores com textura,
 * mês mais recente sólido e com o valor em destaque.
 */
export function ConsumptionChart({ points, color, title, delta }: { points: Point[]; color: string; title: string; delta?: number | null }) {
  const valid = points
    .filter((p): p is Point & { referenceMonth: string; consumption: number } => p.consumption != null && !!p.referenceMonth)
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
    .slice(-12);
  if (valid.length < 2) return null;
  const max = Math.max(...valid.map((p) => p.consumption), 1);
  const latest = valid[valid.length - 1];
  const unit = latest.consumptionUnit ?? "";

  return (
    <figure className="chart" style={{ margin: 0, ["--series" as string]: color }} aria-label={title}>
      <div className="chart-head">
        <div className="stack-sm">
          <span className="eyebrow">
            {title} · {monthLabel(latest.referenceMonth)}
          </span>
          <span className="chart-value">
            {latest.consumption.toLocaleString("pt-BR")}
            <small>{unit}</small>
          </span>
        </div>
        {delta != null && (
          <span className={`chip plain ${delta >= 25 ? "pendente" : delta <= -10 ? "pago" : ""}`}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "="} {Math.abs(delta)}% vs. média
          </span>
        )}
      </div>
      <div className="bars">
        {valid.map((p, i) => {
          const isLatest = i === valid.length - 1;
          const label = `${monthLabel(p.referenceMonth)}: ${p.consumption.toLocaleString("pt-BR")} ${p.consumptionUnit ?? ""}`;
          const h = `${Math.max(6, (p.consumption / max) * 100)}%`;
          return (
            <div key={p.referenceMonth} className={`bar${isLatest ? " latest" : ""}`} tabIndex={0} aria-label={label} style={{ ["--h" as string]: h }}>
              <span className="tip">{label}</span>
              <span className="fill" style={{ height: h }} />
            </div>
          );
        })}
      </div>
      <div className="bars-labels" aria-hidden>
        {valid.map((p, i) => (
          <span key={p.referenceMonth} className={i === valid.length - 1 ? "latest" : ""}>
            {monthLabel(p.referenceMonth).slice(0, 3)}
          </span>
        ))}
      </div>
    </figure>
  );
}
