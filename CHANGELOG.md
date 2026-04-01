# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.9.7](https://github.com/craigmiskell/gymscore/compare/v0.9.6...v0.9.7) (2026-04-01)


### Features

* Add a user-guide ([9f2b27f](https://github.com/craigmiskell/gymscore/commit/9f2b27fae2e135a367f9fa9bb08c411a1e5b3b2d))
* Add filter/sort to group column when preparing competition ([19a70a6](https://github.com/craigmiskell/gymscore/commit/19a70a62a26f518f78fdaeed2247ce54c45b047a))
* Auto suggest a team name ([d7f5153](https://github.com/craigmiskell/gymscore/commit/d7f51532bc731621292e9822fa9fbe86cfeac56b))
* Only allow one instance of the application ([79f851a](https://github.com/craigmiskell/gymscore/commit/79f851ae3ac4576c36e5ec263bfe773968fc652b))
* Split score recording by step ([1b25b6d](https://github.com/craigmiskell/gymscore/commit/1b25b6d81c54ad303a18ab49a7477d4b5da08e5f))


### Bug Fixes

* Final npm updates, including typescript to 4.9.5 ([fd1e8f3](https://github.com/craigmiskell/gymscore/commit/fd1e8f31307cbf6919d919525bfdc6bec5f2d853))
* fix ([afede45](https://github.com/craigmiskell/gymscore/commit/afede45f82a9ef5905529fe3775857e066705bb6))
* Fix focus in score recording modal after column re-ordering ([e994eae](https://github.com/craigmiskell/gymscore/commit/e994eae209a69ac2fd085a754d8677b8442941a5))
* Fix occasional failure to populate competitor modal when adding a competitor ([1439c77](https://github.com/craigmiskell/gymscore/commit/1439c772db2693930f6cd80aa5ba41e9a9c8a66f))
* Make score entry mirror the recording sheet ([241686b](https://github.com/craigmiskell/gymscore/commit/241686bb51b1c7a83788ef3575b33643a947d2fc))
* Re-order columns in announcements pdf ([86bc68e](https://github.com/craigmiskell/gymscore/commit/86bc68e687792db3984f8c0c3d3fbc3ed505ba50))
* Stop generating certificates ([47bb04c](https://github.com/craigmiskell/gymscore/commit/47bb04c7bd6de0e9a18b1dad31682d7239a76fe8))
* Trim whitespace on club name in recorder sheets ([125574a](https://github.com/craigmiskell/gymscore/commit/125574a9caf3cd304aa4fd3ef78584812d6efa76))

## [0.9.6](https://github.com/craigmiskell/gymscore/compare/v0.9.5...v0.9.6) (2026-03-29)


### Bug Fixes

* Add a logo/icon ([f1efa76](https://github.com/craigmiskell/gymscore/commit/f1efa7687865d6f81aef0f2c4cfd8754f1ae5f71))

## [0.9.5](///compare/v0.9.3...v0.9.5) (2026-03-29)


### Bug Fixes

* DO not append (imported) when an imported comp has a unique name 14bdcdd
* Fix for Windows layout in prepare_competition 67dfb11
* Package as single binary for windows a404725
* Some layout + formatting fixes for score recording a80a44f

## [0.9.4](///compare/v0.9.3...v0.9.4) (2026-03-29)


### Bug Fixes

* DO not append (imported) when an imported comp has a unique name 14bdcdd
* Fix for Windows layout in prepare_competition 67dfb11
* Some layout + formatting fixes for score recording a80a44f

## 0.9.3 (2026-03-29)


### Features

* A bunch of UX QoL fixes when adding competitors 5595539
* Add a first pass of logging 956e610
* Add announcments PDF 6ac6696
* Add disciplines to competition 33ba440
* Add edit competitors UI 41c8237
* Add generation of score recording sheets, first draft 0dfbf33
* Add OSS license display eb07590
* Add Programme PDF generation 10bdb6b
* Add results PDF abaa00b
* Adding competitors to competition f3149eb
* Allow a competitor to not be in a team 562850b
* Allow editing competitor entries 07cd03d
* Attempt at a smoother group assignment UX f73dbde
* Better autocomplete behavior for team + gym when adding competitor 8a10941
* Certificates, first draft 5b978a1
* COmpetition export/import 8750297
* competition validation, and tweaking layout to work well with that 38d725c
* Compress backups and add date to filename 98e3889
* Derive live version from package.json; bump to 0.9.0 as we enter beta-test phase 8f84ab9
* do not let a competition start until all competitors are assigned a group ca22444
* Earlier dupe competitor prevention, for better UX 722994f
* Escape key to close results modal 4239214
* Export/import functionality 33cb757
* filter and sort competitors when preparing bf28ee0
* Focus on filterName when opening competitors editing page b845b4d
* Implement 'Places' results PDF 3de0d68
* Logging subsystem and UI 2931b58
* Make competition details section collapsible a95ad59
* Make filter/sort in edit known competitors the same as preparecompetition de233cb
* Make the competitors editing page more usable 5df44da
* Organize the front page a bit more 105788f
* OSS license display cbd7ea8
* Prevent adding a competitor more than once to a competition 9681812
* Prevent adding a new competitor with the same national ID as an existing one 02bd955
* Refactor data management section for better UX 1604782
* Rework competition flow UX 9c3b5ea
* Rework the recording sheets to mirror prior art 21d65cd
* set focus usefully in results modal f40e758
* Show counts of competitors per group eeb31e6
* Show counts per cell when entering results 53888a6
* Show national ID in competitor list while preparing f27e248
* Sort competitors by Step when preparing a comp 98396ef
* Sort results entry by Step, delineate each step 724e371
* sort teams in autocomplete 1e7a2d3
* Step 9/10 do not require a Division 2b536aa
* Step/division hint for new competition entries ebf36dd
* Structure of live competition page and transitions to/from 24236e5
* Stub for Finish Competition 47ddf2d
* Upgrade electron et al 2fc7325
* UX improvements for entering scores 35e98cd


### Bug Fixes

* add 'Overall' to per-division sections of places.pdf beb8fca
* Add conventional-commit handling; fix is to show it working 35ab692
* Convert programme to landscape mode to avoid overlapping issue 986f5ac
* Fix a possible race condition when using autocomplete a0f55b3
* Fix import types to avoid compile-time warnings 888dcaa
* fix precommit to check ts files, and fix issues it reveals 832516a
* In announcements pdf, put team section on new page 99e2a48
* Make national ID not editable when adding an existing competitor to a competition 58d8401
* Make prepare competition UX more intuitive 2f14201
* Move logs link to hamburger menu 9efa6ae
* Move modals below active content 9580970
* prepare the team autocomplete even if club was not set with autocomplete 8cfae80
* Prevent autocomplete showing after adding competitor c353f98
* remove some jank 360158c
* Small UX QoL changes 560864f
* Spacing for buttons on main page a09e7d3
* Tidyup prep competition, make disciplines work 28f6c3b
* UX improvements when adding competitors 87c5475
* Wider national ID on recorder sheets to fit 6 digits 783df88
* wrap competitors names in the team section of places pdf 3b0db2d

## 0.9.2 (2026-03-29)


### Features

* A bunch of UX QoL fixes when adding competitors 5595539
* Add a first pass of logging 956e610
* Add announcments PDF 6ac6696
* Add disciplines to competition 33ba440
* Add edit competitors UI 41c8237
* Add generation of score recording sheets, first draft 0dfbf33
* Add OSS license display eb07590
* Add Programme PDF generation 10bdb6b
* Add results PDF abaa00b
* Adding competitors to competition f3149eb
* Allow a competitor to not be in a team 562850b
* Allow editing competitor entries 07cd03d
* Attempt at a smoother group assignment UX f73dbde
* Better autocomplete behavior for team + gym when adding competitor 8a10941
* Certificates, first draft 5b978a1
* COmpetition export/import 8750297
* competition validation, and tweaking layout to work well with that 38d725c
* Compress backups and add date to filename 98e3889
* Derive live version from package.json; bump to 0.9.0 as we enter beta-test phase 8f84ab9
* do not let a competition start until all competitors are assigned a group ca22444
* Earlier dupe competitor prevention, for better UX 722994f
* Escape key to close results modal 4239214
* Export/import functionality 33cb757
* filter and sort competitors when preparing bf28ee0
* Focus on filterName when opening competitors editing page b845b4d
* Implement 'Places' results PDF 3de0d68
* Logging subsystem and UI 2931b58
* Make competition details section collapsible a95ad59
* Make filter/sort in edit known competitors the same as preparecompetition de233cb
* Make the competitors editing page more usable 5df44da
* Organize the front page a bit more 105788f
* OSS license display cbd7ea8
* Prevent adding a competitor more than once to a competition 9681812
* Prevent adding a new competitor with the same national ID as an existing one 02bd955
* Refactor data management section for better UX 1604782
* Rework competition flow UX 9c3b5ea
* Rework the recording sheets to mirror prior art 21d65cd
* set focus usefully in results modal f40e758
* Show counts of competitors per group eeb31e6
* Show counts per cell when entering results 53888a6
* Show national ID in competitor list while preparing f27e248
* Sort competitors by Step when preparing a comp 98396ef
* Sort results entry by Step, delineate each step 724e371
* sort teams in autocomplete 1e7a2d3
* Step 9/10 do not require a Division 2b536aa
* Step/division hint for new competition entries ebf36dd
* Structure of live competition page and transitions to/from 24236e5
* Stub for Finish Competition 47ddf2d
* Upgrade electron et al 2fc7325
* UX improvements for entering scores 35e98cd


### Bug Fixes

* add 'Overall' to per-division sections of places.pdf beb8fca
* Add conventional-commit handling; fix is to show it working 35ab692
* Convert programme to landscape mode to avoid overlapping issue 986f5ac
* Fix a possible race condition when using autocomplete a0f55b3
* Fix import types to avoid compile-time warnings 888dcaa
* fix precommit to check ts files, and fix issues it reveals 832516a
* In announcements pdf, put team section on new page 99e2a48
* Make national ID not editable when adding an existing competitor to a competition 58d8401
* Make prepare competition UX more intuitive 2f14201
* Move logs link to hamburger menu 9efa6ae
* Move modals below active content 9580970
* prepare the team autocomplete even if club was not set with autocomplete 8cfae80
* Prevent autocomplete showing after adding competitor c353f98
* remove some jank 360158c
* Small UX QoL changes 560864f
* Spacing for buttons on main page a09e7d3
* Tidyup prep competition, make disciplines work 28f6c3b
* UX improvements when adding competitors 87c5475
* Wider national ID on recorder sheets to fit 6 digits 783df88
* wrap competitors names in the team section of places pdf 3b0db2d

## 0.9.1 (2026-03-29)


### Features

* A bunch of UX QoL fixes when adding competitors 5595539
* Add a first pass of logging 956e610
* Add announcments PDF 6ac6696
* Add disciplines to competition 33ba440
* Add edit competitors UI 41c8237
* Add generation of score recording sheets, first draft 0dfbf33
* Add OSS license display eb07590
* Add Programme PDF generation 10bdb6b
* Add results PDF abaa00b
* Adding competitors to competition f3149eb
* Allow a competitor to not be in a team 562850b
* Allow editing competitor entries 07cd03d
* Attempt at a smoother group assignment UX f73dbde
* Better autocomplete behavior for team + gym when adding competitor 8a10941
* Certificates, first draft 5b978a1
* COmpetition export/import 8750297
* competition validation, and tweaking layout to work well with that 38d725c
* Compress backups and add date to filename 98e3889
* Derive live version from package.json; bump to 0.9.0 as we enter beta-test phase 8f84ab9
* do not let a competition start until all competitors are assigned a group ca22444
* Earlier dupe competitor prevention, for better UX 722994f
* Escape key to close results modal 4239214
* Export/import functionality 33cb757
* filter and sort competitors when preparing bf28ee0
* Focus on filterName when opening competitors editing page b845b4d
* Implement 'Places' results PDF 3de0d68
* Logging subsystem and UI 2931b58
* Make competition details section collapsible a95ad59
* Make filter/sort in edit known competitors the same as preparecompetition de233cb
* Make the competitors editing page more usable 5df44da
* Organize the front page a bit more 105788f
* OSS license display cbd7ea8
* Prevent adding a competitor more than once to a competition 9681812
* Prevent adding a new competitor with the same national ID as an existing one 02bd955
* Refactor data management section for better UX 1604782
* Rework competition flow UX 9c3b5ea
* Rework the recording sheets to mirror prior art 21d65cd
* set focus usefully in results modal f40e758
* Show counts of competitors per group eeb31e6
* Show counts per cell when entering results 53888a6
* Show national ID in competitor list while preparing f27e248
* Sort competitors by Step when preparing a comp 98396ef
* Sort results entry by Step, delineate each step 724e371
* sort teams in autocomplete 1e7a2d3
* Step 9/10 do not require a Division 2b536aa
* Step/division hint for new competition entries ebf36dd
* Structure of live competition page and transitions to/from 24236e5
* Stub for Finish Competition 47ddf2d
* Upgrade electron et al 2fc7325
* UX improvements for entering scores 35e98cd


### Bug Fixes

* add 'Overall' to per-division sections of places.pdf beb8fca
* Add conventional-commit handling; fix is to show it working 35ab692
* Convert programme to landscape mode to avoid overlapping issue 986f5ac
* Fix a possible race condition when using autocomplete a0f55b3
* Fix import types to avoid compile-time warnings 888dcaa
* fix precommit to check ts files, and fix issues it reveals 832516a
* In announcements pdf, put team section on new page 99e2a48
* Make national ID not editable when adding an existing competitor to a competition 58d8401
* Make prepare competition UX more intuitive 2f14201
* Move logs link to hamburger menu 9efa6ae
* Move modals below active content 9580970
* prepare the team autocomplete even if club was not set with autocomplete 8cfae80
* Prevent autocomplete showing after adding competitor c353f98
* remove some jank 360158c
* Small UX QoL changes 560864f
* Spacing for buttons on main page a09e7d3
* Tidyup prep competition, make disciplines work 28f6c3b
* UX improvements when adding competitors 87c5475
* Wider national ID on recorder sheets to fit 6 digits 783df88
* wrap competitors names in the team section of places pdf 3b0db2d
