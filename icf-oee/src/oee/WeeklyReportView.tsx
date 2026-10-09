import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Button } from '@cognite/aura/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';
import { Input } from '@cognite/aura/components/input';
import { Label } from '@cognite/aura/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cognite/aura/components/select';
import type { ReactNode } from 'react';

import { FULL_CARD_DESCRIPTION, STACKED_CARD_HEADER } from './cardLayout';
import { formatPercent } from './oeeFormat';
import { Empty, ErrorMessage, Loading } from './OeeStates';
import { OeeValue } from './OeeValue';
import { ReportSitesTable, ReportTypesTable, ReportUnitsTable } from './ReportTables';
import { TOUCH_FIELD_CLASS } from './touchScreen';
import { useWeeklyReportViewModel } from './useWeeklyReportViewModel';
import { formatChange } from './weeklyReport';
import type { WeeklyReport } from './weeklyReport';

/** The select value that stands for "no filter". */
const ALL = '__all__';

/** The weekly report tab: choose the week and the site, read the report, download it as a file. */
export function WeeklyReportView() {
  const viewModel = useWeeklyReportViewModel();
  const { sites, siteId, lastDay, period, comparedWith, report } = viewModel;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <Card>
        <CardHeader className={STACKED_CARD_HEADER}>
          <CardTitle as="h2">Weekly report</CardTitle>
          <CardDescription className={FULL_CARD_DESCRIPTION}>
            The OEE of 7 days, compared with the 7 days before, as a file to print or to send.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="report-site" label="Site">
                <Select
                  items={[{ value: ALL, label: 'All sites' }, ...sites.map((site) => ({ value: site.externalId, label: site.name }))]}
                  value={siteId ?? ALL}
                  onValueChange={(value) => viewModel.setSite(value === ALL || value === '' ? null : value)}
                >
                  <SelectTrigger id="report-site" className={TOUCH_FIELD_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.externalId} value={site.externalId}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="report-last-day" label="Last day of the week (UTC)">
                <Input
                  className={TOUCH_FIELD_CLASS}
                  id="report-last-day"
                  type="date"
                  value={lastDay ?? ''}
                  onChange={(event) => viewModel.setLastDay(event.target.value === '' ? null : event.target.value)}
                />
              </Field>
            </div>
            {period !== null && comparedWith !== null && (
              <p className="text-sm text-muted-foreground">
                {`Week from ${period.from} to ${period.to}, compared with ${comparedWith.from} to ${comparedWith.to}.`}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Button className={TOUCH_FIELD_CLASS} onClick={viewModel.download} disabled={!viewModel.canDownload}>
                Download report
              </Button>
              {viewModel.downloadedFile !== null && (
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {`Report downloaded as ${viewModel.downloadedFile}. Open it in a browser to print it or save it as PDF.`}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewModel.error !== null && <ErrorMessage message={viewModel.error} />}
      {viewModel.isLoading && <Loading label="Loading the two weeks of every unit…" />}
      {viewModel.error === null && !viewModel.isLoading && period === null && (
        <Alert variant="warning">
          <AlertDescription>Choose the last day of the week.</AlertDescription>
        </Alert>
      )}
      {report !== null && viewModel.error === null && <ReportPreview report={report} />}
    </div>
  );
}

function ReportPreview({ report }: { report: WeeklyReport }) {
  if (report.unitsWithData === 0) {
    return (
      <Empty
        title="No OEE values in this week"
        description="No unit of this selection has an OEE value in these 7 days. Choose another last day or another site."
      />
    );
  }
  const { overall } = report;

  return (
    <>
      <section aria-label="Week summary" className="grid grid-cols-12 gap-4">
        <Tile
          label="Mean OEE"
          hint={`${report.unitsWithData} of ${report.unitCount} units, ${formatPercent(report.coverage)} of the hours have values`}
        >
          <OeeValue ratio={overall.meanOee} />
        </Tile>
        <Tile label="Change" hint={`Week before: ${formatPercent(overall.previousMeanOee)}`}>
          {formatChange(overall.change)}
        </Tile>
        <Tile label="Time below 70%" hint="Share of the hourly averages">
          {formatPercent(overall.belowAlertShare)}
        </Tile>
        <Tile label="Units below 70%" hint="Weekly mean under the alert threshold">
          {report.unitsBelowAlert}
        </Tile>
      </section>
      <ReportCard title="Sites" description="Mean OEE of the week by site, lowest first.">
        <ReportSitesTable rows={report.sites} />
      </ReportCard>
      <ReportCard
        title="Unit types with the most time below 70%"
        description={`The ${report.unitTypes.length} unit types that spent the largest share of the week below 70% OEE.`}
      >
        <ReportTypesTable rows={report.unitTypes} />
      </ReportCard>
      <ReportCard
        title="Units with the lowest mean OEE"
        description={`The ${report.units.length} units with the lowest mean OEE over the week.`}
      >
        <ReportUnitsTable rows={report.units} />
      </ReportCard>
    </>
  );
}

function ReportCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className={STACKED_CARD_HEADER}>
        <CardTitle as="h2">{title}</CardTitle>
        <CardDescription className={FULL_CARD_DESCRIPTION}>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Tile({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-3">
      <Card>
        <CardContent>
          <div className="flex w-full min-w-0 flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="flex h-9 items-center text-3xl font-medium text-foreground">{children}</span>
            <span className="text-sm text-muted-foreground">{hint}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
