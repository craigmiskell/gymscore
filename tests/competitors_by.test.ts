import {
  apparatusRotation,
  rotateCompetitorOrder,
  sortByGroupOrderForApparatus,
  enabledApparatusContext,
} from "../src/common/competitors_by";
import { CompetitionCompetitorDetails } from "../src/common/data/competition";

function makeCompetitor(id: number, groupOrder: number): CompetitionCompetitorDetails {
  return {
    competitorId: id,
    competitorIdentifier: `c${id}`,
    competitorName: `Competitor ${id}`,
    step: 5,
    groupNumber: 1,
    groupOrder,
    division: 0,
    clubId: 1,
    clubName: "Test Club",
    teamIndex: null,
    scores: {},
  } as unknown as CompetitionCompetitorDetails;
}

const [A, B, C, D] = [1, 2, 3, 4].map((id) => makeCompetitor(id, id));

function ids(competitors: CompetitionCompetitorDetails[]) {
  return competitors.map((c) => c.competitorId);
}

describe("apparatusRotation", () => {
  it("returns 0 for the first group at the first apparatus", () => {
    expect(apparatusRotation(0, 0, 4)).toBe(0);
  });

  it("returns 1 when a group advances one apparatus", () => {
    expect(apparatusRotation(1, 0, 4)).toBe(1);
  });

  it("returns 0 for a group at their own starting apparatus", () => {
    // Group 1 (index 1) starts at apparatus 1 — no rotation needed
    expect(apparatusRotation(1, 1, 4)).toBe(0);
  });

  it("returns N-1 for the apparatus immediately before the group's starting apparatus", () => {
    // Group 1 (index 1) at apparatus 0 — vault is their last apparatus
    expect(apparatusRotation(0, 1, 4)).toBe(3);
  });

  it("wraps correctly when groupIndex exceeds numApparatuses", () => {
    // Group 5 (index 5) with 4 apparatuses behaves the same as group 1 (index 1)
    expect(apparatusRotation(0, 5, 4)).toBe(apparatusRotation(0, 1, 4));
  });

  it("is always in [0, numApparatuses)", () => {
    for (let a = 0; a < 4; a++) {
      for (let g = 0; g < 8; g++) {
        const r = apparatusRotation(a, g, 4);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(4);
      }
    }
  });
});

describe("rotateCompetitorOrder", () => {
  it("rotation 0 returns the same order", () => {
    expect(ids(rotateCompetitorOrder([A, B, C, D], 0))).toEqual([1, 2, 3, 4]);
  });

  it("rotation 1 moves the first competitor to the end", () => {
    expect(ids(rotateCompetitorOrder([A, B, C, D], 1))).toEqual([2, 3, 4, 1]);
  });

  it("rotation 2 moves the first two competitors to the end", () => {
    expect(ids(rotateCompetitorOrder([A, B, C, D], 2))).toEqual([3, 4, 1, 2]);
  });

  it("rotation equal to length returns the original order", () => {
    expect(ids(rotateCompetitorOrder([A, B, C, D], 4))).toEqual([1, 2, 3, 4]);
  });

  it("handles an empty list", () => {
    expect(rotateCompetitorOrder([], 3)).toEqual([]);
  });

  it("handles a single competitor", () => {
    expect(ids(rotateCompetitorOrder([A], 1))).toEqual([1]);
  });
});

describe("sortByGroupOrderForApparatus", () => {
  // 4 competitors in group order 1-4, 4 apparatuses (vault=0, bar=1, beam=2, floor=3)
  const competitors = [A, B, C, D];

  describe("group 0 (starts at apparatus 0)", () => {
    it("vault (apparatus 0): original order", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 0, 0, 4))).toEqual([1, 2, 3, 4]);
    });

    it("bar (apparatus 1): A moves to end", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 1, 0, 4))).toEqual([2, 3, 4, 1]);
    });

    it("beam (apparatus 2): A and B move to end", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 2, 0, 4))).toEqual([3, 4, 1, 2]);
    });

    it("floor (apparatus 3): A, B and C move to end", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 3, 0, 4))).toEqual([4, 1, 2, 3]);
    });
  });

  describe("group 1 (starts at apparatus 1 — bar)", () => {
    it("bar (apparatus 1): original order", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 1, 1, 4))).toEqual([1, 2, 3, 4]);
    });

    it("beam (apparatus 2): A moves to end", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 2, 1, 4))).toEqual([2, 3, 4, 1]);
    });

    it("vault (apparatus 0): last apparatus, A/B/C move to end", () => {
      expect(ids(sortByGroupOrderForApparatus(competitors, 0, 1, 4))).toEqual([4, 1, 2, 3]);
    });
  });

  it("works with 2 enabled apparatuses", () => {
    // vault=0, floor=1 — only 2 enabled
    expect(ids(sortByGroupOrderForApparatus(competitors, 0, 0, 2))).toEqual([1, 2, 3, 4]);
    expect(ids(sortByGroupOrderForApparatus(competitors, 1, 0, 2))).toEqual([2, 3, 4, 1]);
    // Group 1 at their first apparatus (floor=1): no rotation
    expect(ids(sortByGroupOrderForApparatus(competitors, 1, 1, 2))).toEqual([1, 2, 3, 4]);
  });
});

describe("enabledApparatusContext", () => {
  it("returns the index and count for a full 4-apparatus competition", () => {
    const comp = { vault: true, bar: true, beam: true, floor: true };
    expect(enabledApparatusContext(comp, "vault")).toEqual({ apparatusIndex: 0, numApparatuses: 4 });
    expect(enabledApparatusContext(comp, "floor")).toEqual({ apparatusIndex: 3, numApparatuses: 4 });
  });

  it("computes correct indices when some apparatuses are disabled", () => {
    const comp = { vault: true, bar: false, beam: true, floor: false };
    expect(enabledApparatusContext(comp, "vault")).toEqual({ apparatusIndex: 0, numApparatuses: 2 });
    expect(enabledApparatusContext(comp, "beam")).toEqual({ apparatusIndex: 1, numApparatuses: 2 });
  });
});
