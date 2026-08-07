(() => {
  const CACHE_KEY = 'web-radio:stations-cache:v1';
  const META_KEY = 'web-radio:stations-cache-meta:v1';
  const RELOAD_GUARD_KEY = 'web-radio:catalog-reload-guard:v1';
  const CATALOG_REVISION = 'e0b71b544afb1415944ff041688a52b46fcb8e14';
  const TARGET_URL = new URL('./stations.json', location.href).href;
  const nativeFetch = window.fetch.bind(window);

  function readMeta() {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function readCache() {
    try {
      const value = localStorage.getItem(CACHE_KEY);
      if (!value) return null;
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? value : null;
    } catch {
      return null;
    }
  }

  function saveCache(text) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return false;
      localStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(META_KEY, JSON.stringify({
        updatedAt: Date.now(),
        count: parsed.length,
        revision: CATALOG_REVISION
      }));
      return true;
    } catch {
      // Storage can be unavailable or full; network loading should still work normally.
      return false;
    }
  }

  function cacheIsCurrent() {
    const meta = readMeta();
    return meta?.revision === CATALOG_REVISION;
  }

  function maybeReloadAfterRefresh(changed) {
    if (!changed || document.visibilityState !== 'visible') return;
    try {
      if (sessionStorage.getItem(RELOAD_GUARD_KEY) === CATALOG_REVISION) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, CATALOG_REVISION);
    } catch {}
    // Let the fresh catalog finish writing before reloading. The next load is cache-first.
    window.setTimeout(() => location.reload(), 50);
  }

  function refreshInBackground(input, init, previousText) {
    nativeFetch(input, { ...init, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        const freshText = await response.clone().text();
        let fresh;
        try { fresh = JSON.parse(freshText); } catch { return; }
        if (!Array.isArray(fresh)) return;

        const changed = freshText !== previousText || !cacheIsCurrent();
        if (!saveCache(freshText)) return;
        maybeReloadAfterRefresh(changed);
      })
      .catch(() => {});
  }

  window.fetch = async function cachedCatalogFetch(input, init = {}) {
    const rawUrl = typeof input === 'string' || input instanceof URL ? input : input?.url;
    let url;
    try { url = new URL(rawUrl, location.href).href; } catch { return nativeFetch(input, init); }
    if (url !== TARGET_URL) return nativeFetch(input, init);

    const cached = readCache();
    if (cached) {
      refreshInBackground(input, init, cached);
      return new Response(cached, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Web-Radio-Cache': cacheIsCurrent() ? 'hit-current' : 'hit-stale'
        }
      });
    }

    const response = await nativeFetch(input, { ...init, cache: 'no-store' });
    if (response.ok) {
      try { saveCache(await response.clone().text()); } catch {}
    }
    return response;
  };
})();
