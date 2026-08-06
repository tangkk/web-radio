const state = {
  stations: [],
  query: '',
  region: '全部',
  content: '全部內容',
  genre: '全部風格',
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem('hk-radio-favorites') || '[]')),
  current: null,
  hls: null
};

const elements = {
  list: document.querySelector('#stationList'),
  regionFilters: document.querySelector('#regionFilters'),
  contentFilters: document.querySelector('#contentFilters'),
  genreFilters: document.querySelector('#genreFilters'),
  search: document.querySelector('#searchInput'),
  resultCount: document.querySelector('#resultCount'),
  favoritesToggle: document.querySelector('#favoritesToggle'),
  player: document.querySelector('#player'),
  audio: document.querySelector('#audio'),
  playToggle: document.querySelector('#playToggle'),
  nowName: document.querySelector('#nowName'),
  playerStatus: document.querySelector('#playerStatus'),
  volume: document.querySelector('#volumeControl'),
  closePlayer: document.querySelector('#closePlayer'),
  debugToggle: document.querySelector('#debugToggle'),
  debugPanel: document.querySelector('#debugPanel'),
  debugLog: document.querySelector('#debugLog'),
  copyDebug: document.querySelector('#copyDebug'),
  clearDebug: document.querySelector('#clearDebug'),
  channelTotal: document.querySelector('#channelTotal')
};

const debugEntries = [];

function debug(event, detail = '') {
  const timestamp = new Date().toLocaleTimeString('zh-HK', { hour12: false });
  let printable = detail;
  if (typeof detail !== 'string') {
    try { printable = JSON.stringify(detail); } catch (error) { printable = String(detail); }
  }
  const line = `[${timestamp}] ${event}${printable ? ` · ${printable}` : ''}`;
  debugEntries.push(line);
  if (debugEntries.length > 120) debugEntries.shift();
  elements.debugLog.textContent = debugEntries.join('\n');
  elements.debugLog.scrollTop = elements.debugLog.scrollHeight;
}

function normalized(value) {
  return String(value || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function visibleStations() {
  return state.stations.filter(station => {
    const haystack = normalized([station.name, station.broadcaster, station.region, station.market, station.language, station.frequency, ...(station.category || []), ...(station.genres || [])].join(' '));
    return (!state.query || haystack.includes(normalized(state.query)))
      && (state.region === '全部' || station.region === state.region)
      && matchesContent(station, state.content)
      && (state.genre === '全部風格' || (station.genres || []).includes(state.genre))
      && (!state.favoritesOnly || state.favorites.has(station.id));
  });
}

function matchesContent(station, content) {
  if (content === '全部內容') return true;
  const tags = new Set(station.category || []);
  const groups = {
    '音樂': ['音樂'],
    '新聞・談話': ['新聞', '談話', '國際'],
    '財經': ['財經'],
    '生活・公共': ['生活', '公共', '文化', '體育', '娛樂', '城市', '綜合', '交通', '長者', '華人社區']
  };
  return (groups[content] || []).some(tag => tags.has(tag));
}

function renderFilters() {
  const regions = ['全部', '中央', '京津', '廣東', '江浙滬', '香港', '台灣', '美國', '加拿大', '英國', '愛爾蘭', '法國', '瑞士', '澳大利亞', '南非'].filter(name => name === '全部' || state.stations.some(station => station.region === name));
  elements.regionFilters.innerHTML = regions.map(name => `
    <button class="chip ${state.region === name ? 'active' : ''}" type="button" data-region="${name}">${name}</button>
  `).join('');

  const contents = ['全部內容', '音樂', '新聞・談話', '財經', '生活・公共'];
  elements.contentFilters.innerHTML = contents.map(name => `
    <button class="chip ${state.content === name ? 'active' : ''}" type="button" data-content="${name}">${name}</button>
  `).join('');

  const genres = ['全部風格', '流行', '爵士', '搖滾・另類', '鄉村・根源', '古典', '電子・氛圍', '世界・混合'];
  elements.genreFilters.hidden = state.content !== '音樂';
  elements.genreFilters.innerHTML = genres.map(name => `
    <button class="chip ${state.genre === name ? 'active' : ''}" type="button" data-genre="${name}">${name}</button>
  `).join('');
}

function renderStations() {
  const stations = visibleStations();
  elements.resultCount.textContent = `${stations.length} / ${state.stations.length} 條頻道`;
  elements.favoritesToggle.classList.toggle('active', state.favoritesOnly);
  elements.favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly));

  if (!stations.length) {
    elements.list.innerHTML = '<div class="empty">沒有符合條件的頻道。</div>';
    return;
  }

  elements.list.innerHTML = stations.map(station => {
    const isDirect = station.mode === 'direct';
    const isPlaying = state.current?.id === station.id;
    const isFavorite = state.favorites.has(station.id);
    const compactShortName = station.shortName.replace(/\s+/g, '');
    const markClass = compactShortName.length > 5 ? ' is-long' : '';
    const action = isDirect
      ? `<button class="listen-button" type="button" data-play="${station.id}">${isPlaying ? '正在播放' : '播放'}</button>`
      : `<a class="listen-button" href="${station.official}" target="_blank" rel="noreferrer">官方直播 ↗</a>`;

    return `
      <article class="station ${isPlaying ? 'is-playing' : ''}">
        <div class="station-mark${markClass}" aria-hidden="true">${compactShortName}</div>
        <div class="station-info">
          <h2 class="station-name">${station.name}</h2>
          <div class="station-meta">
            <i class="availability ${isDirect ? 'direct' : ''}"></i>
            <span>${station.region}</span><span>·</span><span>${station.broadcaster}</span><span>·</span><span>${station.frequency}</span>
          </div>
          ${station.genres?.length ? `<div class="station-tags">${station.genres.join(' · ')}</div>` : ''}
        </div>
        <div class="station-actions">
          <button class="icon-button ${isFavorite ? 'active' : ''}" type="button" data-favorite="${station.id}" aria-label="${isFavorite ? '取消收藏' : '收藏'} ${station.name}">${isFavorite ? '★' : '☆'}</button>
          ${action}
        </div>
      </article>`;
  }).join('');
}

