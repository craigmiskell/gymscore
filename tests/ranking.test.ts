import { ordinal, rankByScore, teamApparatusScore, computeTeamTotals, divisionSegments } from "../src/main/pdfs/common";
import { CompetitionCompetitorDetails } from "../src/common/data/competition";
import { Division } from "../src/common/data/division";

function makeCompetitor(
  id: number,
  scores: Record<string, { finalScore: number }> = {},
  teamIndex: number | null = null,
  division: Division = Division.Over,
  step = 5,
): CompetitionCompetitorDetails {
  return {
    competitorId: id,
    competitorIdentifier: `c${id}`,
    competitorName: `Competitor ${id}`,
    step,
    division,
    clubId: 1,
    clubName: "Test Club",
    teamIndex,
    groupNumber: 1,
    scores,
  } as unknown as CompetitionCompetitorDetails;
}

describe("ordinal", () => {
  it("formats 1st, 2nd, 3rd", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
  });

  it("uses 'th' for 4 through 10", () => {
    for (let n = 4; n <= 10; n++) {
      expect(ordinal(n)).toBe(`${n}th`);
    }
  });

  it("uses 'th' for 11, 12, 13 (special cases)", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
  });

  it("resumes normal suffixes at 21, 22, 23", () => {
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(22)).toBe("22nd");
    expect(ordinal(23)).toBe("23rd");
  });

  it("handles 111th, 112th, 113th correctly", () => {
    expect(ordinal(111)).toBe("111th");
    expect(ordinal(112)).toBe("112th");
    expect(ordinal(113)).toBe("113th");
  });
});

describe("rankByScore", () => {
  const getScore = (c: CompetitionCompetitorDetails) => c.scores["vault"]?.finalScore;

  it("assigns sequential places in descending score order", () => {
    const a = makeCompetitor(1, { vault: { finalScore: 13000 } });
    const b = makeCompetitor(2, { vault: { finalScore: 12000 } });
    const c = makeCompetitor(3, { vault: { finalScore: 11000 } });
    const result = rankByScore([a, b, c], getScore);
    expect(result.get(1)).toEqual({ place: 1, tied: false });
    expect(result.get(2)).toEqual({ place: 2, tied: false });
    expect(result.get(3)).toEqual({ place: 3, tied: false });
  });

  it("shares place number for tied competitors and sets tied flag", () => {
    const a = makeCompetitor(1, { vault: { finalScore: 12000 } });
    const b = makeCompetitor(2, { vault: { finalScore: 12000 } });
    const c = makeCompetitor(3, { vault: { finalScore: 11000 } });
    const result = rankByScore([a, b, c], getScore);
    expect(result.get(1)).toEqual({ place: 1, tied: true });
    expect(result.get(2)).toEqual({ place: 1, tied: true });
    expect(result.get(3)).toEqual({ place: 3, tied: false });
  });

  it("the place after two tied firsts is 3rd", () => {
    const a = makeCompetitor(1, { vault: { finalScore: 12000 } });
    const b = makeCompetitor(2, { vault: { finalScore: 12000 } });
    const c = makeCompetitor(3, { vault: { finalScore: 10000 } });
    const result = rankByScore([a, b, c], getScore);
    expect(result.get(3)?.place).toBe(3);
  });

  it("handles a three-way tie", () => {
    const a = makeCompetitor(1, { vault: { finalScore: 12000 } });
    const b = makeCompetitor(2, { vault: { finalScore: 12000 } });
    const c = makeCompetitor(3, { vault: { finalScore: 12000 } });
    const result = rankByScore([a, b, c], getScore);
    expect(result.get(1)).toEqual({ place: 1, tied: true });
    expect(result.get(2)).toEqual({ place: 1, tied: true });
    expect(result.get(3)).toEqual({ place: 1, tied: true });
  });

  it("excludes competitors for whom getScore returns undefined", () => {
    const a = makeCompetitor(1, { vault: { finalScore: 12000 } });
    const b = makeCompetitor(2); // no scores
    const result = rankByScore([a, b], getScore);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });

  it("returns an empty map for an empty competitor list", () => {
    expect(rankByScore([], getScore).size).toBe(0);
  });
});

