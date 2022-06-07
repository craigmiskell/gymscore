import { Competitor } from "../"; //, Step, UnderOver } from "../";
import { Step, UnderOver} from "../step";

describe("Constructor", () => {
  test("Step is handled if string", () => {
    const name="craig";
    const step = new Step(BigInt(3), UnderOver.Over);
    const c = new Competitor("W123", name, step.toString(), BigInt(1));
    expect(c.step).toEqual(step);
  });
  test("Step is handled if Step", () => {
    const name="craig";
    const step = new Step(BigInt(3), UnderOver.Over);
    const c = new Competitor("W123", name, step, BigInt(1));
    // Just looking for no exception being thrown, but use it
    // to convince eslint everything is fine
    expect(c.name).toEqual("craig");
  });
});
