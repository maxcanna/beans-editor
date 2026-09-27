import { createStore, del, get, set } from 'idb-keyval';

/**
 * Hand-off between the service worker (which receives Android share intents)
 * and the page. Shared by both bundles, so it must stay DOM-free.
 */
export interface SharedFile {
  name: string;
  type: string;
  bytes: ArrayBuffer;
  receivedAt: number;
}

const store = () => createStore('bean-editor-share', 'inbox');
const KEY = 'pending-file';

export const SHARE_TARGET_PATH = '/share-target';
export const SHARED_FILE_PARAM = 'shared-file';

export async function putSharedFile(file: SharedFile): Promise<void> {
  await set(KEY, file, store());
}

/** Returns the pending shared file once, then clears it. */
export async function takeSharedFile(): Promise<SharedFile | undefined> {
  const s = store();
  const file = await get<SharedFile>(KEY, s);
  if (file) await del(KEY, s);
  return file;
}
