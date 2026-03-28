// Parse a score string; zero if it doesn't parse. Original number * 1000 as an integer if it
// does, so we can do maths in whole numbers and divide at the end for presentation, avoiding
// floating point issues.
export function parseScore(score: string, nanAllowed = false): number {
  const res = parseFloat(score);
  if (isNaN(res)) {
    return nanAllowed ? res : 0;
  }
  return Math.round(res * 1000);
}

// Inputs are per-judge execution deductions as strings. There may be 2, 3, or 4 values
// (empty string if absent). When there are 2 or 3 judges, average all available values.
// When there are 4, drop the lowest and highest, then average the remaining 2.
// See https://www.gymnasticsnz.com/wp-content/uploads/2021/02/2021-WAG-Programme-Manual-2021-02-05.pdf
// Section 3.4 (page 13) for scoring definition.
export function averageJudgeEScores(rawScores: string[]): number {
  const scores = rawScores
    .map((score) => parseScore(score, true))
    .filter((score) => !isNaN(score));
  const totalScores = scores.reduce((prev, curr) => prev + curr, 0);

  if (scores.length === 0) {
    return 0;
  } else if (scores.length === 4) {
    return (totalScores - Math.min(...scores) - Math.max(...scores)) / 2;
  } else {
    return totalScores / scores.length;
  }
}
