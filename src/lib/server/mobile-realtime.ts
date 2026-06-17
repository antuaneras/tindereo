import { EventEmitter } from "node:events";
import type { MobileStreamEvent } from "@/lib/mobile-types";

const MOBILE_STREAM_EVENT = "mobile-stream";

declare global {
  // eslint-disable-next-line no-var
  var __mobileRealtimeBus__: EventEmitter | undefined;
}

function getMobileRealtimeBus() {
  if (!globalThis.__mobileRealtimeBus__) {
    globalThis.__mobileRealtimeBus__ = new EventEmitter();
    globalThis.__mobileRealtimeBus__.setMaxListeners(0);
  }

  return globalThis.__mobileRealtimeBus__;
}

export function publishMobileRealtimeEvent(event: Omit<MobileStreamEvent, "at">) {
  getMobileRealtimeBus().emit(MOBILE_STREAM_EVENT, {
    ...event,
    at: new Date().toISOString()
  } satisfies MobileStreamEvent);
}

export function subscribeToMobileRealtimeEvents(
  listener: (event: MobileStreamEvent) => void
) {
  const bus = getMobileRealtimeBus();
  bus.on(MOBILE_STREAM_EVENT, listener);

  return () => {
    bus.off(MOBILE_STREAM_EVENT, listener);
  };
}
