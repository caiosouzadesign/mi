export interface ConsumptionPoint {
  referenceMonth: string | null;
  consumption: number | null;
}

export interface ConsumptionAlert {
  level: "atencao" | "alto";
  /** variação percentual em relação à média */
  percent: number;
  latest: number;
  average: number;
}

/**
 * Compara o consumo da conta mais recente com a média das até 6 anteriores.
 * Exige pelo menos 2 meses de histórico para não alarmar à toa.
 */
export function consumptionAlert(points: ConsumptionPoint[]): ConsumptionAlert | null {
  const valid = points
    .filter((p): p is { referenceMonth: string; consumption: number } => p.consumption != null && !!p.referenceMonth)
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  if (valid.length < 3) return null;
  const latest = valid[valid.length - 1].consumption;
  const history = valid.slice(-7, -1).map((p) => p.consumption);
  const average = history.reduce((s, v) => s + v, 0) / history.length;
  if (average <= 0) return null;
  const percent = Math.round(((latest - average) / average) * 100);
  if (percent >= 50) return { level: "alto", percent, latest, average };
  if (percent >= 25) return { level: "atencao", percent, latest, average };
  return null;
}

/** Variação (%) do consumo de uma conta em relação à média das até 6 contas anteriores */
export function consumptionDelta(points: ConsumptionPoint[], referenceMonth: string | null): number | null {
  if (!referenceMonth) return null;
  const valid = points
    .filter((p): p is { referenceMonth: string; consumption: number } => p.consumption != null && !!p.referenceMonth)
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  const index = valid.findIndex((p) => p.referenceMonth === referenceMonth);
  if (index < 2) return null;
  const history = valid.slice(Math.max(0, index - 6), index).map((p) => p.consumption);
  const average = history.reduce((s, v) => s + v, 0) / history.length;
  return average > 0 ? Math.round(((valid[index].consumption - average) / average) * 100) : null;
}
