import { describe, expect, it } from 'vitest';

import { shortenName } from './oeeFormat';

describe(shortenName.name, () => {
  it('keeps a name that fits', () => {
    expect(shortenName('Aging Tank', 16)).toBe('Aging Tank');
    expect(shortenName('Hardening Tunnel', 16)).toBe('Hardening Tunnel');
  });

  it('cuts a long name and marks the cut', () => {
    expect(shortenName('Main Drive, Indexing Chain Conveyor', 16)).toBe('Main Drive, Ind…');
  });

  it('leaves no space before the mark', () => {
    expect(shortenName('Brine Flow Sys Circuit', 16)).toBe('Brine Flow Sys…');
  });
});
