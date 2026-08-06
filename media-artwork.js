(() => {
  const ARTWORK_URL = 'https://tangkk.github.io/me.jpg';
  const audio = document.querySelector('#audio');

  function applyHighResolutionArtwork() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    const current = navigator.mediaSession.metadata;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current?.title || document.querySelector('#nowName')?.textContent || 'Web Radio',
      artist: current?.artist || 'Web Radio',
      album: current?.album || 'Web Radio',
      artwork: [
        { src: ARTWORK_URL, sizes: '512x512', type: 'image/jpeg' },
        { src: ARTWORK_URL, sizes: '1024x1024', type: 'image/jpeg' }
      ]
    });
  }

  audio?.addEventListener('playing', () => window.setTimeout(applyHighResolutionArtwork, 0));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-play], [data-recent-play], [data-resume-station], [data-station-action]')) {
      window.setTimeout(applyHighResolutionArtwork, 100);
    }
  });
})();
