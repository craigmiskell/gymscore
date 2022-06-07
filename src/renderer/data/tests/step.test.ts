import { Step, UnderOver } from "../";

describe("Constructor works", () => {
  test("Basic constructor invocation", () => {
    const level = BigInt(3);
    const s = new Step(level, UnderOver.Over);
    expect(s.level).toBe(level);
    expect(s.underOver).toBe(UnderOver.Over);
  });

});
describe("Level must be between 1 and 10 inclusive", () => {
  test("Negative", () => {
    expect(
      () => {
        new Step(BigInt(-1), UnderOver.Under);
      }
    ).toThrow(RangeError);
  });
  test("Over 10", () => {
    expect(
      () => {
        new Step(BigInt(11), UnderOver.Under);
      }
    ).toThrow(RangeError);
  });
  test("One-To-Ten", () => {
    expect(
      () => {
        for (let i=1; i <= 10; i++) {
          new Step(BigInt(i), UnderOver.Under);
        }
      }
    ).not.toThrow(RangeError);
  });
  test("Setter over 10", () => {
    const base = new Step(BigInt(1), UnderOver.Over);
    expect(
      () => {
        base.level = BigInt(11);
      }
    ).toThrow(RangeError);
  });
});

describe("Round trip should be consistent", () => {
  test("Basics", () => {
    const base = new Step(BigInt(2), UnderOver.Over);
    const str = base.toString();
    expect(str).toBe("2-1");
    const result = Step.fromString(str);
    expect(result.level).toBe(base.level);
    expect(result.underOver).toBe(base.underOver);
  });
});

describe("Fails on poor input to fromString", () => {
  test("Too many components", () => {
    expect(
      () => {
        const result = Step.fromString("1-2-3");
      }
    ).toThrow(TypeError);
  });
  test("Not enough components", () => {
    expect(
      () => {
        Step.fromString("1");
      }
    ).toThrow(TypeError);
  });
  test("Level out of range", () => {
    expect(
      () => {
        Step.fromString("13-1");
      }
    ).toThrow(RangeError);
  });
  test("UnderOver invalid", () => {
    expect(
      () => {
        Step.fromString("2-2");
      }
    ).toThrow(TypeError);
  });
  test("Level not integer", () => {
    expect(
      () => {
        Step.fromString("a-1");
      }
    ).toThrow(RangeError);
  });
  test("UnderOver not integer", () => {
    expect(
      () => {
        Step.fromString("3-b");
      }
    ).toThrow(TypeError);
  });
});
