import { hasDivisions } from "../src/common/data/division";

describe("hasDivisions", () => {
  it("returns true for steps 1 through 8", () => {
    for (let step = 1; step <= 8; step++) {
      expect(hasDivisions(step)).toBe(true);
    }
  });

  it("returns false for step 9", () => {
    expect(hasDivisions(9)).toBe(false);
  });

  it("returns false for steps above 9", () => {
    expect(hasDivisions(10)).toBe(false);
    expect(hasDivisions(12)).toBe(false);
  });
});
