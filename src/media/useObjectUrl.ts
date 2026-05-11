import { useEffect, useState } from "react";
import { getMedia } from "../db";
import { objectUrlFromBlob } from "./image";

// Resolves a media hash to a browser-renderable object URL. Returns null until
// the lookup completes (or if the hash is undefined / missing). The URL is
// owned by this hook and revoked when the component unmounts or the hash
// changes, so callers don't have to track lifetimes themselves.
export function useObjectUrl(hash: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setUrl(null);
    if (!hash) return;
    (async () => {
      const m = await getMedia(hash);
      if (!m || cancelled) return;
      created = objectUrlFromBlob(m.blob);
      setUrl(created);
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [hash]);
  return url;
}
