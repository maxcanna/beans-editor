import { registerSW } from 'virtual:pwa-register';

/** Service worker lifecycle as reactive state; the banner asks before activating an update. */
class PwaState {
  needRefresh = $state(false);
  offlineReady = $state(false);
  #update: ((reload?: boolean) => Promise<void>) | undefined;

  start() {
    if (!('serviceWorker' in navigator)) return;
    this.#update = registerSW({
      immediate: true,
      onNeedRefresh: () => (this.needRefresh = true),
      onOfflineReady: () => (this.offlineReady = true),
    });
  }

  async applyUpdate() {
    await this.#update?.(true);
  }

  dismiss() {
    this.needRefresh = false;
    this.offlineReady = false;
  }
}

export const pwa = new PwaState();
