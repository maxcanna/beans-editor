/**
 * Getting an edited file out of the browser. Download only: Chromium's Web Share refuses
 * zip files (share_service_impl.cc allows images, media, PDF and text), so Share can't work.
 */

const ZIP_TYPE = 'application/zip';

/** Keeps the name the backup came with, so it replaces the original in Downloads. */
export function outputName(fileName: string): string {
  return /\.zip$/i.test(fileName) ? fileName : 'Beanconqueror.zip';
}

type SaveFilePicker = (options: {
  suggestedName: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}>;

/**
 * Hands the bytes to the user. Resolves false only when the user dismissed the File System
 * Access save picker, the one case the page can hear about. Browsers without the picker get a
 * plain anchor download, which gives no signal either way, so it counts as saved.
 */
export async function download(bytes: Uint8Array, fileName: string, type = ZIP_TYPE): Promise<boolean> {
  const blob = new Blob([bytes as BlobPart], { type });
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const ext = /\.[^.]+$/.exec(fileName)?.[0] ?? '.zip';
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: fileName, accept: { [type]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      // Dismissing the picker is the user saying no; any other failure falls back to a plain download.
      if (error instanceof DOMException && error.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
