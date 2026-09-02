(() => {
  const STATE_KEY = 'web-radio-player-state';
  const SLEEP_KEY = 'web-radio-sleep-ends-at';
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  const playerInner = player?.querySelector('.player-inner');
  const volume = document.querySelector('#volumeControl');
  const search = document.querySelector('#searchInput');
  const stationList = document.querySelector('#stationList');
  let sleepTimer = null;
  let fadeTimer = null;

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function saveState(patch) {
    const next = { ...loadState(), ...patch };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
    return next;
  }

  function currentStationId() {
    return stationList?.querySelector('.station.is-playing [data-play]')?.dataset.play || loadState().stationId || null;
  }

  function visiblePlayableIds() {
    return [...stationList.querySelectorAll('.station [data-play]')].map(button => button.dataset.play);
  }

  function playById(id) {
    if (!id || typeof window.playStation !== 'function') return;
    saveState({ stationId: id });
    window.playStation(id);
  }

  function stepStation(direction) {
    const ids = visiblePlayableIds();
    if (!ids.length) return;
    const current = currentStationId();
    const index = Math.max(0, ids.indexOf(current));
    const nextIndex = (index + direction + ids.length) % ids.length;
    playById(ids[nextIndex]);
  }

  function playRandom() {
    const current = currentStationId();
    const ids = visiblePlayableIds().filter(id => id !== current);
    if (!ids.length) return;
    playById(ids[Math.floor(Math.random() * ids.length)]);
  }

  function buildControls() {
    if (!playerInner || document.querySelector('#stationNavigation')) return;
    const navigation = document.createElement('div');
    navigation.id = 'stationNavigation';
    navigation.className = 'station-navigation';
    navigation.innerHTML = `
      <button type="button" data-station-action="previous" aria-label="上一個電台">◀</button>
      <button type="button" data-station-action="random" aria-label="隨機電台">⤨</button>
      <button type="button" data-station-action="next" aria-label="下一個電台">▶</button>
    `;

    const sleep = document.createElement('div');
    sleep.className = 'sleep-control';
    sleep.innerHTML = `
      <label>
        <span>睡眠</span>
        <select id="sleepTimerSelect" aria-label="睡眠定時器">
          <option value="">關閉</option>
          <option value="15">15 分鐘</option>
          <option value="30">30 分鐘</option>
          <option value="45">45 分鐘</option>
          <option value="60">60 分鐘</option>
          <option value="90">90 分鐘</option>
          <option value="120">120 分鐘</option>
        </select>
      </label>
      <span id="sleepTimerStatus" class="sleep-timer-status"></span>
    `;

    const nowPlaying = playerInner.querySelector('.now-playing');
    nowPlaying?.after(navigation);
    const volumeControl = playerInner.querySelector('.volume');
    volumeControl?.before(sleep);
  }

  function restoreFilters() {
    const saved = loadState();
    if (typeof saved.volume === 'number' && volume) {
      volume.value = String(saved.volume);
      volume.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (typeof saved.query === 'string' && search) {
      search.value = saved.query;
      search.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const clickSaved = (selector, value) => {
      if (!value) return;
      const target = [...document.querySelectorAll(selector)].find(button => Object.values(button.dataset).includes(value));
      target?.click();
    };
    clickSaved('[data-region]', saved.region);
    clickSaved('[data-content]', saved.content);
    clickSaved('[data-genre]', saved.genre);
    if (saved.favoritesOnly && document.querySelector('#favoritesToggle')?.getAttribute('aria-pressed') !== 'true') {
      document.querySelector('#favoritesToggle')?.click();
    }
  }

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const id = currentStationId();
    const card = id ? stationList.querySelector(`[data-play="${CSS.escape(id)}"]`)?.closest('.station') : null;
    const title = card?.querySelector('.station-name')?.textContent?.trim() || document.querySelector('#nowName')?.textContent || 'Web Radio';
    const artist = card?.querySelector('.station-meta')?.textContent?.replace(/\s+/g, ' ')?.trim() || 'Web Radio';
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Web Radio' });
    navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
  }

  function registerMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
      play: () => audio.play(),
      pause: () => audio.pause(),
      previoustrack: () => stepStation(-1),
      nexttrack: () => stepStation(1)
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (error) {}
    });
  }

  function clearSleepTimer() {
    localStorage.removeItem(SLEEP_KEY);
    if (sleepTimer) window.clearInterval(sleepTimer);
    sleepTimer = null;
    const select = document.querySelector('#sleepTimerSelect');
    const status = document.querySelector('#sleepTimerStatus');
    if (select) select.value = '';
    if (status) status.textContent = '';
  }

  function fadeAndPause() {
    if (fadeTimer) window.clearInterval(fadeTimer);
    const original = Number(volume?.value || audio.volume || 0.85);
    let level = audio.volume;
    fadeTimer = window.setInterval(() => {
      level = Math.max(0, level - 0.08);
      audio.volume = level;
      if (level <= 0) {
        window.clearInterval(fadeTimer);
        fadeTimer = null;
        audio.pause();
        audio.volume = original;
        if (volume) volume.value = String(original);
        document.querySelector('#playerStatus').textContent = '睡眠定時器已結束';
        clearSleepTimer();
      }
    }, 250);
  }

  function updateSleepTimer() {
    const endsAt = Number(localStorage.getItem(SLEEP_KEY) || 0);
    const status = document.querySelector('#sleepTimerStatus');
    if (!endsAt) {
      if (status) status.textContent = '';
      return;
    }
    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      fadeAndPause();
      return;
    }
    const minutes = Math.ceil(remaining / 60000);
    if (status) status.textContent = `剩餘 ${minutes} 分鐘`;
  }

  function setSleepTimer(minutes) {
    if (!minutes) {
      clearSleepTimer();
      return;
    }
    localStorage.setItem(SLEEP_KEY, String(Date.now() + Number(minutes) * 60000));
    if (sleepTimer) window.clearInterval(sleepTimer);
    sleepTimer = window.setInterval(updateSleepTimer, 15000);
    updateSleepTimer();
  }

  document.addEventListener('click', event => {
    const play = event.target.closest('[data-play]');
    if (play) {
      saveState({ stationId: play.dataset.play });
      window.setTimeout(updateMediaSession, 0);
    }
    const action = event.target.closest('[data-station-action]')?.dataset.stationAction;
    if (action === 'previous') stepStation(-1);
    if (action === 'next') stepStation(1);
    if (action === 'random') playRandom();
    const region = event.target.closest('[data-region]')?.dataset.region;
    const content = event.target.closest('[data-content]')?.dataset.content;
    const genre = event.target.closest('[data-genre]')?.dataset.genre;
    if (region) saveState({ region });
    if (content) saveState({ content });
    if (genre) saveState({ genre });
    if (event.target.closest('#favoritesToggle')) {
      window.setTimeout(() => saveState({ favoritesOnly: document.querySelector('#favoritesToggle')?.getAttribute('aria-pressed') === 'true' }), 0);
    }
  });

  search?.addEventListener('input', event => saveState({ query: event.target.value }));
  volume?.addEventListener('input', event => saveState({ volume: Number(event.target.value) }));
  audio?.addEventListener('playing', updateMediaSession);
  audio?.addEventListener('pause', updateMediaSession);
  document.addEventListener('visibilitychange', updateSleepTimer);
  window.addEventListener('pageshow', updateSleepTimer);

  buildControls();
  registerMediaSession();

  const sleepSelect = document.querySelector('#sleepTimerSelect');
  sleepSelect?.addEventListener('change', event => setSleepTimer(event.target.value));

  const observer = new MutationObserver(() => {
    if (!stationList.querySelector('.station')) return;
    observer.disconnect();
    restoreFilters();
  });
  observer.observe(stationList, { childList: true });

  const existingSleep = Number(localStorage.getItem(SLEEP_KEY) || 0);
  if (existingSleep > Date.now()) {
    sleepTimer = window.setInterval(updateSleepTimer, 15000);
    updateSleepTimer();
  } else if (existingSleep) {
    clearSleepTimer();
  }
})();
