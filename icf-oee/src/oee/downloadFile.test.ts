import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadTextFile } from './downloadFile';

describe(downloadTextFile.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('downloads the text as a UTF-8 CSV file with the given name', async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) blobs.push(blob);
      return 'blob:test';
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clicked: { download: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });

    downloadTextFile('export.csv', 'a;b\r\n1;2\r\n');

    expect(clicked).toEqual([{ download: 'export.csv', href: 'blob:test' }]);
    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toBe('text/csv;charset=utf-8');
    // The byte order mark (3 bytes in UTF-8) comes before the text.
    expect(blobs[0].size).toBe(3 + 'a;b\r\n1;2\r\n'.length);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(revoke).toHaveBeenCalledWith('blob:test');
  });

  it('downloads a file whose name ends in .html as an HTML document, without byte order mark', () => {
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (blob instanceof Blob) blobs.push(blob);
      return 'blob:test';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadTextFile('report.HTML', '<!doctype html>');

    expect(blobs[0].type).toBe('text/html;charset=utf-8');
    expect(blobs[0].size).toBe('<!doctype html>'.length);
  });
});
