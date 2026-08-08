(() => {
  const audio = document.querySelector('#audio');
  const player = document.querySelector('#player');
  if (!audio || !player) return;

  const CHECK_DELAY_MS = 1800;
  const MIN_PROGRESS_SECONDS = 0.4;
  const REPAIR_COOLDOWN_MS = 5000;

  let hasPlayed = false;
  let pausedAfterPlayback = false;
  let checkTimer = null;
  let lastRepairAt = 0;

  function debug(message, detail) {
    if (typeof window.debug === 'function') window.debug(message, detail);
  }

  function currentStationId() {
    return document.querySelector('.station.is-playing [data-play]')?.dataset.play || null;
  }

  function clearCheck() {
    if (checkTimer) window.clearTimeout(checkTimer);
    checkTimer = null;
  }

  function scheduleResumeCheck() {
    clearCheck();
    const id = currentStationId();
    if (!id || typeof window.playStation !== 'function' || player.hidden) return;

    const startedAt = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    checkTimer = window.setTimeout(async () => {
      checkTimer = null;
      if (player.hidden || audio.paused) return;

      const now = Date.now();
      if (now - lastRepairAt < REPAIR_COOLDOWN_MS) return;

      const current = Number.isFinite(audio.currentTime) ? audio.currentTime : startedAt;
      const progressed = current - startedAt;
      const healthy = audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && progressed >= MIN_PROGRESS_SECONDS;
      if (healthy) return;

      lastRepairAt = now;
      debug('Resume watchdog rebuilding live stream', {
        station: id,
        readyState: audio.readyState,
        networkState: audio.networkState,
        progressed
      });

      try {
        await window.playStation(id);
      } catch (error) {
        debug('Resume watchdog rebuild failed', { name: error?.name, message: error?.message });
      }
    }, CHECK_DELAY_MS);
  }

  audio.addEventListener('playing', () => {
    hasPlayed = true;
    if (pausedAfterPlayback) {
      pausedAfterPlayback = false;
      scheduleResumeCheck();
    }
  });

  audio.addEventListener('pause', () => {
    clearCheck();
    if (hasPlayed && !player.hidden && currentStationId()) pausedAfterPlayback = true;
  });

  audio.addEventListener('ended', clearCheck);
  audio.addEventListener('emptied', clearCheck);
})();
