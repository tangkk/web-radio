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

  button.addEventListener('click', async () => {
    const source = audio.currentSrc || audio.src;
    if (!source) return;

    const original = button.textContent;
    try {
      await copyText(source);
      button.textContent = '✓';
      button.classList.add('copied');
      button.setAttribute('aria-label', '播放源地址已複製');
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove('copied');
        button.setAttribute('aria-label', '複製播放源地址');
      }, 1200);
    } catch (error) {
      button.textContent = '!';
      window.setTimeout(() => { button.textContent = original; }, 1200);
    }
  });
})();
