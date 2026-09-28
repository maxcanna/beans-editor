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

interface UserAgentData {
  brands?: { brand: string }[];
}

/**
 * Chromium browsers (Chrome, Edge, Samsung Internet…) only share images, audio, video,
 * PDF and text files, and reject a zip in `share()` even though `canShare()` accepts it
 * (IsDangerousFilename in chrome/browser/webshare/share_service_impl.cc).
 */
function isChromium(): boolean {
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  if (data?.brands) return data.brands.some((b) => b.brand === 'Chromium');
  return /\bChrom(e|ium)\//.test(navigator.userAgent);
}

export function canShareFiles(): boolean {
  if (typeof navigator.canShare !== 'function' || isChromium()) return false;
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
