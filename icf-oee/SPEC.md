# Feature Specification: Ice Cream Factory OEE

<!--
  This is your app's living product spec. Edit it directly or ask your coding
  agent to collaborate with you on it.
-->

## User Scenarios & Testing

### User Stories

1. As an operations engineer, I want to pick a site and see the latest OEE of each of its
   units, so that I can spot the units that underperform without opening one chart per unit.
2. As an operations engineer, I want to open the OEE trend of one unit, so that I can see
   whether a low value is a one-off or a recurring drop.

### Acceptance Scenarios

- Given the app is open, when nothing was saved, then the Overview tab shows the 10 sites on a
  world map, each coloured by the level of its mean OEE, and a table with one row per site.
- Given the Overview tab, when I hover a site on the map, then a card shows the site OEE and
  the three units with the lowest OEE; the table below shows the same figures for every site.
- Given the Overview tab, when I select a site on the map or a row of the table, then the Site
  tab opens on that site.
- Given the Site tab, when no site is selected, then the list of the 10 sites is offered and
  the page asks me to select one.
- Given I select a site, when its data has loaded, then four tiles summarize the site (mean
  OEE, number of units, units below 70%, lowest unit) and a table lists every unit of that
  site that has OEE time series, lowest OEE first, with its latest OEE, quality, performance
  and availability, and the time of that latest value.
- Given the table is shown, when a unit has an OEE below 70% or below 85%, then its OEE
  stands out as a red or an orange badge.
- Given a site is selected, when I click a unit row, then the hourly average OEE of that unit
  is charted next to the table over the 7 days that end at its latest value, with the 70%
  threshold as a dashed line and a text summary (mean, minimum, maximum, hours below 70%);
  the row is marked as selected.
- Given a unit is selected, when I pick the 1W, 1M or 1Y time frame, then the trend covers the
  last 7, 30 or 365 days that end at the latest value (hourly, 4-hour or daily averages).
- Given I selected a tab, a site, a unit and a time frame, when I reload the page or share its
  URL, then the same selection is restored.
- Given a request to CDF fails, when the page renders, then an error message says what could
  not be loaded.

## Requirements

### Functional Requirements

- FR-001: System MUST list the sites as the `CogniteAsset` instances of `icapi_dm_space` that
  have no parent.
- FR-002: System MUST list the assets of the selected site as the `CogniteAsset` instances
  whose `root` is that site.
- FR-003: System MUST read the latest datapoint of the time series `<asset>:oee`,
  `<asset>:quality`, `<asset>:performance` and `<asset>:availability` in `oee_ts_space`, and
  show as units only the assets for which at least one of them exists.
- FR-004: System MUST show ratios as percentages with one decimal and timestamps in UTC.
- FR-005: System MUST chart the hourly average of `<unit>:oee` over the 7 days that end at
  the latest OEE datapoint of the unit (the OEE series can stop hours or days before now).
- FR-006: System MUST keep the selected site and unit in the host-synced state
  (`syncInternalState`) and restore them from `initialState`.
- FR-007: System MUST show a loading indicator, an empty state or an error message for each
  data region, and MUST NOT write anything to CDF.
- FR-008: System MUST show the company name (Full Icecreamergies) and its logo in the header.
- FR-009: System MUST summarize the selected site in four tiles: mean of the latest OEE of
  its units, number of units, number of units below the alert threshold, lowest unit.
- FR-010: System MUST flag an OEE below 0.70 (the alert threshold of the bootcamp monitoring
  task) as critical and below 0.85 as a warning, sort the table by ascending OEE by default
  and let the user sort by any column.
- FR-011: System MUST show the table and the trend side by side on large screens, without
  horizontal scrolling of the page.
- FR-012: System MUST offer the trend time frames 1W (7 days, hourly averages), 1M (30 days,
  4-hour averages) and 1Y (365 days, daily averages), all ending at the latest OEE datapoint.
- FR-013: System MUST offer an Overview tab with a world map of the sites: one marker per
  site, coloured by the level of the mean of the latest OEE of its units (FR-010 thresholds).
- FR-014: System MUST show, when a site marker is hovered, the site OEE and the three units
  with the lowest latest OEE, and MUST show the same figures for every site in a table below
  the map, lowest site OEE first.
- FR-015: System MUST open the Site tab on a site selected from the map or from the table,
  and keep the selected tab and time frame in the host-synced state.

## Success Criteria

- SC-001: The unit counts match the project data: 1021 assets over the 10 sites, 628 units
  with OEE time series.
- SC-002: Selecting a site shows its table without any manual refresh.

## Clarifications

- The OEE values are computed by the `oee_timeseries` Cognite Function of the bootcamp
  project; the app only reads them. Planned stops count as OEE = 0 in that function.

## Assumptions

- Read-only app, English UI, desktop first.
- The 0.85 warning threshold is a choice of this app, not a bootcamp value.
- The trend of quality, performance and availability is out of scope.
- The asset data carries no coordinates: the city of each site is listed in the app
  (`siteLocations.ts`). The map is an outline drawn in the app; no map service is called.
- A custom date range for the trend is out of scope; the shortcuts are the only time frames.
- The overview reads the units of all sites (about 40 requests) each time it is opened.

---

## Data Models & CDF Integration *(mandatory)*

### Existing views

- `cdf_cdm.CogniteAsset:v1` — sites (no `parent`) and their assets (`root` = site); `name`.
- `cdf_cdm.CogniteTimeSeries:v1` — the OEE time series, read through the datapoints API by
  `instanceId` (`timeseries/data/latest` and `timeseries/data/list`).

### New views

None.

### Spaces

- `icapi_dm_space` — the asset hierarchy (1021 `CogniteAsset`) and the measured time series.
- `oee_ts_space` — the computed time series (`:oee`, `:quality`, `:performance`,
  `:availability`, `:off_spec`), 5 per unit.
