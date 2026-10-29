"use client";

import { useSyncExternalStore } from "react";

const tanpaLangganan = () => () => {};

/**
 * Read a value that depends on "now".
 *
 * Returns `fallback` during prerender and the real value once hydrated, which
 * is what `cacheComponents` requires: a page cached overnight must not keep
 * insisting the pickup is "besok". `hitung` must return a stable reference
 * across calls — memoize anything that builds an array.
 */
export function useNilaiKlien<T>(hitung: () => T, fallback: T): T {
  return useSyncExternalStore(tanpaLangganan, hitung, () => fallback);
}
