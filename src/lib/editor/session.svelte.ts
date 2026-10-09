import type { BackupData } from '../formats/backup/schema';
import { clearDraft, idbDraftStore, loadDraft, saveDraft, type DraftStore, type LoadedDraft } from './draft';

/**
 * The backup being edited. Every change replaces `data` with a new object
 * (see records.ts) and is written to IndexedDB straight away: changes are
 * whole-record saves, not keystrokes, and a delayed write could be lost when
 * the page closes right after an edit.
 */
export class EditorSession {
  data = $state.raw<BackupData | null>(null);
  fileName = $state('');
  /** Edited since the file was opened or last downloaded. */
  dirty = $state(false);
  /** The last write to IndexedDB failed (storage full or blocked), so a reload would lose work. */
  storageFailed = $state(false);

  #store: DraftStore;
  /** Writes run one after another so an older snapshot never lands last. */
  #writing: Promise<void> = Promise.resolve();

  constructor(store: DraftStore = idbDraftStore()) {
    this.#store = store;
  }

  /**
   * Brings back the draft from the last visit, if any. Storage that can't be read (blocked, private mode) is
   * reported through `storageFailed` and counts as no draft, so the rest of start-up carries on.
   */
  async restore(): Promise<LoadedDraft> {
    let loaded: LoadedDraft;
    try {
      loaded = await loadDraft(this.#store);
    } catch (error) {
      this.storageFailed = true;
      console.error('Could not read the stored draft', error);
      return { status: 'none' };
    }
    if (loaded.status === 'ok') {
      this.data = loaded.draft.data;
      this.fileName = loaded.draft.fileName;
      this.dirty = loaded.draft.dirty;
    }
    return loaded;
  }

  open(fileName: string, data: BackupData) {
    this.data = data;
    this.fileName = fileName;
    this.dirty = false;
    void this.flush();
  }

  update(change: (data: BackupData) => BackupData) {
    if (!this.data) return;
    this.data = change(this.data);
    this.dirty = true;
    void this.flush();
  }

  /** Call after the backup was downloaded. */
  markSaved() {
    this.dirty = false;
    void this.flush();
  }

  async close() {
    this.data = null;
    this.fileName = '';
    this.dirty = false;
    await this.#queue(() => clearDraft(this.#store));
  }

  /** Writes the current state to IndexedDB, after any write already running. */
  flush(): Promise<void> {
    const data = this.data;
    if (!data) return this.#writing;
    const draft = { fileName: this.fileName, savedAt: Date.now(), dirty: this.dirty, data };
    return this.#queue(() => saveDraft(this.#store, draft));
  }

  #queue(write: () => Promise<void>): Promise<void> {
    const run = async () => {
      try {
        await write();
        this.storageFailed = false;
      } catch (error) {
        this.storageFailed = true;
        console.error('Could not store the draft', error);
      }
    };
    this.#writing = this.#writing.then(run);
    return this.#writing;
  }
}
