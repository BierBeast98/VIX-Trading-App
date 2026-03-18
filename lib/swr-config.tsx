"use client";

import { SWRConfig } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Fetch error ${res.status}`);
    return res.json();
  });

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,      // kein Refetch beim App-Wechsel (mobil)
        revalidateOnReconnect: false,  // kein Refetch bei Netz-Reconnect
        dedupingInterval: 10_000,      // gleiche URL max 1x pro 10s fetchen
        errorRetryCount: 2,
        keepPreviousData: true,        // alte Daten zeigen während Reload
      }}
    >
      {children}
    </SWRConfig>
  );
}
