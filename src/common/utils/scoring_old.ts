export function calculateAuditScore(
  actualScores: number[],
  maxScores: number[]
): number {
  if (actualScores.length === 0 || maxScores.length === 0) return 0;

  const totalActual = actualScores.reduce((sum, s) => sum + s, 0);
  const totalMax = maxScores.reduce((sum, s) => sum + s, 0);

  if (totalMax === 0) return 0;

  // Formula: SUM(CHLI.score1) / SUM(CHLT.score1) * 5.0
  return Math.round((totalActual / totalMax) * 5.0 * 100) / 100;
}
