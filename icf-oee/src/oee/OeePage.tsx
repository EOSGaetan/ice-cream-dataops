import { Tabs, TabsList, TabsPanel, TabsTrigger } from '@cognite/aura/components/tabs';

import logoUrl from '../assets/logo.png';

import { ErrorMessage } from './OeeStates';
import { SiteDetail } from './SiteDetail';
import { SitesOverview } from './SitesOverview';
import { COMPANY_NAME, isOeeView } from './types';
import { UnitTypesView } from './UnitTypesView';
import { useOeeViewModel } from './useOeeViewModel';

export function OeePage() {
  const viewModel = useOeeViewModel();
  const { view, selectView, sites, overview, openSite } = viewModel;

  return (
    <main className="min-h-screen bg-muted/50 text-foreground">
      <div className="mx-auto flex w-full max-w-[min(100%,var(--container-8xl))] flex-col gap-6 px-6 py-8">
        <header className="flex min-w-0 items-center gap-4">
          <img src={logoUrl} alt={`${COMPANY_NAME} logo`} className="h-20 w-auto shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-sm font-medium text-muted-foreground">{COMPANY_NAME}</span>
            <h1 className="text-4xl font-medium">Ice Cream Factory OEE</h1>
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
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="units">Unit types</TabsTrigger>
            <TabsTrigger value="site">Site</TabsTrigger>
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
        </Tabs>
      </div>
    </main>
  );
}
