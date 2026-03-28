// Simple ascii capitalisation only; do not use for user-visible names (unicode is not handled).
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Scores are stored as integers * 1000.
// Per scoring definition
// https://www.gymnasticsnz.com/wp-content/uploads/2021/02/2021-WAG-Programme-Manual-2021-02-05.pdf
// section 3.4, Format of scores)
// we need 3dp decimal, truncated (floored) not rounded.
export function formatScore(score: number): string {
  return (Math.floor(score) / 1000).toFixed(3);
}
