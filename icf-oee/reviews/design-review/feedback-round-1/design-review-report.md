# Design Review — Ice Cream Factory OEE — round 1

Reviewed version: 0.0.7 (working tree on 2026-10-09; 0.0.6 active in the test project).
Scores proposed by the builder's coding agent from the probes of the `flows-design-review` skill,
the measurements listed below and the walkthrough of the builder. This is a self-assessment, not
a review by Cognite.

## User and tasks

- **Primary user:** performance engineer in the central operations team of Full Icecreamergies,
  who follows the OEE of the 628 production units of 10 ice cream factories (from `App-Brief.md`).
- **Tasks evaluated:**
  1. Find the site with the lowest OEE and its three lowest units.
  2. Find the unit type that causes the most problems worldwide and open one of its units.
  3. Export one week of data of one unit type to a CSV file.
- **Context:** knows OEE, is not a CDF developer; works on a laptop in a browser inside Cognite
  Data Fusion, occasionally on a tablet or a phone. Success criteria: each task in under 1 to 2
  minutes, without help from a data engineer.

## Task walkthrough findings

Walked by the builder (Gaetan Desbrueres) in the test project `cdf-bootcamp-33-test`, on version
0.0.6 with the real data (10 sites, 628 units). His answer, in one sentence for the three tasks:
everything is fine in the app, except the colour code of the map.

- **Task 1 — lowest site and its three lowest units.** One finding: the colour code of
  the map markers (red below 70%, orange from 70% to 85%, green from 85%) was too lenient for the
  OEE of a whole site. Asked for: green from 90%, orange from 80% to 90%, red below 80%. Fixed in
  0.0.7 (markers, legend and the site value in the hover card).
- **Task 2 — most problematic unit type and one of its units.** No finding reported.
- **Task 3 — CSV export of one week of one unit type.** No finding reported.

No step-by-step notes or screenshots were given: the findings above are the whole feedback.

## Scores

| Question | Score | Rationale | Improvement note |
| --- | --- | --- | --- |
| Q1 Aura consistency | 4 | Aura components in 20 files; 0 hard-coded colour; the `aura/no-overriding-styles` lint rule reports 0 warning. Exceptions: the map is custom (no Aura equivalent), one colour token is overridden for contrast (`src/styles.css`), and size classes are added on touch screens and for stacked card headers. | Move to Aura 1.x and check whether its components cover the touch sizes and the card header layout without added classes. |
| Q2 Navigation & hierarchy | 4 | Four tabs, the selected one is marked; every card has a title; the selection is kept in the address, so reload and shared links restore it. Walkthrough: no navigation finding. | The way back from a unit opened from the Unit types tab is the tab itself; there is no explicit "back" link. |
| Q3 Labels & language | 4 | 0 vague label ("Submit", "OK"); action labels are specific ("Export CSV", "Try again", "Cancel"); every form field has a label; OEE is explained in the header. | The interface is in English only. |
| Q4 Feedback & validation | 4 | Loading, error and empty states on every data region; errors say what to do for the usual CDF answers and offer "Try again"; the export shows its size before it starts, explains live why it cannot start, shows its progress and its result. | Required choices are not marked as such (every field has a default value). |
| Q5 Clickability | 4 | 0 `onClick` on a `div` or `span`; table rows have a pointer cursor, a hover background and a focus ring; map markers are buttons. | Rows do not look like buttons: the text above each table says "Select a row". |
| Q6 Error prevention | 5 | Read-only app: no destructive action (skill guidance for viewer apps). A running export can be cancelled; the export choices are kept when leaving the tab. | None. |
| Q7 Responsive | 4 | Checked at 375 px and 768 px on the four tabs of the local preview: no horizontal scroll of the page, every control at least 40 px high on touch screens, card descriptions in full, hover content also in a table. | Tables with 7 to 8 columns still scroll inside their frame on a phone; the markers of neighbouring European sites overlap; not checked on a real phone or tablet. |
| Q8 Empty states | 4 | 7 empty states with a title and the next step ("No site selected", "No unit type selected", "No OEE values"…); a refused read (403) says to ask the project administrator for access. | No in-app way to request access or to invite someone; sharing is by copying the address. |
| Q9 Performance | 4 | Measured in Fusion test with real data (0.0.5): unit type ranking about 2 s after the click, under 10 s when the tab is opened directly, Fusion loading included (20 to 25 s in 0.0.4). Progressive display, charts loaded on demand, 5-minute cache, time-frame shortcuts. | Main JavaScript chunk still 756 kB; no keyboard shortcut. |
| Q10 Accessibility | 4 | axe-core in a browser: 0 violation on three tabs, one `target-size` on the overview map (overlapping markers; the table is the equivalent control). Text contrast 4.5:1 or more, zoom allowed, keyboard on every control, focus rings, OEE level given in text, same rules in the test suite. | Not tested with a screen reader. |

## Summary

- Average score: 4.1
- Quality level: Good

## Must Fix (any score < 3)

- None.

## Should Fix (any score 3 – 3.7)

- None.

## Nice to Fix (any score 3.8 – 4.4)

- Q1: move to Aura 1.x and reduce the added size classes.
- Q2: an explicit way back from a unit opened from the Unit types tab.
- Q3: none planned (English only is accepted for this app).
- Q4: mark the choices an export needs.
- Q5: make selectable rows look selectable without relying on the hint text.
- Q7: a phone layout for the widest tables; spread the overlapping map markers; check on real devices.
- Q8: say how to request access from inside the app.
- Q9: split the main JavaScript chunk further.
- Q10: test with a screen reader.
