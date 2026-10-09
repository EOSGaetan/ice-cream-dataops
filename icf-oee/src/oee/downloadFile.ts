/** How long the browser keeps the file in memory after the download has started. */
const RELEASE_DELAY_MS = 10000;

/** Hands a CSV text to the browser as a file download. */
export function downloadCsvFile(fileName: string, content: string): void {
  // The byte order mark makes Excel read the file as UTF-8.
  const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), RELEASE_DELAY_MS);
}
