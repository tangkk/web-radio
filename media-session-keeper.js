(() => {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

  const audio = document.querySelector('#audio');
  const nowName = document.querySelector('#nowName');
  const player = document.querySelector('#player');
  if (!audio || !nowName) return;

  const ARTWORK_URL = 'https://avatars.githubusercontent.com/u/1814604?v=4&s=1024';
  let lastTitle = '';

  function currentTitle() {
    const text = nowName.textContent?.trim();
    return text && text !== '—' ? text : lastTitle || 'Web Radio';
  }

  function refreshMetadata() {
    if (player?.hidden) return;
    const title = currentTitle();
    if (title) lastTitle = title;

    const current = navigator.mediaSession.metadata;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: current?.artist || 'Web Radio',
      album: current?.album || 'LIVE Radio',
      artwork: current?.artwork?.length ? current.artwork : [
        { src: ARTWORK_URL, sizes: '1024x1024', type: 'image/jpeg' }
      ]
    });

    try {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    } catch {}
  }

  function syncPlaybackState() {
    try {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
    } catch {}
  }

  ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled'].forEach(eventName => {
    audio.addEventListener(eventName, () => {
      refreshMetadata();
      syncPlaybackState();
    });
  });

  const observer = new MutationObserver(() => refreshMetadata());
  observer.observe(nowName, { childList: true, subtree: true, characterData: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshMetadata();
  });
  window.addEventListener('pageshow', refreshMetadata);
  window.addEventListener('online', refreshMetadata);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-play], [data-recent-play], [data-resume-station], [data-station-action], #playToggle')) {
      setTimeout(refreshMetadata, 0);
      setTimeout(refreshMetadata, 250);
    }
  }, true);
})();
