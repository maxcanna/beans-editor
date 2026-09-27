/** Getting an edited file out of the browser: download, or the system share sheet. */

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

export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function') return false;
  return navigator.canShare({ files: [new File([], 'x.zip', { type: ZIP_TYPE })] });
}

/** Resolves false when the user closes the share sheet without picking a target. */
export async function share(bytes: Uint8Array, fileName: string): Promise<boolean> {
  try {
    await navigator.share({ files: [new File([bytes as BlobPart], fileName, { type: ZIP_TYPE })] });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return false;
    throw error;
  }
}
