import { formatConsumption, monthLabel } from "@/lib/format";

interface Point {
  referenceMonth: string | null;
  consumption: number | null;
  consumptionUnit: string | null;
}

/** Consumo dos últimos 12 meses; destaca o mês mais recente */
export function ConsumptionChart({ points, color, title }: { points: Point[]; color: string; title: string }) {
  const valid = points
    .filter((p): p is Point & { referenceMonth: string; consumption: number } => p.consumption != null && !!p.referenceMonth)
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth))
    .slice(-12);
  if (valid.length < 2) return null;
  const max = Math.max(...valid.map((p) => p.consumption), 1);

  return (
    <figure className="chart" style={{ margin: 0, ["--series" as string]: color }} aria-label={title}>
      <div className="bars">
        {valid.map((p, i) => {
          const latest = i === valid.length - 1;
          const label = `${monthLabel(p.referenceMonth)}: ${formatConsumption(p.consumption, p.consumptionUnit)}`;
          return (
            <div key={p.referenceMonth} className={`bar${latest ? " latest" : ""}`} title={label} aria-label={label}>
              {latest && <span className="value">{formatConsumption(p.consumption, p.consumptionUnit)}</span>}
              <span className="fill" style={{ height: `${(p.consumption / max) * 85}%` }} />
            </div>
          );
        })}
      </div>
      <div className="bars-labels" aria-hidden>
        {valid.map((p) => (
          <span key={p.referenceMonth}>{monthLabel(p.referenceMonth).slice(0, 3)}</span>
        ))}
      </div>
    </figure>
  );
}
