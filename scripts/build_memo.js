// Generates report/CDF-Bootcamp-Memo.docx (English only).
// Usage: node build_memo.js <logo.png> <output.docx> [img_dir]   (img_dir defaults to ../report/img)
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageNumber,
  Paragraph, ShadingType, Table, TableCell, TableRow, TabStopType, TextRun, VerticalAlign, WidthType,
} = require("docx");

const [logoPath, outPath, imgArg] = process.argv.slice(2);
const IMG_DIR = imgArg || path.join(__dirname, "..", "report", "img");
const NAVY = "14213D", TEXT = "2B2B2B", MUTED = "5F6B7A", RULE = "B8C4D6", HEAD_FILL = "E8EEF5", OK = "1E7B4F", WARN = "9A6700";
const FONT = "Arial", MONO = "Consolas";
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1190; // A4, 2.1 cm margins
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9298 DXA

// Inline markup: `code` and **bold**
function runs(text, base = {}) {
  const out = [];
  for (const part of String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("`")) out.push(new TextRun({ ...base, text: part.slice(1, -1), font: MONO, size: (base.size || 21) - 1 }));
    else if (part.startsWith("**")) out.push(new TextRun({ ...base, text: part.slice(2, -2), bold: true }));
    else out.push(new TextRun({ ...base, text: part }));
  }
  return out;
}
const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 288 }, ...opts, children: runs(text, opts.run) });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const bullet = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 70, line: 280 }, children: runs(text) });
const note = (text) => p(text, { run: { size: 18, color: MUTED, italics: true }, spacing: { before: 80, after: 160 } });

const border = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, width, { header = false, align = AlignmentType.LEFT, color, keepNext = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: header ? { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({ alignment: align, keepNext, children: runs(text, { size: 18, bold: header, color: color || (header ? NAVY : TEXT) }) })],
  });
}
// widths are fractions of the content width; aligns is an optional array of 'r' for right-aligned columns
function table(headers, rows, fractions, aligns = []) {
  const widths = fractions.map((f) => Math.round(CONTENT_W * f));
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const al = (i) => (aligns[i] === "r" ? AlignmentType.RIGHT : AlignmentType.LEFT);
  const keep = rows.length <= 6; // only small tables are kept on one page
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { header: true, align: al(i), keepNext: keep })) }),
      ...rows.map((r, rowIndex) => new TableRow({ cantSplit: true, children: r.map((c, i) => {
        const status = c === "OK" || c === "Done" ? OK : c === "In progress" || c === "To confirm" || c === "To do" ? WARN : undefined;
        return cell(c, widths[i], { align: al(i), color: status, keepNext: keep && rowIndex < rows.length - 1 });
      }) })),
    ],
  });
}
const gap = (after = 160) => new Paragraph({ spacing: { after }, children: [] });

