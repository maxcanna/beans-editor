/**
 * Getting an edited file out of the browser. Download only: Chromium's Web Share refuses
 * zip files (share_service_impl.cc allows images, media, PDF and text), so Share can't work.
 */

const ZIP_TYPE = 'application/zip';

/** Keeps the name the backup came with, so it replaces the original in Downloads. */
export function outputName(fileName: string): string {
  return /\.zip$/i.test(fileName) ? fileName : 'Beanconqueror.zip';
}

export function download(bytes: Uint8Array, fileName: string, type = ZIP_TYPE) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
