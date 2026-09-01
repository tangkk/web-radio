(() => {
  const audio = document.querySelector('#audio');
  const status = document.querySelector('#playerStatus');
  const player = document.querySelector('#player');
  const BACKOFF = [0, 2000, 5000, 10000, 20000, 30000];
  const STALL_TIMEOUT = 20000;
  const STABLE_PLAY_TIME = 10000;

  let shouldPlay = false;
  let reconnectTimer = null;
  let stallTimer = null;
  let stableTimer = null;
  let attempt = 0;
  let reconnecting = false;

  function log(event, detail = '') {
    if (typeof window.debug === 'function') window.debug(`Reconnect ${event}`, detail);
  }

  function savedStationId() {
    try {
      return JSON.parse(localStorage.getItem('web-radio-player-state') || '{}').stationId || null;
    } catch {
      return null;
    }
  }

  function currentStationId() {
    return document.querySelector('.station.is-playing [data-play]')?.dataset.play || savedStationId();
  }

  function clearReconnectTimer() {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function clearStallTimer() {
    if (stallTimer) window.clearTimeout(stallTimer);
    stallTimer = null;
  }

  function clearStableTimer() {
    if (stableTimer) window.clearTimeout(stableTimer);
    stableTimer = null;
  }

  function markStopped(reason) {
    shouldPlay = false;
    reconnecting = false;
    attempt = 0;
    clearReconnectTimer();
    clearStallTimer();
    clearStableTimer();
    log('disabled', reason);
  }

  function markPlayingIntent(reason) {
    shouldPlay = true;
    log('enabled', reason);
  }

  async function reconnect(reason) {
    if (!shouldPlay || reconnecting || player?.hidden) return;
    if (!navigator.onLine) {
      log('waiting for network', reason);
      if (status) status.textContent = '網絡中斷 · 等待恢復…';
      return;
    }

    const id = currentStationId();
    if (!id || typeof window.playStation !== 'function') return;

    reconnecting = true;
    clearReconnectTimer();
    clearStallTimer();
    const number = attempt + 1;
    if (status) status.textContent = `連線中斷 · 正在自動重連 ${number}`;
    log('attempt', { number, reason, station: id });

    try {
      await window.playStation(id);
    } catch (error) {
      log('attempt failed', { name: error?.name, message: error?.message });
    } finally {
      reconnecting = false;
    }
  }

  function scheduleReconnect(reason, immediate = false) {
    if (!shouldPlay || reconnecting || reconnectTimer || player?.hidden) return;
    if (!navigator.onLine) {
      if (status) status.textContent = '網絡中斷 · 等待恢復…';
      log('offline', reason);
      return;
    }

    const delay = immediate ? 0 : BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
    attempt += 1;
    if (status) status.textContent = delay
      ? `連線中斷 · ${Math.ceil(delay / 1000)} 秒後重連…`
      : '連線中斷 · 正在自動重連…';
    log('scheduled', { reason, delay, attempt });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      reconnect(reason);
    }, delay);
  }

  function scheduleStallCheck(reason) {
    if (!shouldPlay || stallTimer) return;
    clearStallTimer();
    stallTimer = window.setTimeout(() => {
      stallTimer = null;
      if (!shouldPlay || player?.hidden) return;
      if (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        scheduleReconnect(`${reason} for ${STALL_TIMEOUT / 1000}s`, true);
      }
    }, STALL_TIMEOUT);
  }

  audio?.addEventListener('playing', () => {
    reconnecting = false;
    clearReconnectTimer();
    clearStallTimer();
    clearStableTimer();
    if (!shouldPlay) shouldPlay = true;
    stableTimer = window.setTimeout(() => {
      attempt = 0;
      stableTimer = null;
      log('connection stable');
    }, STABLE_PLAY_TIME);
  });

  audio?.addEventListener('error', () => scheduleReconnect('audio error'));
  audio?.addEventListener('stalled', () => scheduleStallCheck('stalled'));
  audio?.addEventListener('waiting', () => scheduleStallCheck('waiting'));
  audio?.addEventListener('ended', () => scheduleReconnect('stream ended', true));
  audio?.addEventListener('abort', () => {
    if (shouldPlay && !reconnecting) scheduleReconnect('audio aborted');
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-play], [data-recent-play], [data-resume-station], [data-station-action]')) {
      markPlayingIntent('station selected');
      return;
    }

    if (event.target.closest('#closePlayer')) {
      markStopped('player closed');
      return;
    }

    if (event.target.closest('#playToggle')) {
      window.setTimeout(() => {
        if (audio.paused) markStopped('manual pause');
        else markPlayingIntent('manual play');
      }, 0);
    }
  });

  // The live stop control keeps the player bar open, so stop intent must be
  // communicated separately from the close-player button.
  document.addEventListener('web-radio:stopped', event => {
    markStopped(event.detail?.reason || 'live stopped');
  });

  // Preserve the existing media session on lock-screen resume. Reconnect is a fallback only.
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        markPlayingIntent('media session play');
        try { navigator.mediaSession.playbackState = 'playing'; } catch {}
        const promise = audio.play();
        if (promise?.catch) {
          promise.catch(() => scheduleReconnect('media session play failed', true));
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        markStopped('media session pause');
        try { navigator.mediaSession.playbackState = 'paused'; } catch {}
        audio.pause();
      });
    } catch {}
  }

  // The sleep timer pauses audio programmatically. Watch its status so that pause stays intentional.
  if (status) {
    new MutationObserver(() => {
      if (status.textContent.includes('睡眠定時器已結束')) markStopped('sleep timer');
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }

  window.addEventListener('offline', () => {
    clearReconnectTimer();
    if (shouldPlay && status) status.textContent = '網絡中斷 · 等待恢復…';
    log('browser offline');
  });

  window.addEventListener('online', () => {
    log('browser online');
    if (shouldPlay) scheduleReconnect('network restored', true);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldPlay && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleReconnect('page returned to foreground', true);
    }
  });

  window.addEventListener('pageshow', () => {
    if (shouldPlay && (audio.paused || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA)) {
      scheduleReconnect('page resumed', true);
    }
  });
})();
