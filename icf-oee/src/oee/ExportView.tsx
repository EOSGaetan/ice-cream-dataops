import { Alert, AlertDescription } from '@cognite/aura/components/alert';
import { Button } from '@cognite/aura/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cognite/aura/components/card';
import {
  CheckboxGroup,
  CheckboxItem,
  CheckboxItemControl,
  CheckboxItemLabel,
} from '@cognite/aura/components/checkbox';
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
import type { ExportRun } from './exportForm';
import { CSV_FORMATS, EXPORT_METRICS, EXPORT_STEPS, isCsvFormatId, isExportStepId } from './oeeExport';
import type { ExportPlan } from './oeeExport';
import { ErrorMessage, Loading } from './OeeStates';
import { TOUCH_FIELD_CLASS, TOUCH_LINE_CLASS } from './touchScreen';
import { useExportViewModel } from './useExportViewModel';

/** The select value that stands for "no filter". */
const ALL = '__all__';

/** The export tab: choose the data, the period and the step, and download a CSV file for Excel. */
export function ExportView() {
  const viewModel = useExportViewModel();
  const { sites, unitTypes, siteId, unitType, metrics, from, to, stepId, formatId, run, problem, plan } = viewModel;
  const isRunning = run.status === 'running';

  return (
    <Card>
      <CardHeader className={STACKED_CARD_HEADER}>
        <CardTitle as="h2">Export to CSV</CardTitle>
        <CardDescription className={FULL_CARD_DESCRIPTION}>
          Averages of the computed OEE time series, one row per unit and per step, to analyse in Excel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {viewModel.loadError !== null ? (
          <ErrorMessage message={viewModel.loadError} />
        ) : (
          <div className="flex w-full min-w-0 flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="export-site" label="Site">
                <Select
                  items={[{ value: ALL, label: 'All sites' }, ...sites.map((site) => ({ value: site.externalId, label: site.name }))]}
                  value={siteId ?? ALL}
                  onValueChange={(value) => viewModel.setSite(value === ALL || value === '' ? null : value)}
                >
                  <SelectTrigger id="export-site" className={TOUCH_FIELD_CLASS}>
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

              <Field id="export-unit-type" label="Unit type">
                <Select
                  items={[{ value: ALL, label: 'All unit types' }, ...unitTypes.map((name) => ({ value: name, label: name }))]}
                  value={unitType ?? ALL}
                  onValueChange={(value) => viewModel.setUnitType(value === ALL || value === '' ? null : value)}
                >
                  <SelectTrigger id="export-unit-type" className={TOUCH_FIELD_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All unit types</SelectItem>
                    {unitTypes.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="export-from" label="First day (UTC)">
                <Input
                  className={TOUCH_FIELD_CLASS}
                  id="export-from"
                  type="date"
                  value={from ?? ''}
                  max={to ?? undefined}
                  onChange={(event) => viewModel.setFrom(event.target.value === '' ? null : event.target.value)}
                />
              </Field>

              <Field id="export-to" label="Last day (UTC), included">
                <Input
                  className={TOUCH_FIELD_CLASS}
                  id="export-to"
                  type="date"
                  value={to ?? ''}
                  min={from ?? undefined}
                  onChange={(event) => viewModel.setTo(event.target.value === '' ? null : event.target.value)}
                />
              </Field>

              <Field id="export-step" label="Step">
                <Select
                  items={EXPORT_STEPS.map((step) => ({ value: step.id, label: step.label }))}
                  value={stepId}
                  onValueChange={(value) => {
                    if (isExportStepId(value)) viewModel.setStep(value);
                  }}
                >
                  <SelectTrigger id="export-step" className={TOUCH_FIELD_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_STEPS.map((step) => (
                      <SelectItem key={step.id} value={step.id}>
                        {step.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="export-format" label="File format">
                <Select
                  items={CSV_FORMATS.map((format) => ({ value: format.id, label: format.label }))}
                  value={formatId}
                  onValueChange={(value) => {
                    if (isCsvFormatId(value)) viewModel.setFormat(value);
                  }}
                >
                  <SelectTrigger id="export-format" className={TOUCH_FIELD_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CSV_FORMATS.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Data (average per step)</span>
              <CheckboxGroup orientation="horizontal" aria-label="Data to export" className="flex-wrap gap-x-4">
                {EXPORT_METRICS.map((metric) => (
                  <CheckboxItem key={metric.id} className={TOUCH_LINE_CLASS}>
                    <CheckboxItemControl
                      checked={metrics.includes(metric.id)}
                      onCheckedChange={(isChecked) => viewModel.toggleMetric(metric.id, isChecked)}
                    />
                    <CheckboxItemLabel>{metric.label}</CheckboxItemLabel>
                  </CheckboxItem>
                ))}
              </CheckboxGroup>
            </div>

            <div className="flex flex-col gap-3">
              {viewModel.isLoading ? (
                <Loading label="Loading the units of every site…" />
              ) : (
                <p className="text-sm text-muted-foreground">{describePlan(viewModel.unitCount, plan)}</p>
              )}
              {!viewModel.isLoading && problem !== null && (
                <Alert variant="warning">
                  <AlertDescription>{problem}</AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  className={TOUCH_FIELD_CLASS}
                  onClick={viewModel.exportCsv}
                  disabled={problem !== null || isRunning}
                >
                  {isRunning ? 'Exporting…' : 'Export CSV'}
                </Button>
                {isRunning && (
                  <Button variant="outline" className={TOUCH_FIELD_CLASS} onClick={viewModel.cancelExport}>
                    Cancel
                  </Button>
                )}
                <RunStatus run={run} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
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

function RunStatus({ run }: { run: ExportRun }) {
  if (run.status === 'running') {
    return (
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {`Reading the data: ${run.done} of ${run.total} requests.`}
      </span>
    );
  }
  if (run.status === 'done') {
    return (
      <span className="text-sm text-muted-foreground" aria-live="polite">
        {`${run.rowCount.toLocaleString('en-US')} rows exported to ${run.fileName}.`}
      </span>
    );
  }
  if (run.status === 'cancelled') {
    return (
      <span className="text-sm text-muted-foreground" aria-live="polite">
        Export cancelled. No file was downloaded.
      </span>
    );
  }
  if (run.status === 'failed') {
    return (
      <span className="text-sm text-muted-foreground" role="alert">
        {run.message}
      </span>
    );
  }
  return null;
}

function describePlan(unitCount: number, plan: ExportPlan | null): string {
  const units = `${unitCount} ${unitCount === 1 ? 'unit' : 'units'}`;
  if (plan === null || plan.requests === 0) return `${units} selected.`;
  return (
    `${units}, ${plan.points.toLocaleString('en-US')} steps each: up to ${plan.rows.toLocaleString('en-US')} rows, ` +
    `read in ${plan.requests} ${plan.requests === 1 ? 'request' : 'requests'}.`
  );
}
