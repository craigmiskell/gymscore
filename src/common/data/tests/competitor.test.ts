import { Competitor } from "../";

describe("testing greeting", () => {
  test("Name works", () => {
    const name="craig";
    const c = new Competitor(name);
    expect(c.name).toBe(name);
  });
});
