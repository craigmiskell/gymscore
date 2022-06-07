import { Step } from "./step";

export interface ICompetitor {
  id?: number,
  identifier: string,
  name: string,
  _stepString: string,
}

export class Competitor implements ICompetitor {
  id: number; // PK
  // The governing body identifier (could be strictly a number, but we don't know for sure so we treat it
  // as an opaque string)
  identifier: string;
  name: string;
  _stepString: string;
  _step: Step;
  gymId: bigint;

  constructor(identifier: string, name: string, step: string | Step, gymId: bigint, id?:number) {
    this.identifier = identifier;
    this.name = name;
    this.gymId = gymId;

    if (typeof step === "string") {
      this._stepString = step;
      this._step = Step.fromString(this._stepString);
    }

    if (step instanceof Step) {
      this.step = step;
    }
    if (id) {this.id = id;}
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
