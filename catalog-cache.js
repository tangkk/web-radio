(() => {
  const CACHE_KEY = 'web-radio:stations-cache:v1';
  const META_KEY = 'web-radio:stations-cache-meta:v1';
  const TARGET_URL = new URL('./stations.json', location.href).href;
  const nativeFetch = window.fetch.bind(window);

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
      if (!Array.isArray(parsed)) return;
      localStorage.setItem(CACHE_KEY, text);
      localStorage.setItem(META_KEY, JSON.stringify({ updatedAt: Date.now(), count: parsed.length }));
    } catch {
      // Storage can be unavailable or full; network loading should still work normally.
    }
  }

  function refreshInBackground(input, init) {
    nativeFetch(input, { ...init, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        saveCache(await response.clone().text());
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
      refreshInBackground(input, init);
      return new Response(cached, {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Web-Radio-Cache': 'hit' }
      });
    }

    const response = await nativeFetch(input, init);
    if (response.ok) {
      try { saveCache(await response.clone().text()); } catch {}
    }
    return response;
  };
})();
