(() => {
  const audio = document.querySelector('#audio');
  const button = document.querySelector('#copyStream');
  if (!audio || !button) return;

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy failed');
  }

  function originalStreamUrl() {
    if (typeof state !== 'undefined' && state.current?.stream) return state.current.stream;
    const source = audio.currentSrc || audio.src || '';
    return source.startsWith('blob:') ? '' : source;
  }

  button.addEventListener('click', async () => {
    const source = originalStreamUrl();
    if (!source) return;

    const original = button.textContent;
    try {
      await copyText(source);
      button.textContent = '✓';
      button.classList.add('copied');
      button.setAttribute('aria-label', '原始播放源地址已複製');
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('copied');
        button.setAttribute('aria-label', '複製原始播放源地址');
      }, 1200);
    } catch (error) {
      button.textContent = '!';
      window.setTimeout(() => { button.textContent = original; }, 1200);
    }
  });
})();
