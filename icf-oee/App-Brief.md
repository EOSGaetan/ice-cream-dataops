---
appName: "Ice Cream Factory OEE"
externalId: "icf-oee"
infra: "appsApi"
customer: "Full Icecreamergies (the fictional ice cream company of the CDF Bootcamp, project 33)"
tier: "Tier 1: Monitoring & reporting"
owner: "Gaetan DESBRUERES <gaetan.desbrueres@totalenergies.com>"
userCount: ""
businessValue: ""
milestones: ""
repoUrl: "https://github.com/EOSGaetan/ice-cream-dataops"
userRole: "Performance engineer in the central operations team of Full Icecreamergies. Follows the Overall Equipment Effectiveness (OEE) of the 628 production units of the 10 ice cream factories. Works at a desk on a laptop, inside Cognite Data Fusion in a browser; can open the app on a tablet or a phone when away from the desk. Knows what OEE, quality, performance and availability mean; is not a CDF developer."
currentProblem: "The OEE of every unit is computed in CDF (time series written by the oee_timeseries function), but nothing shows it across the 10 sites. To know which site or which kind of unit is doing worst, the engineer has to open the time series one by one in CDF or ask a data engineer for an extract, then rebuild the comparison in Excel. Finding that one unit type performs badly in every factory takes a manual extract each time, so it is done rarely."
oneSentenceStory: "As a performance engineer who follows 10 ice cream factories, I want to see which sites and which types of unit have the lowest OEE and export the underlying averages so that I can decide where to act first and do my own analysis in Excel."
successCriteria: "From opening the app, the engineer names the lowest site and its three lowest units in under 1 minute; names the unit type that spends the most time below 70% OEE worldwide in under 1 minute (the ranking shows in under 10 seconds); and gets a CSV file of one week of one unit type, ready for Excel, in under 2 minutes, without help from a data engineer. The counts match the project data: 10 sites, 628 units with OEE time series (SC-001)."
userEvidence: "No contact with a real user: this is an assumption. The app is a bootcamp exercise on a training project; the persona, the problem and the success criteria were written by the builder's coding agent from the feature requests of the builder (Gaetan Desbrueres), who is the only person who has used the app. The times in the success criteria are targets, not measurements with users."
reviewedSections:
  - appDetails
  - who
  - problem
  - tasksAndSuccess
---

# App Brief — Ice Cream Factory OEE

## App details

- **Customer:** Full Icecreamergies (the fictional ice cream company of the CDF Bootcamp, project 33)
- **Tier:** Tier 1: Monitoring & reporting
- **Owner:** Gaetan DESBRUERES <gaetan.desbrueres@totalenergies.com>
- **Expected users:**
- **Business value:**
- **Milestones:**
- **Repository:** https://github.com/EOSGaetan/ice-cream-dataops (the app is in the `icf-oee/` folder)
- **App externalId:** icf-oee
- **Infra:** appsApi

## Who is this app for?

Performance engineer in the central operations team of Full Icecreamergies. Follows the Overall
Equipment Effectiveness (OEE) of the 628 production units of the 10 ice cream factories. Works at
a desk on a laptop, inside Cognite Data Fusion in a browser; can open the app on a tablet or a
phone when away from the desk. Knows what OEE, quality, performance and availability mean; is not
a CDF developer.

## What problem does this solve?

The OEE of every unit is computed in CDF (time series written by the `oee_timeseries` function),
but nothing shows it across the 10 sites. To know which site or which kind of unit is doing
worst, the engineer has to open the time series one by one in CDF or ask a data engineer for an
extract, then rebuild the comparison in Excel. Finding that one unit type performs badly in every
factory takes a manual extract each time, so it is done rarely.

## Tasks and success

**One-sentence story.** As a performance engineer who follows 10 ice cream factories, I want to
see which sites and which types of unit have the lowest OEE and export the underlying averages so
that I can decide where to act first and do my own analysis in Excel.

**Success criteria.** From opening the app, the engineer names the lowest site and its three
lowest units in under 1 minute; names the unit type that spends the most time below 70% OEE
worldwide in under 1 minute (the ranking shows in under 10 seconds); and gets a CSV file of one
week of one unit type, ready for Excel, in under 2 minutes, without help from a data engineer.
The counts match the project data: 10 sites, 628 units with OEE time series (SC-001).

**User evidence.** No contact with a real user: this is an assumption. The app is a bootcamp
exercise on a training project; the persona, the problem and the success criteria were written by
the builder's coding agent from the feature requests of the builder (Gaetan Desbrueres), who is
the only person who has used the app. The times in the success criteria are targets, not
measurements with users.
