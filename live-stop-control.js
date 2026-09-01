(() => {
  const audio = document.querySelector('#audio');
  const playToggle = document.querySelector('#playToggle');
  if (!audio || !playToggle) return;

  function renderStopControl() {
    playToggle.textContent = '■';
    playToggle.setAttribute('aria-label', '停止');
  }

  function stopLive(reason = 'manual stop') {
    if (typeof window.debug === 'function') window.debug('Live stop', reason);
    if (typeof window.stopPlayer === 'function') window.stopPlayer();
    else {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    try { navigator.mediaSession.playbackState = 'none'; } catch {}
  }

  // app.js owns the initial play action. While live audio is playing, this
  // capture listener replaces its pause branch with a true stop.
  playToggle.addEventListener('click', event => {
    if (audio.paused) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopLive('player stop button');
  }, true);

  // app.js renders a pause glyph on `playing`; override it with Stop.
  audio.addEventListener('playing', renderStopControl);

  // OS lock-screen/headset controls may expose only a pause action. Give that
  // action stop semantics for live radio, and expose stop explicitly when the
  // platform supports it.
  if ('mediaSession' in navigator) {
    try { navigator.mediaSession.setActionHandler('pause', () => stopLive('media session pause')); } catch {}
    try { navigator.mediaSession.setActionHandler('stop', () => stopLive('media session stop')); } catch {}
  }
})();
