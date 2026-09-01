(() => {
  const audio = document.querySelector('#audio');
  const playToggle = document.querySelector('#playToggle');
  const player = document.querySelector('#player');
  const status = document.querySelector('#playerStatus');
  if (!audio || !playToggle || !player) return;

  function renderStopControl() {
    playToggle.textContent = '■';
    playToggle.setAttribute('aria-label', '停止');
  }

  function renderPlayControl() {
    playToggle.textContent = '▶';
    playToggle.setAttribute('aria-label', '播放');
  }

  function stopLive(reason = 'manual stop') {
    const station = typeof state !== 'undefined' ? state.current : null;
    if (!station) return;

    if (typeof window.debug === 'function') window.debug('Live stop', reason);
    audio.pause();
    if (typeof destroyHls === 'function') destroyHls();
    audio.removeAttribute('src');
    audio.load();

    // Keep the selected station and player bar visible. Only the × button uses
    // stopPlayer(), which clears state.current and closes the player bar.
    if (typeof state !== 'undefined') state.current = null;
    if (typeof renderStations === 'function') renderStations();
    if (typeof state !== 'undefined') state.current = station;
    player.hidden = false;
    if (status) status.textContent = '已停止';
    renderPlayControl();

    document.dispatchEvent(new CustomEvent('web-radio:stopped', { detail: { reason, stationId: station.id } }));
    try { navigator.mediaSession.playbackState = 'none'; } catch {}
  }

  async function restartLive() {
    const station = typeof state !== 'undefined' ? state.current : null;
    if (!station || typeof playStation !== 'function') return;
    await playStation(station.id);
  }

  // Replace app.js's pause/resume toggle with live-radio stop/reconnect semantics.
  playToggle.addEventListener('click', event => {
    if (typeof state === 'undefined' || !state.current) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (audio.paused) restartLive();
    else stopLive('player stop button');
  }, true);

  // app.js renders a pause glyph on `playing`; override it with Stop.
  audio.addEventListener('playing', renderStopControl);

  // OS lock-screen/headset controls may expose only a pause action. Give that
  // action stop semantics for live radio, and expose stop explicitly when the
  // platform supports it.
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.setActionHandler('pause', () => stopLive('media session pause')); } catch {}
    try { navigator.mediaSession.setActionHandler('stop', () => stopLive('media session stop')); } catch {}
    try { navigator.mediaSession.setActionHandler('play', () => restartLive()); } catch {}
  }
})();
