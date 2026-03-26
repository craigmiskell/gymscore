# Migration 001: Rename gym → club

**Applied:** 2026-03-26
**DB versions:** 1 → 2 → 3

## What changed

- Renamed IndexedDB table `gyms` → `clubs`
- Renamed index `gymId` → `clubId` on the `competitors` table
- Renamed fields `gymId` → `clubId` and `gymName` → `clubName` in embedded
  `CompetitionCompetitorDetails` objects within the `competitions` table
- Renamed field `gymId` → `clubId` in embedded `Team` objects within the `competitions` table

## Migration code (for reference)

```typescript
// Version 1: original schema
this.version(1).stores({
  competitions: "++id, name, date, location, state",
  competitors: "++id, identifier, name, gymId",
  gyms: "++id, name",
});

// Version 2: rename gyms→clubs, gymId→clubId.
// 'gyms' is kept in this version so we can read from it during the upgrade.
this.version(2).stores({
  competitions: "++id, name, date, location, state",
  competitors: "++id, identifier, name, clubId",
  gyms: "++id, name",
  clubs: "++id, name",
}).upgrade(async (trans) => {
  // Copy gyms → clubs (preserve IDs so foreign keys still work)
  const gyms = await trans.table("gyms").toArray();
  await trans.table("clubs").bulkAdd(gyms);

  // Rename gymId → clubId in each competitor record
  await trans.table("competitors").toCollection().modify((c: any) => {
    c.clubId = c.gymId;
    delete c.gymId;
  });

  // Rename gymId → clubId and gymName → clubName in embedded competition data,
  // and gymId → clubId in embedded team data
  await trans.table("competitions").toCollection().modify((comp: any) => {
    if (comp.competitors) {
      for (const cd of comp.competitors) {
        cd.clubId = cd.gymId;
        cd.clubName = cd.gymName;
        delete cd.gymId;
        delete cd.gymName;
      }
    }
    if (comp.teams) {
      for (const team of comp.teams) {
        team.clubId = team.gymId;
        delete team.gymId;
      }
    }
  });
});

// Version 3: drop the now-empty 'gyms' table.
this.version(3).stores({
  competitions: "++id, name, date, location, state",
  competitors: "++id, identifier, name, clubId",
  clubs: "++id, name",
});
```