describe("teamApparatusScore", () => {
  it("sums the top 3 scores for a team on an apparatus", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 13000 } }, 0),
      makeCompetitor(2, { vault: { finalScore: 12000 } }, 0),
      makeCompetitor(3, { vault: { finalScore: 11000 } }, 0),
    ];
    expect(teamApparatusScore(competitors, 0, "vault")).toBe(36000);
  });

  it("takes only the top 3 when there are more than 3 team members", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 13000 } }, 0),
      makeCompetitor(2, { vault: { finalScore: 12000 } }, 0),
      makeCompetitor(3, { vault: { finalScore: 11000 } }, 0),
      makeCompetitor(4, { vault: { finalScore: 10000 } }, 0), // excluded
    ];
    expect(teamApparatusScore(competitors, 0, "vault")).toBe(36000);
  });

  it("sums fewer than 3 when not all members have a score", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 13000 } }, 0),
      makeCompetitor(2, {}, 0), // no vault score
    ];
    expect(teamApparatusScore(competitors, 0, "vault")).toBe(13000);
  });

  it("returns null when no team member has a score for the apparatus", () => {
    const competitors = [
      makeCompetitor(1, {}, 0),
      makeCompetitor(2, {}, 0),
    ];
    expect(teamApparatusScore(competitors, 0, "vault")).toBeNull();
  });

  it("excludes competitors from a different team", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 13000 } }, 0),
      makeCompetitor(2, { vault: { finalScore: 12000 } }, 1), // different team
    ];
    expect(teamApparatusScore(competitors, 0, "vault")).toBe(13000);
    expect(teamApparatusScore(competitors, 1, "vault")).toBe(12000);
  });
});

describe("computeTeamTotals", () => {
  it("sums apparatus scores across all apparatuses for each team", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 10000 }, floor: { finalScore: 9000 } }, 0),
      makeCompetitor(2, { vault: { finalScore: 8000 }, floor: { finalScore: 7000 } }, 0),
    ];
    const [result] = computeTeamTotals([0], competitors, ["vault", "floor"]);
    expect(result.teamIndex).toBe(0);
    expect(result.total).toBe(34000);
    expect(result.hasScore).toBe(true);
  });

  it("sets hasScore false when a team has no scores at all", () => {
    const competitors = [makeCompetitor(1, {}, 0)];
    const [result] = computeTeamTotals([0], competitors, ["vault"]);
    expect(result.hasScore).toBe(false);
  });

  it("omits null apparatus scores from the total", () => {
    const competitors = [
      makeCompetitor(1, { vault: { finalScore: 10000 } }, 0),
      // no floor score — teamApparatusScore for floor returns null
    ];
    const [result] = computeTeamTotals([0], competitors, ["vault", "floor"]);
    expect(result.total).toBe(10000);
    expect(result.hasScore).toBe(true);
  });
});

describe("divisionSegments", () => {
  it("splits into Overs and Unders for steps with divisions", () => {
    const competitors = [
      makeCompetitor(1, {}, null, Division.Over, 5),
      makeCompetitor(2, {}, null, Division.Under, 5),
    ];
    const segments = divisionSegments(competitors, "5");
    expect(segments).toHaveLength(2);
    expect(segments[0].label).toBe("Overs");
    expect(segments[0].competitors).toHaveLength(1);
    expect(segments[1].label).toBe("Unders");
    expect(segments[1].competitors).toHaveLength(1);
  });

  it("puts Unders before Overs when undersFirst is true", () => {
    const competitors = [
      makeCompetitor(1, {}, null, Division.Over, 5),
      makeCompetitor(2, {}, null, Division.Under, 5),
    ];
    const segments = divisionSegments(competitors, "5", true);
    expect(segments[0].label).toBe("Unders");
    expect(segments[1].label).toBe("Overs");
  });

  it("omits empty division segments", () => {
    const competitors = [makeCompetitor(1, {}, null, Division.Over, 5)];
    const segments = divisionSegments(competitors, "5");
    expect(segments).toHaveLength(1);
    expect(segments[0].label).toBe("Overs");
  });

  it("returns a single 'Competitors' segment for step 9+", () => {
    const competitors = [
      makeCompetitor(1, {}, null, Division.Over, 9),
      makeCompetitor(2, {}, null, Division.Over, 9),
    ];
    const segments = divisionSegments(competitors, "9");
    expect(segments).toHaveLength(1);
    expect(segments[0].label).toBe("Competitors");
    expect(segments[0].competitors).toHaveLength(2);
  });

  it("returns an empty array when there are no competitors", () => {
    expect(divisionSegments([], "9")).toHaveLength(0);
    expect(divisionSegments([], "5")).toHaveLength(0);
  });
});
