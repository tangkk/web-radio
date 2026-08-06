(() => {
  const STORAGE_KEY = 'web-radio-recents';
  const MAX_RECENTS = 10;

  function loadRecents() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.slice(0, MAX_RECENTS) : [];
    } catch {
      return [];
    }
  }

  function saveRecents(recents) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  }

  function getStationFromCard(id) {
    const button = document.querySelector(`[data-play="${CSS.escape(id)}"]`);
    const card = button?.closest('.station');
    return {
      id,
      name: card?.querySelector('.station-name')?.textContent?.trim() || id,
      meta: card?.querySelector('.station-meta')?.textContent?.replace(/\s+/g, ' ')?.trim() || ''
    };
  }

  function renderRecents() {
    const section = document.querySelector('#recentSection');
    const list = document.querySelector('#recentList');
    if (!section || !list) return;

    const recents = loadRecents();
    section.hidden = recents.length === 0;
    list.innerHTML = recents.map(item => `
      <button class="recent-station" type="button" data-recent-play="${item.id}">
        <span class="recent-name">${item.name}</span>
        ${item.meta ? `<span class="recent-meta">${item.meta}</span>` : ''}
      </button>
    `).join('');
  }

  function rememberStation(id) {
    const station = getStationFromCard(id);
    const recents = loadRecents().filter(item => item.id !== id);
    recents.unshift(station);
    saveRecents(recents);
    renderRecents();
  }

  document.addEventListener('click', event => {
    const normalPlay = event.target.closest('[data-play]');
    if (normalPlay) rememberStation(normalPlay.dataset.play);

    const recentPlay = event.target.closest('[data-recent-play]');
    if (!recentPlay) return;

    const id = recentPlay.dataset.recentPlay;
    rememberStation(id);
    if (typeof window.playStation === 'function') window.playStation(id);
  });

  renderRecents();
})();
