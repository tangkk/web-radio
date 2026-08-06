(() => {
  const ARTWORK_URL = 'https://avatars.githubusercontent.com/u/1814604?v=4&s=1024';
  const audio = document.querySelector('#audio');
  let applyTimer = null;

  function applyArtwork() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    const current = navigator.mediaSession.metadata;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current?.title || document.querySelector('#nowName')?.textContent || 'Web Radio',
      artist: current?.artist || 'Web Radio',
      album: current?.album || 'Web Radio',
      artwork: [
        { src: ARTWORK_URL, sizes: '1024x1024', type: 'image/jpeg' }
      ]
    });
  }

  function scheduleArtwork() {
    if (applyTimer) window.clearTimeout(applyTimer);
    applyTimer = window.setTimeout(applyArtwork, 150);
  }

  audio?.addEventListener('loadedmetadata', scheduleArtwork);
  audio?.addEventListener('play', scheduleArtwork);
  audio?.addEventListener('playing', scheduleArtwork);
  audio?.addEventListener('pause', scheduleArtwork);

  document.addEventListener('click', event => {
    if (event.target.closest('[data-play], [data-recent-play], [data-resume-station], [data-station-action], #playToggle')) {
      scheduleArtwork();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleArtwork();
  });
})();
