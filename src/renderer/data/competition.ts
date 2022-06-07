export interface ICompetition {
  id?: number,
  name: string,
  date: string,
  location: string,
  state: CompetitionState,
}
export enum CompetitionState {
  Preparing = 0,
  Running,
  Completed
}

export class Competition implements ICompetition {
  id: number;
  name: string;
  date: string;
  location: string;
  state: CompetitionState;

  constructor(name: string, date: string, location:string, state: CompetitionState, id?:number) {
    this.name = name;
    this.date = date;
    this.location = location;
    this.state = state;
    if (id) {this.id = id;}
  }
}
