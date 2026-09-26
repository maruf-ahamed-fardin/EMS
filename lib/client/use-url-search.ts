'use client';

import { useEffect, useRef, useState } from 'react';

/** Longest search the list APIs accept (`q` is `.max(100)` in the contracts). */
export const SEARCH_MAX_LENGTH = 100;

/**
 * A search box bound to the `q` URL parameter. Typing updates the URL after a pause, through `push`
 * from the latest render, so a filter changed meanwhile isn't lost. When the URL changes some other
 * way (Back, a "Clear filters" link) the box shows what the URL says.
 */
export function useUrlSearch(urlValue: string | undefined, push: (q: string | undefined) => void, delay = 350) {
  const [search, setSearch] = useState(urlValue ?? '');
  // The last value this box put in the URL, or found there
  const synced = useRef(urlValue ?? '');
  const latestPush = useRef(push);
  useEffect(() => {
    latestPush.current = push;
  });

  useEffect(() => {
    const value = urlValue ?? '';
    if (value === synced.current) return;
    synced.current = value;
    setSearch(value);
  }, [urlValue]);

  useEffect(() => {
    const value = search.trim();
    if (value === synced.current) return;
    const timer = setTimeout(() => {
      synced.current = value;
      latestPush.current(value || undefined);
    }, delay);
    return () => clearTimeout(timer);
  }, [search, delay]);

  return [search, setSearch] as const;
}
