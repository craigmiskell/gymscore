import { formatScore, capitalise } from "../src/common/formatting";

describe("formatScore", () => {
  it("formats a whole-number score to 3dp", () => {
    expect(formatScore(12000)).toBe("12.000");
  });

  it("formats a score with millipoints", () => {
    expect(formatScore(12345)).toBe("12.345");
  });

  it("formats zero", () => {
    expect(formatScore(0)).toBe("0.000");
  });

  it("formats 1 millipoint", () => {
    expect(formatScore(1)).toBe("0.001");
  });

  it("truncates (floors) rather than rounds", () => {
    // 12999.9 should floor to 12999 → "12.999", not round to 13000 → "13.000"
    expect(formatScore(12999.9)).toBe("12.999");
  });

  it("formats the maximum E-score contribution (10.000)", () => {
    expect(formatScore(10000)).toBe("10.000");
  });
});

describe("capitalise", () => {
  it("capitalises the first character", () => {
    expect(capitalise("vault")).toBe("Vault");
  });

  it("leaves the rest unchanged", () => {
    expect(capitalise("floor")).toBe("Floor");
  });

  it("handles an already-capitalised string", () => {
    expect(capitalise("Beam")).toBe("Beam");
  });

  it("handles a single character", () => {
    expect(capitalise("a")).toBe("A");
  });
});
