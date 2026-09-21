'use client';

import { useSyncExternalStore } from 'react';

const never = () => () => undefined;

/**
 * A value only the browser knows (the page's origin, whether it has Web NFC), read without
 * mirroring it into state from an effect. The server render and hydration see `serverValue`.
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(never, read, () => serverValue);
}
