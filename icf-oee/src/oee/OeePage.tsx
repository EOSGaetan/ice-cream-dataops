import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@cognite/aura/components/tabs';

import logoUrl from '../assets/logo.png';

import { ExportStorageProvider } from './ExportStorageProvider';
import { ExportView } from './ExportView';
import { ErrorMessage } from './OeeStates';
import { ReportStorageProvider } from './ReportStorageProvider';
import { SiteDetail } from './SiteDetail';
import { SitesOverview } from './SitesOverview';
import { COMPANY_NAME, isOeeView } from './types';
import { UnitTypesView } from './UnitTypesView';
import { useOeeViewModel } from './useOeeViewModel';
import { WeeklyReportView } from './WeeklyReportView';

/** A finger needs a larger target than a mouse pointer. */
const TOUCH_TAB = 'pointer-coarse:h-11 pointer-coarse:px-3';

export function OeePage() {
  const viewModel = useOeeViewModel();
  const { view, selectView, sites, overview, openSite } = viewModel;

  return (
    <ExportStorageProvider>
    <ReportStorageProvider>
    <main className="min-h-screen bg-muted/50 text-foreground">
      <div className="mx-auto flex w-full max-w-[min(100%,var(--container-8xl))] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex min-w-0 items-center gap-4">
          <img src={logoUrl} alt={`${COMPANY_NAME} logo`} className="h-14 w-auto shrink-0 sm:h-20" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{COMPANY_NAME}</span>
            <h1 className="text-2xl font-medium sm:text-4xl">Ice Cream Factory OEE</h1>
            <p className="max-w-[37.5rem] text-muted-foreground">
              Latest Overall Equipment Effectiveness of each unit, by site. OEE = quality × performance ×
              availability.
            </p>
          </div>
        </header>

        <Tabs
          value={view}
          onValueChange={(value) => {
            if (isOeeView(value)) selectView(value);
          }}
        >
          {/* Five tabs are wider than a phone: the tab bar scrolls inside its own frame, not the page. */}
          <TabsList className="max-w-full overflow-x-auto">
            <TabsTrigger value="overview" className={TOUCH_TAB}>Overview</TabsTrigger>
            <TabsTrigger value="units" className={TOUCH_TAB}>Unit types</TabsTrigger>
            <TabsTrigger value="site" className={TOUCH_TAB}>Site</TabsTrigger>
            <TabsTrigger value="export" className={TOUCH_TAB}>Export</TabsTrigger>
            <TabsTrigger value="report" className={TOUCH_TAB}>Weekly report</TabsTrigger>
          </TabsList>

          <TabsPanel value="overview">
            <div className="pt-6">
              <SitesOverview overview={overview} onOpenSite={openSite} />
            </div>
          </TabsPanel>

          <TabsPanel value="units">
            <div className="pt-6">
              <UnitTypesView {...viewModel} />
            </div>
          </TabsPanel>

          <TabsPanel value="site">
            <div className="flex flex-col gap-6 pt-6">
              {sites.error !== null && <ErrorMessage message={sites.error} />}
              <SiteDetail {...viewModel} />
            </div>
          </TabsPanel>

          <TabsPanel value="export">
            <div className="pt-6">
              <ExportView />
            </div>
          </TabsPanel>

          <TabsPanel value="report">
            <div className="pt-6">
              <WeeklyReportView />
            </div>
          </TabsPanel>
        </Tabs>
      </div>
    </main>
    </ReportStorageProvider>
    </ExportStorageProvider>
  );
}
