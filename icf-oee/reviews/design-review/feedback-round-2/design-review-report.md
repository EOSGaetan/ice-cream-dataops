# Design Review — Ice Cream Factory OEE — round 2

Reviewed version: 0.0.10 (working tree on 2026-10-09; 0.0.9 active in the test project).
Scores proposed by the builder's coding agent from the probes of the `flows-design-review` skill,
the measurements listed below and the feedback of the builder on each draft version. This is a
self-assessment, not a review by Cognite.

## User and tasks

- **Primary user:** performance engineer in the central operations team of Full Icecreamergies,
  who follows the OEE of the 628 production units of 10 ice cream factories (from `App-Brief.md`).
- **Tasks evaluated:**
  1. Find the site with the lowest OEE and its three lowest units.
  2. Find the unit type that causes the most problems worldwide and open one of its units.
  3. Export one week of data of one unit type to a CSV file.
  4. Produce the weekly report of all sites and download it (new since round 1).
- **Context:** knows OEE, is not a CDF developer; works on a laptop in a browser inside Cognite
  Data Fusion, occasionally on a tablet or a phone. Success criteria: each task in under 1 to 2
  minutes, without help from a data engineer.

## Task walkthrough findings

The builder (Gaetan Desbrueres) opened each draft version in the test project
`cdf-bootcamp-33-test`, with the real data (10 sites, 628 units), before it was activated. His
feedback since round 1:

- **Task 1 — lowest site and its three lowest units.** Asked for the table under the map to use
  the colour code of the map for the OEE of a site (red below 80%, orange to 90%, green from
  90%). Done in 0.0.9; extended in 0.0.10 to the Site tab and to the weekly report, so a site
  has one colour code everywhere.
- **Task 2 — most problematic unit type and one of its units.** No finding reported.
- **Task 3 — CSV export.** No finding reported.
- **Task 4 — weekly report.** Draft 0.0.8 accepted without finding.

No step-by-step notes or screenshots were given: the findings above are the whole feedback. The
split of the view-model hook and the Zod parse of 0.0.10 do not change what the user sees.

## Scores

| Question | Score | Rationale | Improvement note |
| --- | --- | --- | --- |
| Q1 Aura consistency | 4 | Aura components in 22 files; 0 hard-coded colour in the app; the `aura/no-overriding-styles` lint rule reports 0 warning. Exceptions: the map is custom (no Aura equivalent) with four inline styles for positions and data colours, one colour token is overridden for contrast (`src/styles.css`), and size classes are added on touch screens and for stacked card headers. The downloaded report file is a standalone document with its own minimal style. | Move to Aura 1.x and check whether its components cover the touch sizes and the card header layout without added classes. |
| Q2 Navigation & hierarchy | 4 | Five tabs, the selected one is marked; every card has a title; the selection is kept in the address, so reload and shared links restore it. No navigation finding from the builder. | With five tabs the tab bar scrolls on a phone: the last tab is not visible at first. The way back from a unit opened from the Unit types tab is the tab itself. |
| Q3 Labels & language | 4 | 0 vague label; action labels are specific ("Export CSV", "Download report", "Try again", "Cancel"); every form field has a label; OEE is explained in the header. | The interface is in English only. |
| Q4 Feedback & validation | 4 | Loading, error and empty states on every data region; errors say what to do for the usual CDF answers and offer "Try again"; the export shows its size before it starts, its progress and its result; the report says which week it covers and confirms the download. | Required choices are not marked as such (every field has a default value). |
| Q5 Clickability | 4 | 0 `onClick` on a `div` or `span`; table rows have a pointer cursor, a hover background and a focus ring; map markers are buttons. | Rows do not look like buttons: the text above each table says "Select a row". |
| Q6 Error prevention | 5 | Read-only app: no destructive action (skill guidance for viewer apps). A running export can be cancelled; the export and report choices are kept when leaving the tab. | None. |
| Q7 Responsive | 4 | Checked at 375 px and 768 px on the local preview: no horizontal scroll of the page, every control at least 40 px high on touch screens, card descriptions in full, hover content also in a table, tab bar scrolling in its own frame. | Tables with 7 to 8 columns still scroll inside their frame on a phone; the markers of neighbouring European sites overlap; not checked on a real phone or tablet. |
| Q8 Empty states | 4 | 8 empty states with a title and the next step; a refused read (403) says to ask the project administrator for access; a week without value says so and blocks the download. | No in-app way to request access or to invite someone; sharing is by copying the address or sending the report file. |
| Q9 Performance | 4 | Measured in Fusion test with real data (0.0.5): unit type ranking about 2 s after the click, under 10 s when the tab is opened directly. Measured outside the browser: overview 14 requests, weekly report 22 requests in 0.7 s. Progressive display, charts loaded on demand, 5-minute cache. | Main JavaScript chunk 788 kB; no keyboard shortcut; the time to display was not measured again in Fusion after 0.0.5. |
| Q10 Accessibility | 4 | axe-core in a browser: 0 violation on four tabs (Unit types, Site, Export, Weekly report), one `target-size` on the overview map (overlapping markers; the table is the equivalent control). Text contrast 4.5:1 or more, zoom allowed, keyboard on every control, focus rings, levels given in text, same rules in the test suite on the five tabs. | Not tested with a screen reader. |

## Summary

- Average score: 4.1
- Quality level: Good

## Must Fix (any score < 3)

- None.

## Should Fix (any score 3 – 3.7)

- None.

## Nice to Fix (any score 3.8 – 4.4)

- Q1: move to Aura 1.x and reduce the added size classes.
- Q2: make the fifth tab visible on a phone without scrolling; an explicit way back from a unit opened from the Unit types tab.
- Q4: mark the choices an export needs.
- Q5: make selectable rows look selectable without relying on the hint text.
- Q7: a phone layout for the widest tables; spread the overlapping map markers; check on real devices.
- Q8: say how to request access from inside the app.
- Q9: split the main JavaScript chunk further; measure the display time in Fusion again.
- Q10: test with a screen reader.