function setPlayerStatus(message) {
  elements.playerStatus.textContent = message;
}

function destroyHls() {
  if (state.hls) {
    debug('HLS destroy');
    state.hls.destroy();
    state.hls = null;
  }
}

async function playStation(id) {
  const station = state.stations.find(item => item.id === id);
  if (!station?.stream) return;

  destroyHls();
  elements.audio.pause();
  elements.audio.removeAttribute('src');
  state.current = station;
  elements.player.hidden = false;
  elements.nowName.textContent = station.name;
  setPlayerStatus('正在連接官方直播…');
  debug('Station selected', { id: station.id, name: station.name, stream: station.stream });
  debug('Browser support', {
    nativeHls: Boolean(elements.audio.canPlayType('application/vnd.apple.mpegurl')),
    hlsJsLoaded: Boolean(window.Hls),
    hlsJsSupported: Boolean(window.Hls?.isSupported()),
    hlsJsVersion: window.Hls?.version || null,
    online: navigator.onLine
  });
  renderStations();

  if (station.format !== 'hls') {
    elements.audio.src = station.stream;
    elements.audio.load();
    debug('Native audio source attached', { format: station.format });
    try {
      await elements.audio.play();
    } catch (error) {
      debug('Native play rejected', { name: error.name, message: error.message });
      setPlayerStatus('點擊播放鍵開始收聽');
    }
  } else if (window.Hls?.isSupported()) {
    state.hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    state.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      debug('HLS media attached');
      state.hls.loadSource(station.stream);
      debug('HLS manifest requested', station.stream);
    });
    state.hls.on(Hls.Events.MANIFEST_LOADED, (_, data) => {
      debug('HLS manifest loaded', { levels: data.levels?.length || 0 });
    });
    state.hls.on(Hls.Events.MANIFEST_PARSED, async (_, data) => {
      debug('HLS manifest parsed', { levels: data.levels?.length || 0 });
      try {
        await elements.audio.play();
      } catch (error) {
        debug('HLS play rejected', { name: error.name, message: error.message });
        setPlayerStatus('點擊播放鍵開始收聽');
      }
    });
    state.hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
      debug('HLS fragment loaded', { sn: data.frag?.sn, bytes: data.frag?.stats?.loaded });
    });
    state.hls.on(Hls.Events.ERROR, (_, data) => {
      debug('HLS error', {
        type: data.type,
        details: data.details,
        fatal: data.fatal,
        responseCode: data.response?.code,
        responseText: data.response?.text,
        url: data.frag?.url || data.context?.url
      });
      if (data.fatal) {
        setPlayerStatus(`播放失敗：${data.details || data.type}`);
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) state.hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) state.hls.recoverMediaError();
      }
    });
    state.hls.attachMedia(elements.audio);
    debug('HLS.js attach requested');
  } else if (elements.audio.canPlayType('application/vnd.apple.mpegurl')) {
    elements.audio.src = station.stream;
    elements.audio.load();
    debug('Native HLS fallback attached');
    try {
      await elements.audio.play();
    } catch (error) {
      debug('Native play rejected', { name: error.name, message: error.message });
      setPlayerStatus('點擊播放鍵開始收聽');
    }
  } else {
    debug('Unsupported browser', 'Neither native HLS nor HLS.js is available');
    setPlayerStatus('這個瀏覽器不支援 HLS 直播');
  }
}