// ---- screenshots: JPEG files of report/img, scaled to a width in pixels (620 px = full text width) ----
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("not a baseline or progressive JPEG");
}
const FULL_W = 620;
function figure(file, caption, width = FULL_W) {
  const data = fs.readFileSync(path.join(IMG_DIR, file));
  const { w, h } = jpegSize(data);
  return [
    new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: "jpg", data, transformation: { width, height: Math.round((width * h) / w) }, outline: { type: "solidFill", solidFillType: "rgb", value: RULE, width: 9525 }, altText: { title: file, description: caption.replace(/[*`]/g, ""), name: file } })] }),
    p(caption, { run: { size: 18, color: MUTED }, spacing: { after: 200 } }),
  ];
}

// ---- logo size from the PNG header ----
const logo = fs.readFileSync(logoPath);
const lw = logo.readUInt32BE(16), lh = logo.readUInt32BE(20);
const LOGO_W = 92, LOGO_H = Math.round((LOGO_W * lh) / lw);

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
function memoRow(label, value) {
  const w = [1500, CONTENT_W - 1500];
  return new TableRow({ children: [
    new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: MUTED, size: 20 })] })] }),
    new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders: noBorders, margins: { top: 40, bottom: 40, left: 0, right: 0 },
      children: [new Paragraph({ children: runs(value, { size: 20 }) })] }),
  ] });
}

const children = [
  new Paragraph({ spacing: { after: 120 }, children: [new ImageRun({ type: "png", data: logo, transformation: { width: LOGO_W, height: LOGO_H }, altText: { title: "TotalEnergies", description: "TotalEnergies logo", name: "logo" } })] }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "MEMO", bold: true, size: 44, color: NAVY, characterSpacing: 60 })] }),
  new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [1500, CONTENT_W - 1500], rows: [
    memoRow("To", "EOS team and Cognite Data Fusion stakeholders"),
    memoRow("From", "Gaetan Desbrueres, EOS Engineer, OT/TL/EOS (CDF Technical Referent for CLOV)"),
    memoRow("Date", "6 October 2026"),
    memoRow("Subject", "**Cognite Data Fusion Bootcamp: end-to-end OEE pipeline built as code and running in test and production**"),
  ] }),
  new Paragraph({ spacing: { before: 100, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 1 } }, children: [] }),

  h1("1. Executive summary"),
  p("The Cognite Data Fusion (CDF) Bootcamp, held from 5 to 8 October 2026, has each participant build an end-to-end data solution for a fictional Ice Cream Factory, entirely as code: ingest assets and time series from a REST API, structure them in a data model, calculate Overall Equipment Effectiveness (OEE), orchestrate the pipeline, and use the result in Charts and Canvas."),
  p("**As of 6 October, the complete pipeline is deployed and running unattended in both the test and the production project, with identical and verified results.** This was confirmed on the morning of 6 October, after a night of unattended operation, by an automated health check of 21 read-only controls per project. The work planned for the first three bootcamp days was completed on 5 October, and the Charts and Canvas exercises of the fourth day on 6 October, which closes the programme."),
  bullet("**Scope delivered.** 28 CDF resources per environment, all defined in configuration files and deployed with the Cognite Toolkit: access groups, data sets, staging, hosted extractors, transformations, functions, schedules and a data workflow."),
  bullet("**Data in place.** 1,021 assets organised in a five-level hierarchy and 5,652 time series (2,512 measured, 3,140 calculated), with 14 days of history, in each environment."),
  bullet("**Reproducibility demonstrated.** Production reached a complete and verified state 44 minutes after its main deployment, using the same files as test with different values only."),
  bullet("**Two findings beyond the course material.** A platform-computed asset property (`path`) was incomplete after the standard load and silently excluded up to 32% of the time series from downstream processing; and a single-pass production deployment would have started the extractors before their access rights existed. Both were diagnosed, fixed and documented."),
  bullet("**Data put to use.** A chart with an independent recalculation of OEE and an alert, and a canvas that explains the OEE drops of one machine: 28 stops in 15 days, 13 of them unplanned."),
  bullet("**Remaining.** The post-bootcamp quiz, and the GitHub repository part of the evaluation: the work was done locally, and the move to a repository with GitHub Actions is documented (section 9) but not yet executed."),
  gap(80),
  table(["Key figure", "Test", "Production"], [
    ["CDF resources deployed", "28", "28"],
    ["Assets (of which root sites)", "1,021 (10)", "1,021 (10)"],
    ["Measured time series containing values", "2,512", "2,512"],
    ["Calculated OEE time series containing values", "3,140", "3,140"],
    ["Total time series", "5,652", "5,652"],
  ], [0.5, 0.25, 0.25], [null, "r", "r"]),

  h1("2. Context and objectives"),
  p("The bootcamp is Cognite's hands-on training for delivering a CDF project the way a production project is expected to be delivered: configuration as code, separate test and production projects, least-privilege access, and automated orchestration. It runs in a dedicated training tenant (organisation `cog-enablement-bootcamp`, cluster `westeurope-1`) with its own Microsoft Entra ID directory. It has no connection with any TotalEnergies CDF project."),
  p("Each participant receives two CDF projects, here `cdf-bootcamp-33-test` and `cdf-bootcamp-33-prod`. The evaluation has four components, with a 70% pass mark: the CDF projects (40%, all data present in test and production), the GitHub repository (20%), the Canvas (20%) and a multiple-choice quiz (20%)."),
  p("The objective of this memo is to record what was built, the data it produces, the problems met and how they were solved, so that the approach can be reused and explained."),

  h1("3. Solution overview"),
  p("The solution is a chain of seven building blocks. Each one is a set of YAML or SQL files in the project folder; nothing is configured by hand in the user interface except the single group that authorises the deployment tool."),
  table(["Stage", "CDF components", "What it does", "Runs"], [
    ["Access", "6 service principals, 4 CDF groups per environment", "Links Entra ID identities to CDF rights through the group Object ID (`sourceId`). One group per use case, scoped to its data set.", "Static"],
    ["Ingestion", "2 hosted extractors (source, mapping, destination, job)", "Loads the asset list into the RAW staging table and creates the time series in the data model.", "Daily and hourly"],
    ["Modeling", "2 transformations (Spark SQL)", "Builds the `CogniteAsset` hierarchy from RAW and links each time series to its asset (contextualisation).", "Nightly and via workflow"],
    ["Values", "Function `icapi_datapoints_extractor`", "Loads datapoints from the API into the measured time series.", "Every 10 min, nightly gap fill"],
    ["Calculation", "Function `oee_timeseries`", "Calculates quality, performance, availability, OEE and off-spec for each production unit.", "Every 5 min"],
    ["Orchestration", "Data workflow `wf_icapi_data_pipeline`", "Runs the four processing steps in dependency order.", "Every 15 min"],
    ["Monitoring", "Extraction pipeline `ep_icapi_datapoints`", "Receives the outcome of every extractor run.", "On each run"],
  ], [0.14, 0.25, 0.43, 0.18]),
  gap(),
  table(["Bootcamp day", "Theme", "Resources", "Test", "Production"], [
    ["Day 1", "Data Foundation: access, data sets, RAW, spaces", "9", "Done", "Done"],
    ["Day 2", "Data Integration A and Data Modeling: extractors, transformations", "10", "Done", "Done"],
    ["Day 3", "Data Integration B and Orchestration: functions, workflow", "9", "Done", "Done"],
    ["Day 4", "Charts and Canvas (performed in the production project)", "n/a", "n/a", "Done"],
  ], [0.13, 0.47, 0.12, 0.12, 0.16], [null, null, "r"]),

  h1("4. Data"),
  h2("4.1 Source and model"),
  p("The single data source is the Ice Cream Factory REST API. It exposes the asset list as a CSV file, the list of time series, and their datapoints. Assets follow the ISA-95 naming standard and are organised by site, area and production unit."),
  p("The plant has ten sites, each with four areas: receiving and raw material, production, cold store, product. Sites come in three sizes, with one, two or three production branches of seven lines each, which explains the three asset counts of section 4.2. Each of the 628 production units carries four series: `count` (items produced), `good` (conforming items), `status` (the machine is running) and `planned_status` (it was meant to run)."),
  p("Data is stored in the Cognite Core Data Model: assets as `CogniteAsset` and time series as `CogniteTimeSeries`, in the space `icapi_dm_space` for source data and `oee_ts_space` for calculated data. Two data sets separate governance: `ds_icapi` for source data and `ds_uc_oee` for the OEE use case."),
  p("In data modeling terms, each asset and each time series is an instance (a node) living in one of our spaces. `CogniteAsset` and `CogniteTimeSeries` are views of the Core Data Model: they expose properties that are physically stored in containers. The link from an asset to its parent, and from a time series to its asset, is a direct relation written by the two transformations; the reverse links (`children`, `timeSeries`) and the `path` are maintained by the platform."),
  h2("4.2 Volumes"),
  table(["Object", "Count", "Notes"], [
    ["Rows in the RAW table `ice-cream-factory-db.assets`", "1,021", "One row per asset, keyed by its external ID"],
    ["Assets (`CogniteAsset`)", "1,021", "Five levels: 10 sites, 40, 173, 608 and 190 assets"],
    ["Production units carrying time series", "628", "Each unit has four measured series"],
    ["Measured time series", "2,512", "`count`, `good`, `status`, `planned_status`"],
    ["Calculated time series", "3,140", "`quality`, `performance`, `availability`, `oee`, `off_spec`"],
    ["History loaded", "14 days", "About 20,160 points per counter series (one per minute)"],
  ], [0.44, 0.14, 0.42], [null, "r"]),
  gap(),
  table(["Site", "Size", "Assets", "Production units", "Measured series", "OEE series"], [
    ["Chicago", "Small", "58", "34", "136", "170"],
    ["Hannover", "Medium", "107", "66", "264", "330"],
    ["Houston", "Small", "58", "34", "136", "170"],
    ["Kuala Lumpur", "Large", "156", "98", "392", "490"],
    ["London", "Medium", "107", "66", "264", "330"],
    ["Marseille", "Medium", "107", "66", "264", "330"],
    ["Nuremberg", "Large", "156", "98", "392", "490"],
    ["Oslo", "Small", "58", "34", "136", "170"],
    ["Rotterdam", "Large", "156", "98", "392", "490"],
    ["Sao Paulo", "Small", "58", "34", "136", "170"],
    ["**Total**", "", "**1,021**", "**628**", "**2,512**", "**3,140**"],
  ], [0.22, 0.14, 0.14, 0.18, 0.16, 0.16], [null, null, "r", "r", "r", "r"]),
  note("Figures read from the test project; the production project holds the same counts. A small site has one production branch of seven lines, a medium site two, a large site three."),
  h2("4.3 OEE calculation"),
  p("OEE is the share of planned production time that is truly productive: 100% means only conforming items, at the maximum rate, with no downtime. It is used to track the reduction of losses on a machine and to compare lines, shifts or an industry standard."),
  p("OEE is the product of three ratios, calculated per production unit and per minute by the function supplied with the bootcamp:", { keepNext: true }),
  table(["Calculated series", "Formula (per minute)", "Meaning"], [
    ["`quality`", "`good / count`", "Share of conforming items"],
    ["`performance`", "`(count / status) / 20`", "Actual rate against the ideal rate of one item every three seconds"],
    ["`availability`", "`status / planned_status`", "Running time against planned running time"],
    ["`oee`", "`quality x performance x availability`", "Overall Equipment Effectiveness"],
    ["`off_spec`", "`count - good`", "Number of non-conforming items"],
  ], [0.2, 0.36, 0.44]),
  note("For the unit used in the Charts and Canvas exercises (OSPRPATA241, the Oslo Balance Tank), the average OEE over the loaded period is 0.83, and 43 of the 310 hourly averages fall below the 0.7 alert threshold."),
  h2("4.4 Data quality controls"),
  p("Every step was verified by counting against an expected value rather than by relying on a status. The same controls are now automated in a read-only script, `scripts/check_project.py`."),
  table(["Control", "Expected", "Test", "Production"], [
    ["Service principals that obtain their CDF group", "3", "3", "3"],
    ["RAW rows, with unique keys", "1,021", "1,021", "1,021"],
    ["Assets created", "1,021", "1,021", "1,021"],
    ["Root assets (the sites)", "10", "10", "10"],
    ["Assets whose parent does not exist", "0", "0", "0"],
    ["Assets with an incomplete `path`, before repair", "0", "182", "294"],
    ["Assets with an incomplete `path`, after repair", "0", "0", "0"],
    ["Time series linked to exactly one asset", "2,512", "2,512", "2,512"],
    ["Links to a wrong or missing asset", "0", "0", "0"],
    ["Measured series containing values", "2,512", "2,512", "2,512"],
    ["OEE series containing a full history", "3,140", "3,140", "3,140"],
    ["Workflow tasks succeeded on first execution", "4", "4", "4"],
  ], [0.52, 0.16, 0.16, 0.16], [null, "r", "r", "r"]),
  note("Known limitation of the supplied OEE code: for each unit the calculation stops at the oldest of the latest points of its four input series. Because the two status series only record changes of state, the OEE series of a unit can end several days before the present. This is a property of the bootcamp code, not a loading fault. In production, one workflow task succeeded on its second attempt because two executions overlapped."),

  h2("4.5 What the data shows"),
  p("The Canvas exercise asks why the OEE of one machine drops. Reading the series of the Oslo Balance Tank (OSPRPATA241) minute by minute over 15 days, and crossing them with the machine state, gives a clear answer:", { keepNext: true }),
  table(["Phenomenon", "Occurrences", "Duration", "Signature in the series"], [
    ["Planned stop", "15", "994 min", "`status` = 0 and `planned_status` = 0; OEE and its three components fall to 0 together"],
    ["Unplanned stop", "13", "1,007 min", "`status` = 0 while `planned_status` = 1; the real availability loss"],
    ["Quality dip while running", "62", "312 min", "Quality at 0.71 instead of 0.95 for about 7 minutes, at the same times every day; performance steady at 0.97"],
  ], [0.22, 0.13, 0.13, 0.52], [null, "r", "r"]),
  note("OEE is zero for 10.8% of the time, always with the machine stopped: about one planned and one unplanned stop per day. The supplied calculation also counts planned stops as zero OEE, because a division by zero is replaced by 0; a standard OEE definition excludes them, which would put the average for this unit at about 0.87 instead of 0.83. The recalculation of OEE in Charts gave the same mean as the function (0.828) over the period displayed. Screenshots of the chart, the calculation, the alert and the canvas are in Appendix C (figures 8 to 14)."),

  h1("5. Access and security model"),
  p("Identity is managed in Microsoft Entra ID and rights in CDF; the Object ID of an Entra group, copied into a CDF group as its `sourceId`, is the only link between the two. Three service principals exist per environment, each a member of one Entra group:", { keepNext: true }),
  table(["Role", "CDF group", "Used for", "Scope of rights"], [
    ["Deployment", "`cognite_toolkit_service_principal`", "Deploying all configuration with the Toolkit", "All resource types"],
    ["Extraction", "`icapi_extractors`", "Hosted extractors, transformations, functions and the workflow trigger", "Scoped to the source data set and the RAW table `assets` where the platform allows"],
    ["OEE use case", "`data_pipeline_oee`", "The OEE calculation function", "Reads source data, writes OEE data"],
    ["Users", "`data_developer`", "Developers working in the Fusion user interface", "Read and write"],
  ], [0.16, 0.3, 0.32, 0.22]),
  gap(80),
  bullet("Secrets are kept only in two local files, `.env` for test and `.env.prod` for production. Configuration files refer to them by variable name; no secret appears in the modules, in the build output or in this memo."),
  bullet("A missing Entra group membership raises no error at deployment: the account authenticates but holds no rights. The reliable control is to ask CDF which groups each account actually obtains (token inspection), which the health check does."),

  h1("6. Deployment approach"),
  bullet("**Configuration as code.** All resources are defined in files under `modules/` and deployed with the Cognite Toolkit, pinned to version 0.6.53 as required by the course. Each change follows the same cycle: build, dry-run, deploy, then a control."),
  bullet("**Same files, two environments.** Test and production differ only by a configuration file (`config.test.yaml`, `config.prod.yaml`) and a secrets file. Production commands must name their secrets file and build folder explicitly, so an ordinary deployment command cannot reach production by accident."),
  bullet("**Two-pass production deployment.** Access groups, data sets, staging and spaces first, followed by a control of effective access; everything else second. This ordering is what allowed the production extractors to succeed on their first run."),
  bullet("**Working method.** Configuration files, verification scripts and diagnostics were produced with an AI coding assistant; the actions in the Entra and Fusion portals and every deployment were carried out by the author, with the exception of one canvas annotation drawn by the assistant through the browser. The work was done locally, without GitHub; section 9 describes how to move it to a repository."),
  gap(80),
  table(["Milestone, 5 October 2026", "Time (UTC)"], [
    ["Foundations deployed and verified in test", "Morning"],
    ["Hosted extractors delivering data in test (after an access fix)", "12:16"],
    ["Asset hierarchy and contextualisation completed in test", "12:25"],
    ["Asset paths repaired in test", "12:46"],
    ["History loaded and OEE calculated in test", "13:07"],
    ["Workflow first execution completed in test", "13:19"],
    ["Production: main deployment", "14:49"],
    ["Production: complete and verified", "15:34"],
  ], [0.74, 0.26], [null, "r"]),

  h1("7. Issues encountered and resolutions"),
  table(["Issue", "Cause", "Resolution"], [
    ["Deployment tool rejected the course configuration", "Latest Toolkit version installed instead of the version pinned by the course", "Installed exactly version 0.6.53"],
    ["`Invalid client secret` at authentication", "The secret identifier was copied instead of the secret value", "New secrets created and the value copied at creation"],
    ["`CERTIFICATE_VERIFY_FAILED` when reaching CDF", "The corporate proxy re-signs traffic; Python does not use the Windows certificate store by default", "Python configured to use the Windows store; TLS verification kept on"],
    ["Extractors failed with a 403 on their first run (test)", "One service principal had not been added to its Entra group", "Membership added; effective access now controlled before deploying anything that runs"],
    ["A corrected extractor job did not run again", "A job only retries at its interval, up to one day; pause and resume has no effect", "Temporarily changed the job interval and redeployed, then restored it"],
    ["182 assets in test and 294 in production had an empty or truncated `path`", "CDF computes `path` when the parent is written, from what exists at that moment; the load writes children and parents in no guaranteed order; re-running the load is a no-op", "A script detaches and re-attaches each affected asset, top-down, after a single-asset trial and a backup"],
    ["A function call shows Completed although it may have failed", "The supplied extractor catches its own errors and reports them to the extraction pipeline", "Outcome read from the extraction pipeline runs and confirmed by counting datapoints"],
    ["OEE history missing for five production sites", "The same site list was submitted in both manual calls", "Detected by the per-site datapoint count; one additional call"],
  ], [0.28, 0.38, 0.34]),
  note("The path issue is the most significant: the downstream functions locate the time series of a site through `path`, so affected assets were skipped without any error. In test, 480 of 2,512 time series would have been left without values; in production, 804."),

  h1("8. Deviations from the official bootcamp path"),
  table(["The course expects", "What was done", "Effect"], [
    ["GitHub repository, Codespaces and GitHub Actions", "Local project folder and the same Toolkit commands run locally", "None on the CDF result; the repository part of the evaluation (20% of the grade) is not covered yet, see section 9"],
    ["Poetry and Python 3.11", "pip in a virtual environment, Python 3.13", "None"],
    ["Creating the extractor and the transformation in the user interface first", "Created directly with the Toolkit, then opened and run in the interface", "Avoids duplicate resources"],
    ["Single deployment to production", "Two-pass deployment", "First extractor run succeeded"],
    ["No step for asset paths", "Path control and repair added after the hierarchy load", "All time series processed"],
    ["Optional local test of the functions", "Skipped; the course flags it as faulty", "None"],
  ], [0.34, 0.36, 0.3]),

  h1("9. Path to the GitHub repository"),
  p("The official path keeps the project in a GitHub repository and lets GitHub Actions run the Toolkit. The grading rubric of the course gives this part 20% of the grade: it passes when production deploys from the `main` branch with a required review and `main` is protected by a mandatory pull request, and it fails when the test and production environments are not configured or when no GitHub Action has run successfully."),
  p("**This part has been documented, not executed.** The step-by-step procedure is phase 13 of the HTML write-up. The local commands were rehearsed in a throwaway folder with dummy files; the two workflows have not yet run on GitHub. They are derived from the starter files shipped with Toolkit 0.6.53 and from the public Cognite documentation; the course page on deploying with GitHub Actions prevails if it differs.", { keepNext: true }),
  table(["Step", "What it does", "Where"], [
    ["1. Repository and working copy", "Empty repository; copy of the modules and configuration files in a short folder outside the synchronised one; Git initialised with the Toolkit ignore list, completed for the production files", "GitHub, local"],
    ["2. Environments `test` and `prod`", "Each holds the 14 values of the matching secrets file under the same names: 3 secrets and 11 variables. Production is restricted to deployments from `main`", "GitHub"],
    ["3. Protection of `main`", "A pull request and one approval are required; nobody pushes to `main` directly", "GitHub"],
    ["4. Two workflows", "On every pull request, build and dry-run against test. On every merge into `main`, build and deploy to test, then to production if test succeeded", "Repository"],
    ["5. First pull request and merge", "Brings the workflows in through the protected path. Both projects being already deployed, the run is expected to create and delete nothing", "GitHub"],
  ], [0.25, 0.59, 0.16]),
  gap(80),
  bullet("**The Toolkit ignore list does not cover production.** It excludes `.env` and `build/`, but neither `.env.prod` nor `build_prod/`; three lines are added before the first commit."),
  bullet("**The starter workflows need adapting.** They target a single environment named `dev` and pass 5 of the 14 values the configuration needs."),
  bullet("**GitHub plan and reviewer.** On a free account, environments and branch protection exist only on a public repository, and the author of a pull request cannot approve it. Where the repository must live and who reviews are to be agreed with the instructor first."),
  bullet("**A merge is a real deployment.** Merging into `main` runs the Toolkit against both projects, production included; the dry-run of the pull request is read before merging."),

  h1("10. Lessons learned and recommendations"),
  bullet("**Verify with counts, not statuses.** Deployed does not mean populated, and Completed does not mean correct. Every incident in this exercise was found by comparing a count with an expected value."),
  bullet("**Control effective access.** When access fails, check the rights an account actually obtains rather than the ones it was meant to have. The Entra to CDF chain can break in three places."),
  bullet("**Know which values the platform computes.** Derived properties such as `path` are not written by our code; they need their own control after each load."),
  bullet("**Read supplied code before running it.** Reading the functions is what revealed their dependency on `path` and their handling of errors."),
  bullet("**Deploy in dependency order.** Access first, then whatever starts running by itself."),
  bullet("**Explain an indicator from its raw signals,** and know its exact definition: here OEE drops because the machine stops, and half of those stops were planned."),
  bullet("**Pin tool versions** and keep the build and secrets of each environment separate and explicit."),
  bullet("**For real projects,** keep secrets outside synchronised folders or in a secrets vault, and run deployments from a pipeline with a review step for production, as the course recommends."),

  h1("11. Status and next steps"),
  p("The course grades four components, each passed at 70%:", { keepNext: true }),
  table(["Component", "Weight", "Expected", "Position"], [
    ["CDF projects", "40%", "All data present in test and production", "Done"],
    ["Canvas", "20%", "A complete canvas. Built, but it shows \"Private charts\": its visibility for the instructor is to be checked", "To confirm"],
    ["GitHub repository", "20%", "Production deployed from `main` with a required review, `main` protected, GitHub Actions succeeded. Not done; the procedure is ready (section 9)", "To do"],
    ["Post-bootcamp quiz", "20%", "70% correct answers", "To do"],
  ], [0.2, 0.1, 0.54, 0.16], [null, "r"]),
  note("Rubric shown at the start of the training deck. The same deck holds another version with other weights (50, 10, 20, 20) and one more condition, the Cognite Academy \"CDF Fundamentals\" path completed; both points are to be confirmed with the instructor."),
  table(["Item", "Status", "Comment"], [
    ["Days 1 to 3 in test and production", "Done", "Verified by the health check on 6 October"],
    ["Charts: OEE chart, calculation and alert", "Done", "In the production project; calculation and alert read back in Charts"],
    ["Canvas: P&ID upload and root cause analysis", "Done", "Drawing, asset, six series, chart, one rectangle and one note; read back through the API"],
    ["Post-bootcamp quiz", "To do", "Pass mark 70%"],
    ["Canvas and chart visible to the instructor", "To confirm", "The canvas shows \"Private charts\"; the chart `test_gd` is private"],
    ["GitHub repository and GitHub Actions", "To do", "Procedure documented (section 9), not executed; repository location and reviewer to be agreed with the instructor"],
  ], [0.42, 0.16, 0.42]),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Appendix A. Deliverables in the project folder")] }),
  table(["File or folder", "Content"], [
    ["`modules/bootcamp/`", "All resource definitions, in three modules: `data_foundation`, `ice_cream_api`, `use_cases/oee`"],
    ["`config.test.yaml`, `config.prod.yaml`", "Target project, selected modules and variables for each environment"],
    ["`cdf.toml`", "Toolkit settings and pinned version"],
    ["`scripts/check_project.py`", "Read-only health check of a project (21 controls)"],
    ["`scripts/repair_asset_paths.py`", "Control and repair of the asset `path` property; read-only unless `--apply`"],
    ["`scripts/upload_pid.py`", "Control, and optional upload, of the P&ID file and its asset links; read-only unless `--apply`"],
    ["`report/CDF-Bootcamp-Report.html`", "Day-by-day write-up in French and English, including a step-by-step procedure (phase 13 covers GitHub)"],
    ["`report/img/`", "Screenshots of Fusion used in the write-up and in Appendix C"],
    ["`JOURNAL.md`, `AGENTS.md`", "Progress log and working rules for the project"],
  ], [0.4, 0.6]),

  h1("Appendix B. Commands"),
  table(["Purpose", "Command"], [
    ["Build, simulate, deploy (test)", "`cdf build --env=test`, then `cdf deploy --dry-run`, then `cdf deploy`"],
    ["Build for production", "`cdf --env-path .env.prod build --env=prod --build-dir build_prod`"],
    ["Deploy to production", "`cdf --env-path .env.prod deploy build_prod --env=prod`"],
    ["Health check, test then production", "`python scripts/check_project.py` then the same with `--env-file .env.prod`"],
  ], [0.34, 0.66]),

  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun("Appendix C. Screens from Fusion")] }),
  p("Screenshots taken on 6 October 2026 in the production project."),
  h2("C.1 Access (day 1)"),
  ...figure("day1-access.jpg", "**Figure 1.** The CDF groups in Access management. Each group is \"Externally managed\": its members are those of the Entra group linked by the Source ID. The two application groups hold rights restricted to a data set. The list of rights is truncated on the screenshot; the last two groups come with the project."),
  h2("C.2 Ingestion and modeling (day 2)"),
  ...figure("day2-hosted-extractors.jpg", "**Figure 2.** The hosted extractor: connected, scheduled continuously, 100% uptime; its two jobs, `/site/all/csv` and `/timeseries/oee`, are running.", 440),
  ...figure("day2-transformations.jpg", "**Figure 3.** The two transformations. The hierarchy is scheduled at 00:33; both are also replayed by the workflow, hence a successful last run a few minutes earlier."),
  ...figure("day2-search.jpg", "**Figure 4.** The data in Search: 1,021 assets, 5,652 time series and one file, the end-of-bootcamp totals.", 360),
  h2("C.3 Functions and workflow (day 3)"),
  ...figure("day3-workflow-2rows.jpg", "**Figure 5.** The workflow `wf_icapi_data_pipeline`, shown on two rows: a trigger every 15 minutes, then four chained tasks, two transformations and two functions. \"Abort on fail\": if a task fails, the workflow stops."),
  ...figure("day3-functions.jpg", "**Figure 6.** The two functions, both ready; their last call is a few minutes old, made by the workflow."),
  ...figure("day3-extraction-pipeline.jpg", "**Figure 7.** The extraction pipeline `ep_icapi_datapoints`, named \"Ice Cream API Data Points\": last report received just now, a success.", 380),
  h2("C.4 Charts (day 4)"),
  p("Unit OSPRPATA241, the Oslo Balance Tank.", { run: { size: 18, color: MUTED }, keepNext: true }),
  ...figure("day4-chart.jpg", "**Figure 8.** The chart `test_gd`. Eight days of the Balance Tank's OEE, 22 to 30 September. The falls to 0 are the machine stops; the dips to about 0.7 are the quality drops. The Oee series and the `charts_oee` calculation overlay each other, with the same mean (0.828); the three other series are in the chart but hidden."),
  ...figure("day4-calculation.jpg", "**Figure 9.** The `charts_oee` calculation. Three source nodes, two multiplications and one output: Performance x Quality, then x Availability."),
  ...figure("day4-monitoring.jpg", "**Figure 10.** The monitoring job. `oee_monitoring_gd` on the Oee series: below 0.7, evaluated every 5 minutes, for more than 5 minutes. The other jobs in the folder come from earlier bootcamp sessions."),
  h2("C.5 Canvas (day 4)"),
  ...figure("day4-canvas-overview.jpg", "**Figure 11.** The canvas `OEE RCA GD`, overview. Top: the P&ID drawing, the asset card and the Charts chart with its rectangle. Middle: the six time series. Bottom left: the sticky note."),
  ...figure("day4-canvas-pid.jpg", "**Figure 12.** The drawing and the asset. The file \"PID Exercise File\" and the `CogniteAsset` card of the Balance Tank, reached through \"Find related data\". On the drawing, the tank carries its tag OSPRPATA241."),
  ...figure("day4-canvas-chart.jpg", "**Figure 13.** The rectangle. It marks a group of OEE drops on the chart placed in the canvas.", 500),
  ...figure("day4-canvas-note.jpg", "**Figure 14.** The sticky note. The conclusion of the analysis, written on the canvas: planned stops, unplanned stops and quality dips.", 360),

  h1("Appendix D. Cognite resources"),
  table(["Address", "What it offers"], [
    ["docs.cognite.com", "Product documentation, developer guides, API reference and SDKs"],
    ["learn.cognite.com", "Cognite Academy: courses, learning paths, instructor-led sessions"],
    ["hub.cognite.com", "The community: user discussions, product ideas, what's new, use cases"],
    ["support.cognite.com", "Support tickets and the knowledge base"],
    ["status.cognite.com", "Service and cluster status, incidents and maintenance"],
  ], [0.3, 0.7]),
];

const doc = new Document({
  creator: "Gaetan Desbrueres",
  title: "Memo - Cognite Data Fusion Bootcamp",
  description: "End-to-end OEE pipeline built as code and running in test and production",
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: TEXT } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 140 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 23, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 400, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Cognite Data Fusion Bootcamp · Memo · 6 October 2026", size: 16, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
      children: [
        new TextRun({ text: "Gaetan DESBRUERES - EOS Engineer - OT/TL/EOS", size: 16, color: MUTED }),
        new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: MUTED }),
      ],
    })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(outPath, buf); console.log(`written ${outPath} (${Math.round(buf.length / 1024)} KB)`); });
