import { takeSharedFile, SHARE_EMPTY_PARAM, SHARE_TARGET_PATH, SHARED_FILE_PARAM } from '../share/inbox';

export interface IncomingFile {
  name: string;
  bytes: Uint8Array;
}

/** `empty`: something was shared, but it held no file the app could use. */
export type Incoming = { type: 'file'; file: IncomingFile } | { type: 'empty' } | { type: 'none' };

/**
 * Consumes a file shared from Android (stored by the service worker)
 * and strips the share parameters so a reload doesn't re-open it.
 */
export async function consumeShare(location: Location, history: History): Promise<Incoming> {
  const params = new URLSearchParams(location.search);
  const hasFile = params.has(SHARED_FILE_PARAM);
  const empty = params.has(SHARE_EMPTY_PARAM);
  // The page itself at the share path means the service worker didn't answer the share.
  const unhandled = location.pathname === SHARE_TARGET_PATH;
  if (hasFile || empty || unhandled) {
    params.delete(SHARED_FILE_PARAM);
    params.delete(SHARE_EMPTY_PARAM);
    const query = params.toString();
    const path = unhandled ? '/' : location.pathname;
    history.replaceState(history.state, '', `${path}${query ? `?${query}` : ''}${location.hash}`);
  }

  if (hasFile) {
    const shared = await takeSharedFile();
    if (shared) return { type: 'file', file: { name: shared.name, bytes: new Uint8Array(shared.bytes) } };
  }
  return hasFile || empty || unhandled ? { type: 'empty' } : { type: 'none' };
}

export async function readLocalFile(file: File): Promise<IncomingFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}