function stopPlayer() {
  elements.audio.pause();
  destroyHls();
  elements.audio.removeAttribute('src');
  state.current = null;
  elements.player.hidden = true;
  renderStations();
}

elements.list.addEventListener('click', event => {
  const playButton = event.target.closest('[data-play]');
  if (playButton) playStation(playButton.dataset.play);

  const favoriteButton = event.target.closest('[data-favorite]');
  if (favoriteButton) {
    const id = favoriteButton.dataset.favorite;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    localStorage.setItem('hk-radio-favorites', JSON.stringify([...state.favorites]));
    renderStations();
  }
});

elements.regionFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-region]');
  if (!button) return;
  state.region = button.dataset.region;
  renderFilters();
  renderStations();
});

elements.contentFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-content]');
  if (!button) return;
  state.content = button.dataset.content;
  if (state.content !== '音樂') state.genre = '全部風格';
  renderFilters();
  renderStations();
});

elements.genreFilters.addEventListener('click', event => {
  const button = event.target.closest('[data-genre]');
  if (!button) return;
  state.genre = button.dataset.genre;
  renderFilters();
  renderStations();
});

elements.search.addEventListener('input', event => {
  state.query = event.target.value;
  renderStations();
});

elements.favoritesToggle.addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  renderStations();
});

elements.playToggle.addEventListener('click', () => {
  debug('Play toggle clicked', { paused: elements.audio.paused, readyState: elements.audio.readyState, networkState: elements.audio.networkState });
  if (elements.audio.paused) elements.audio.play().catch(error => {
    debug('Manual play rejected', { name: error.name, message: error.message });
    setPlayerStatus(`播放失敗：${error.name}`);
  });
  else elements.audio.pause();
});

elements.volume.addEventListener('input', event => {
  elements.audio.volume = Number(event.target.value);
});

elements.closePlayer.addEventListener('click', stopPlayer);
elements.debugToggle.addEventListener('click', () => {
  const open = elements.debugPanel.hidden;
  elements.debugPanel.hidden = !open;
  elements.debugToggle.classList.toggle('active', open);
  elements.debugToggle.setAttribute('aria-expanded', String(open));
});
elements.clearDebug.addEventListener('click', () => {
  debugEntries.length = 0;
  elements.debugLog.textContent = '';
});
elements.copyDebug.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(debugEntries.join('\n'));
    elements.copyDebug.textContent = '已複製';
    setTimeout(() => { elements.copyDebug.textContent = '複製記錄'; }, 1200);
  } catch (error) {
    debug('Copy failed', error.message);
  }
});
elements.audio.addEventListener('playing', () => {
  debug('Audio playing', { currentTime: elements.audio.currentTime, readyState: elements.audio.readyState });
  elements.playToggle.textContent = 'Ⅱ';
  elements.playToggle.setAttribute('aria-label', '暫停');
  setPlayerStatus('官方直播 · LIVE');
});
elements.audio.addEventListener('pause', () => {
  debug('Audio paused', { currentTime: elements.audio.currentTime, readyState: elements.audio.readyState });
  elements.playToggle.textContent = '▶';
  elements.playToggle.setAttribute('aria-label', '播放');
  if (state.current) setPlayerStatus('已暫停');
});
elements.audio.addEventListener('waiting', () => {
  debug('Audio waiting', { currentTime: elements.audio.currentTime, readyState: elements.audio.readyState });
  setPlayerStatus('緩衝中…');
});
elements.audio.addEventListener('canplay', () => debug('Audio canplay', { readyState: elements.audio.readyState }));
elements.audio.addEventListener('error', () => {
  const mediaError = elements.audio.error;
  debug('Audio error', { code: mediaError?.code, message: mediaError?.message });
  setPlayerStatus(`播放失敗：MediaError ${mediaError?.code || ''}`);
});

document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== elements.search) {
    event.preventDefault();
    elements.search.focus();
  }
  if (event.code === 'Space' && state.current && !['INPUT', 'BUTTON'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.playToggle.click();
  }
});

async function init() {
  elements.audio.volume = Number(elements.volume.value);
  debug('App initialized', { userAgent: navigator.userAgent, page: location.href });
  try {
    const response = await fetch('./stations.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.stations = await response.json();
    elements.channelTotal.textContent = `${state.stations.length} CHANNELS · LIVE`;
    renderFilters();
    renderStations();
  } catch (error) {
    elements.resultCount.textContent = '頻道資料載入失敗';
    elements.list.innerHTML = '<div class="empty">未能載入頻道資料，請重新整理頁面。</div>';
  }
}

init();
