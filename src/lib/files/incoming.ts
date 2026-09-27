import { takeSharedFile, SHARED_FILE_PARAM } from '../share/inbox';

export interface IncomingFile {
  name: string;
  bytes: Uint8Array;
}

export type Incoming = { type: 'file'; file: IncomingFile } | { type: 'none' };

/**
 * Consumes a file shared from Android (stored by the service worker)
 * and strips the share parameters so a reload doesn't re-open it.
 */
export async function consumeShare(location: Location, history: History): Promise<Incoming> {
  const params = new URLSearchParams(location.search);
  const hasFile = params.has(SHARED_FILE_PARAM);
  if (hasFile) {
    params.delete(SHARED_FILE_PARAM);
    const query = params.toString();
    history.replaceState(
      history.state,
      '',
      `${location.pathname}${query ? `?${query}` : ''}${location.hash}`,
    );
  }

  if (hasFile) {
    const shared = await takeSharedFile();
    if (shared) return { type: 'file', file: { name: shared.name, bytes: new Uint8Array(shared.bytes) } };
  }
  return { type: 'none' };
}

export async function readLocalFile(file: File): Promise<IncomingFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}
