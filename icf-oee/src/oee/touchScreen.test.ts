import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectTouchScreen } from './touchScreen';

describe(detectTouchScreen.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is true when the main pointer is a finger', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(makeMediaQueryList(true));

    expect(detectTouchScreen()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
  });

  it('is false with a mouse', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue(makeMediaQueryList(false));

    expect(detectTouchScreen()).toBe(false);
  });
});

function makeMediaQueryList(matches: boolean): MediaQueryList {
  return { matches } as Partial<MediaQueryList> as MediaQueryList;
}
