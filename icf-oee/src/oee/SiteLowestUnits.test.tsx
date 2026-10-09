import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SITES, UNITS } from '../__mocks__/oee';

import { summarizeSite } from './oeeKpi';
import { SiteLowestUnits } from './SiteLowestUnits';
import type { SiteOverview } from './useOeeViewModel';

const OSLO: SiteOverview = {
  site: SITES[1],
  summary: summarizeSite(UNITS),
  lowestUnits: [UNITS[1], UNITS[0]],
  isLoading: false,
  error: null,
};

describe(SiteLowestUnits.name, () => {
  it('shows the site OEE and its lowest units, lowest first', () => {
    render(<SiteLowestUnits overview={OSLO} />);

    expect(screen.getByText('Oslo')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Chocolate Spray'),
      expect.stringContaining('Balance Tank'),
    ]);
  });

  it('says when the units are loading', () => {
    render(<SiteLowestUnits overview={{ ...OSLO, summary: null, lowestUnits: [], isLoading: true }} />);

    expect(screen.getByText('Loading units…')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the error of the units', () => {
    render(
      <SiteLowestUnits
        overview={{ ...OSLO, summary: null, lowestUnits: [], error: 'The units could not be loaded. 429' }}
      />
    );

    expect(screen.getByText('The units could not be loaded. 429')).toBeInTheDocument();
  });

  it('says when no unit of the site has an OEE value', () => {
    render(<SiteLowestUnits overview={{ ...OSLO, summary: summarizeSite([]), lowestUnits: [] }} />);

    expect(screen.getByText('No unit with an OEE value.')).toBeInTheDocument();
  });
});
