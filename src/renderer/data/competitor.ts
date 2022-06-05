import { Step } from "./step";
import { Gym } from "./gym";

 export interface ICompetitor {
  id?: number,
  identifier: string,
  name: string,
  _stepString: string,
}

export class Competitor {
  // The governing body identifier (could be strictly a number, but we don't know for sure so we treat it as an opaque string)
  identifier: string;
  name: string;
  _stepString: string;
  _step: Step;
  gymId: bigint;

  constructor(identifier: string, name: string, step: string | Step, gymId: bigint) {
    this.identifier = identifier;
    this.name = name;
    this.gymId = gymId;
    let stepString = step as string;

    if (typeof step === "string") {
      this._stepString = step;
      this._step = Step.fromString(this._stepString)
    }

    if (step instanceof Step) {
      this.step = step;
    }
  }

  // Just to prove testing.
  greet() {
    return `Hello ${this.name}`;
  }

  set step(value: Step) {
    this._step = value;
    this._stepString = this._step.toString();
  }

  get step() :Step {
    return this._step;
  }
}
