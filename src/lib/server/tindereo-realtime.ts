import { EventEmitter } from "node:events";
import type { PlatformDataEnvelope } from "../tindereo-types";

const PLATFORM_UPDATE_EVENT = "platform-update";

declare global {
  // eslint-disable-next-line no-var
  var __tindereoRealtimeBus__: EventEmitter | undefined;
}

function getRealtimeBus() {
  if (!globalThis.__tindereoRealtimeBus__) {
    globalThis.__tindereoRealtimeBus__ = new EventEmitter();
    globalThis.__tindereoRealtimeBus__.setMaxListeners(0);
  }

  return globalThis.__tindereoRealtimeBus__;
}

export function publishPlatformUpdate(payload: PlatformDataEnvelope) {
  getRealtimeBus().emit(PLATFORM_UPDATE_EVENT, payload);
}

export function subscribeToPlatformUpdates(
  listener: (payload: PlatformDataEnvelope) => void
) {
  const bus = getRealtimeBus();
  bus.on(PLATFORM_UPDATE_EVENT, listener);

  return () => {
    bus.off(PLATFORM_UPDATE_EVENT, listener);
  };
}
