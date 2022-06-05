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
        new Step(BigInt(-1), UnderOver.Under)
      }
    ).toThrow(RangeError);
  });
  test("Over 10", () => {
    expect(
      () => {
        new Step(BigInt(11), UnderOver.Under)
      }
    ).toThrow(RangeError);
  });
  test("One-To-Ten", () => {
    expect(
      () => {
        for (var i=1; i <= 10; i++) {
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
  })
});

describe("Round trip should be consistent", () => {
  test("Basics", () => {
    const base = new Step(BigInt(2), UnderOver.Over);
    let str = base.toString();
    expect(str).toBe("2-1")
    let result = Step.fromString(str);
    expect(result.level).toBe(base.level)
    expect(result.underOver).toBe(base.underOver);
  });
});

describe("Fails on poor input to fromString", () => {
  test("Too many components", () => {
    expect(
      () => {
        let result = Step.fromString("1-2-3");
      }
    ).toThrow(TypeError);
  });
  test("Not enough components", () => {
    expect(
      () => {
        let result = Step.fromString("1");
      }
    ).toThrow(TypeError);
  });
  test("Level out of range", () => {
    expect(
      () => {
        let result = Step.fromString("13-1");
      }
    ).toThrow(RangeError);
  });
  test("UnderOver invalid", () => {
    expect(
      () => {
        let result = Step.fromString("2-2");
      }
    ).toThrow(TypeError);
  });
  test("Level not integer", () => {
    expect(
      () => {
        let result = Step.fromString("a-1");
      }
    ).toThrow(RangeError);
  });
  test("UnderOver not integer", () => {
    expect(
      () => {
        let result = Step.fromString("3-b");
      }
    ).toThrow(TypeError);
  });
});
