(() => {
  const API = 'https://sync.tangkk-x2o.com/v1/radio/state';
  const SYNC_KEY = 'web-radio:sync-key';
  const RECENTS_KEY = 'web-radio-recents';
  const FAVORITES_KEY = 'hk-radio-favorites';
  const FAVORITES_UPDATED_KEY = 'web-radio:favorites-updated-at';
  const PLAYER_STATE_KEY = 'web-radio-player-state';
  const MAX_RECENTS = 10;
  const INTERVAL_MS = 30000;

  let syncing = false;
  let dirtyTimer = null;

  const readJson = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };

  const readTimestamp = key => {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  function ensureLegacyTimestamps() {
    const favorites = readJson(FAVORITES_KEY, []);
    if (Array.isArray(favorites) && favorites.length && !readTimestamp(FAVORITES_UPDATED_KEY)) {
      localStorage.setItem(FAVORITES_UPDATED_KEY, String(Date.now()));
    }

    const playerState = readJson(PLAYER_STATE_KEY, {});
    if (playerState && Object.keys(playerState).length && !Number(playerState._updatedAt)) {
      playerState._updatedAt = Date.now();
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(playerState));
    }
  }

  function recentsItem() {
    const value = readJson(RECENTS_KEY, []);
    const recents = Array.isArray(value) ? value.slice(0, MAX_RECENTS) : [];
    const updatedAt = recents.reduce((max, item) => Math.max(max, Number(item?.updatedAt) || 0), 0);
    return { key: 'recents', value: recents, updatedAt };
  }

  function localItems() {
    ensureLegacyTimestamps();
    const favorites = readJson(FAVORITES_KEY, []);
    const playerState = readJson(PLAYER_STATE_KEY, {});
    return [
      recentsItem(),
      {
        key: 'favorites',
        value: Array.isArray(favorites) ? favorites : [],
        updatedAt: readTimestamp(FAVORITES_UPDATED_KEY)
      },
      {
        key: 'playerState',
        value: playerState && typeof playerState === 'object' ? playerState : {},
        updatedAt: Number(playerState?._updatedAt) || 0
      }
    ];
  }

  function mergeRecents(localValue, remoteValue) {
    const map = new Map();
    [...(Array.isArray(localValue) ? localValue : []), ...(Array.isArray(remoteValue) ? remoteValue : [])]
      .forEach(item => {
        if (!item?.id) return;
        const current = map.get(item.id);
        if (!current || (Number(item.updatedAt) || 0) > (Number(current.updatedAt) || 0)) map.set(item.id, item);
      });
    return [...map.values()]
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))
      .slice(0, MAX_RECENTS);
  }

  function mergeItems(local, remote) {
    const remoteMap = new Map((remote || []).map(item => [item.key, item]));
    return local.map(item => {
      const other = remoteMap.get(item.key);
      if (!other) return item;
      if (item.key === 'recents') {
        const value = mergeRecents(item.value, other.value);
        return {
          key: item.key,
          value,
          updatedAt: value.reduce((max, entry) => Math.max(max, Number(entry?.updatedAt) || 0), 0)
        };
      }
      return (Number(other.updatedAt) || 0) > (Number(item.updatedAt) || 0) ? other : item;
    });
  }

  function applyItems(items) {
    const map = new Map((items || []).map(item => [item.key, item]));

    const recents = map.get('recents');
    if (recents) {
      const json = JSON.stringify(Array.isArray(recents.value) ? recents.value.slice(0, MAX_RECENTS) : []);
      if (localStorage.getItem(RECENTS_KEY) !== json) {
        localStorage.setItem(RECENTS_KEY, json);
        document.dispatchEvent(new CustomEvent('web-radio:recents-updated'));
      }
    }

    const favorites = map.get('favorites');
    if (favorites) {
      const list = Array.isArray(favorites.value) ? favorites.value : [];
      const json = JSON.stringify(list);
      const changed = localStorage.getItem(FAVORITES_KEY) !== json;
      if (changed) localStorage.setItem(FAVORITES_KEY, json);
      if (favorites.updatedAt) localStorage.setItem(FAVORITES_UPDATED_KEY, String(favorites.updatedAt));
      if (changed) {
        if (typeof state !== 'undefined') state.favorites = new Set(list);
        if (typeof renderStations === 'function') renderStations();
      }
    }

    const playerState = map.get('playerState');
    if (playerState) {
      const value = playerState.value && typeof playerState.value === 'object' ? playerState.value : {};
      const json = JSON.stringify(value);
      if (localStorage.getItem(PLAYER_STATE_KEY) !== json) {
        localStorage.setItem(PLAYER_STATE_KEY, json);
        document.dispatchEvent(new CustomEvent('web-radio:player-state-updated'));
      }
    }
  }

  async function request(method, key, body) {
    const response = await fetch(API, {
      method,
      cache: 'no-store',
      headers: {
        'X-Sync-Key': key,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function bindSyncKey(key) {
    if (!key || syncing) return;
    syncing = true;
    setStatus('正在連接同步碼…');
    try {
      const remote = await request('GET', key);
      const remoteItems = Array.isArray(remote.items) ? remote.items : [];
      localStorage.setItem(SYNC_KEY, key);
      button.textContent = '同步 ✓';

      if (remoteItems.length) {
        applyItems(remoteItems);
        setStatus('已從雲端恢復此同步碼的狀態');
      } else {
        const initial = localItems();
        const saved = await request('POST', key, { items: initial });
        applyItems(saved.items || initial);
        setStatus('已用此設備建立新的雲端狀態');
      }
    } catch (error) {
      setStatus(`同步失敗 · ${error.message}`);
    } finally {
      syncing = false;
    }
  }

  async function syncNow() {
    const key = localStorage.getItem(SYNC_KEY)?.trim();
    if (!key || syncing) return;
    syncing = true;
    setStatus('同步中…');
    try {
      const remote = await request('GET', key);
      const merged = mergeItems(localItems(), remote.items || []);
      applyItems(merged);
      const saved = await request('POST', key, { items: merged });
      applyItems(saved.items || merged);
      setStatus(`已同步 · ${new Date().toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      setStatus(`同步失敗 · ${error.message}`);
    } finally {
      syncing = false;
    }
  }

  function scheduleSync() {
    if (!localStorage.getItem(SYNC_KEY)) return;
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(syncNow, 1200);
  }

  const button = document.createElement('button');
  button.id = 'syncToggle';
  button.className = 'text-button sync-toggle';
  button.type = 'button';
  button.textContent = localStorage.getItem(SYNC_KEY) ? '同步 ✓' : '同步';
  document.querySelector('#favoritesToggle')?.after(button);

  const panel = document.createElement('div');
  panel.className = 'sync-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="sync-card" role="dialog" aria-modal="true" aria-labelledby="syncTitle">
      <button class="sync-close" type="button" aria-label="關閉">×</button>
      <h2 id="syncTitle">設備同步</h2>
      <p>同一個同步碼可同步最近播放、收藏、上次電台、音量和篩選設定。睡眠定時器只保留在本機。</p>
      <label>同步碼<input id="syncKeyInput" type="text" autocomplete="off" spellcheck="false" placeholder="輸入你的同步碼"></label>
      <div class="sync-actions">
        <button id="syncSave" type="button">從雲端恢復</button>
        <button id="syncNow" type="button">雙向同步</button>
        <button id="syncDisconnect" type="button">關閉此設備同步</button>
      </div>
      <div id="syncStatus" class="sync-status"></div>
    </div>`;
  document.body.appendChild(panel);

  const input = panel.querySelector('#syncKeyInput');
  const status = panel.querySelector('#syncStatus');

  function setStatus(text) {
    if (status) status.textContent = text;
    button.textContent = localStorage.getItem(SYNC_KEY) ? '同步 ✓' : '同步';
  }

  function openPanel() {
    input.value = localStorage.getItem(SYNC_KEY) || '';
    panel.hidden = false;
    setStatus(localStorage.getItem(SYNC_KEY) ? '此設備已開啟自動同步' : '尚未設定同步碼');
    setTimeout(() => input.focus(), 0);
  }

  function closePanel() {
    panel.hidden = true;
  }

  button.addEventListener('click', openPanel);
  panel.querySelector('.sync-close').addEventListener('click', closePanel);
  panel.addEventListener('click', event => { if (event.target === panel) closePanel(); });

  panel.querySelector('#syncSave').addEventListener('click', async () => {
    const key = input.value.trim();
    if (!key) {
      setStatus('請輸入同步碼');
      return;
    }
    await bindSyncKey(key);
  });

  panel.querySelector('#syncNow').addEventListener('click', syncNow);
  panel.querySelector('#syncDisconnect').addEventListener('click', () => {
    localStorage.removeItem(SYNC_KEY);
    button.textContent = '同步';
    setStatus('此設備已關閉同步；雲端資料沒有刪除');
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-favorite]')) {
      setTimeout(() => {
        localStorage.setItem(FAVORITES_UPDATED_KEY, String(Date.now()));
        scheduleSync();
      }, 0);
    }
  });

  document.addEventListener('web-radio:local-sync-dirty', scheduleSync);
  document.addEventListener('visibilitychange', () => syncNow());
  window.addEventListener('pagehide', syncNow);
  window.setInterval(syncNow, INTERVAL_MS);

  if (localStorage.getItem(SYNC_KEY)) setTimeout(syncNow, 800);
})();
