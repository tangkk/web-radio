(() => {
  const originalFetch = window.fetch.bind(window);
  let hiddenIds = new Set(['tw-rti']);

  function addHeaderDisclaimer() {
    const intro = document.querySelector('.intro');
    if (!intro || intro.querySelector('.content-disclaimer')) return;
    const note = document.createElement('p');
    note.className = 'content-disclaimer';
    note.textContent = '本站僅聚合公開來源；所收錄頻道／節目及其內容不代表本站立場或背書。';
    note.style.marginTop = '6px';
    note.style.color = '#888';
    note.style.fontSize = '11px';
    note.style.lineHeight = '1.5';
    intro.appendChild(note);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHeaderDisclaimer, { once: true });
  else addHeaderDisclaimer();

  function cleanStoredIds() {
    try {
      const recents = JSON.parse(localStorage.getItem('web-radio-recents') || '[]');
      if (Array.isArray(recents)) {
        localStorage.setItem('web-radio-recents', JSON.stringify(recents.filter(item => !hiddenIds.has(item?.id))));
      }
    } catch {}
    try {
      const favorites = JSON.parse(localStorage.getItem('hk-radio-favorites') || '[]');
      if (Array.isArray(favorites)) {
        localStorage.setItem('hk-radio-favorites', JSON.stringify(favorites.filter(id => !hiddenIds.has(id))));
      }
    } catch {}
  }

  cleanStoredIds();

  const policyReady = originalFetch('./political-sensitivity.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(policy => {
      if (Array.isArray(policy?.high)) hiddenIds = new Set(policy.high.map(item => item.id).filter(Boolean));
      cleanStoredIds();
      return hiddenIds;
    })
    .catch(() => hiddenIds);

  window.__contentPolicy = {
    ready: policyReady,
    isHidden: id => hiddenIds.has(id)
  };

  window.fetch = async function policyFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isStationCatalog = /(?:^|\/)stations\.json(?:[?#]|$)/.test(url);
    if (!isStationCatalog) return originalFetch(input, init);

    await policyReady;
    const response = await originalFetch(input, init);
    if (!response.ok) return response;

    try {
      const stations = await response.clone().json();
      if (!Array.isArray(stations)) return response;
      const additions = await originalFetch('./stations-additions.json', { cache: 'no-store' })
        .then(extra => extra.ok ? extra.json() : [])
        .catch(() => []);
      const merged = [...new Map([
        ...stations,
        ...(Array.isArray(additions) ? additions : [])
      ].map(station => [station.id, station])).values()];
      const filtered = merged.filter(station => !hiddenIds.has(station?.id));
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };
})();
