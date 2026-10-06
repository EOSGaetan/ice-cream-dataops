import { Label } from '@cognite/aura/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cognite/aura/components/select';

import type { Site } from './types';

const SITE_SELECT_ID = 'oee-site-select';

type SiteSelectProps = {
  sites: Site[];
  selectedSiteId: string | null;
  isLoading: boolean;
  onSelect: (siteId: string) => void;
};

export function SiteSelect({ sites, selectedSiteId, isLoading, onSelect }: SiteSelectProps) {
  // `items` lets the trigger show the site name instead of its external id.
  const items = sites.map((site) => ({ value: site.externalId, label: site.name }));

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={SITE_SELECT_ID}>Site</Label>
      <Select
        items={items}
        value={selectedSiteId ?? ''}
        onValueChange={(siteId) => {
          if (siteId !== '') onSelect(siteId);
        }}
        disabled={isLoading}
      >
        <SelectTrigger id={SITE_SELECT_ID}>
          <SelectValue placeholder={isLoading ? 'Loading sites…' : 'Select a site'} />
        </SelectTrigger>
        <SelectContent>
          {sites.map((site) => (
            <SelectItem key={site.externalId} value={site.externalId}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
