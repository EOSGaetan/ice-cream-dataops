import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeOeeService, makeOeeWrapper } from '../__mocks__/oee';
import type { FakeOeeService } from '../__mocks__/oee';

import { OeePage } from './OeePage';

/**
 * Automated accessibility rules (WCAG 2.2 A and AA) on every tab. The test DOM computes no layout
 * and no colour: contrast and target size are checked in a browser, on the development preview.
 */
const AXE_OPTIONS: axe.RunOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
  rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
};

const TABS = [
  { tab: 'overview', state: JSON.stringify({ view: 'overview' }), ready: 'Lowest OEE by site' },
  {
    tab: 'unit types',
    state: JSON.stringify({ view: 'units', unitType: 'Balance Tank' }),
    ready: 'Balance Tank by site',
  },
  {
    tab: 'site',
    state: JSON.stringify({ view: 'site', siteId: 'oslo', unitId: 'OSPRPATA241' }),
    ready: 'OEE trend of Balance Tank',
  },
  { tab: 'export', state: JSON.stringify({ view: 'export' }), ready: 'Export to CSV' },
  { tab: 'weekly report', state: JSON.stringify({ view: 'report' }), ready: 'Units with the lowest mean OEE' },
];

describe('OeePage accessibility', () => {
  let service: FakeOeeService;

  // The charts are loaded on demand. Their first import is slow in the test runner: do it once here.
  beforeAll(async () => {
    await Promise.all([import('./OeeTrendChart'), import('./UnitTypesChart')]);
  }, 120000);

  beforeEach(() => {
    service = makeOeeService();
    // The Aura DataGrid is virtualized: it renders rows only when its scroll container has a size.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(TABS)('has no automated accessibility violation on the $tab tab', async ({ state, ready }) => {
    const { container } = render(<OeePage />, { wrapper: makeOeeWrapper({ service, initialState: state }) });
    await screen.findByRole('heading', { level: 2, name: ready }, { timeout: 10000 });

    // A chart is one named image with a text summary: its inner drawing is skipped (slow in the test DOM).
    const results = await axe.run({ include: [container], exclude: ['svg'] }, AXE_OPTIONS);

    expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
});
