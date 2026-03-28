import { parseScore, averageJudgeEScores } from "../src/common/scoring";

describe("parseScore", () => {
  it("converts a decimal string to integer millipoints", () => {
    expect(parseScore("3.5")).toBe(3500);
    expect(parseScore("12.345")).toBe(12345);
  });

  it("handles a whole-number string", () => {
    expect(parseScore("10")).toBe(10000);
  });

  it("returns 0 for an empty string when nanAllowed is false (default)", () => {
    expect(parseScore("")).toBe(0);
  });

  it("returns NaN for an empty string when nanAllowed is true", () => {
    expect(parseScore("", true)).toBeNaN();
  });

  it("returns 0 for a non-numeric string when nanAllowed is false", () => {
    expect(parseScore("abc")).toBe(0);
  });

  it("returns NaN for a non-numeric string when nanAllowed is true", () => {
    expect(parseScore("abc", true)).toBeNaN();
  });

  it("returns 0 for the string '0'", () => {
    expect(parseScore("0")).toBe(0);
  });
});

describe("averageJudgeEScores", () => {
  it("averages two judge scores", () => {
    expect(averageJudgeEScores(["3.0", "2.0"])).toBe(2500);
  });

  it("averages three judge scores", () => {
    expect(averageJudgeEScores(["3.0", "2.0", "1.0"])).toBe(2000);
  });

  it("drops the highest and lowest when there are four judges", () => {
    // 1.0, 2.0, 3.0, 4.0 → drop 1.0 and 4.0, average 2.0 and 3.0 → 2.5
    expect(averageJudgeEScores(["3.0", "2.0", "1.0", "4.0"])).toBe(2500);
  });

  it("with four equal judges the result is the same value", () => {
    expect(averageJudgeEScores(["2.5", "2.5", "2.5", "2.5"])).toBe(2500);
  });

  it("ignores empty strings and averages the remainder", () => {
    // Two real scores, two empty → treated as 2-judge case
    expect(averageJudgeEScores(["3.0", "", "2.0", ""])).toBe(2500);
  });

  it("returns 0 when all scores are empty", () => {
    expect(averageJudgeEScores(["", "", "", ""])).toBe(0);
  });

  it("returns 0 for an empty array", () => {
    expect(averageJudgeEScores([])).toBe(0);
  });

  it("handles a single non-empty score", () => {
    expect(averageJudgeEScores(["5.0", ""])).toBe(5000);
  });
});
