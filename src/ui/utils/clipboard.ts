/**
 * Robust clipboard copy helper for Figma plugin iframe environments.
 * Uses synchronous textarea execCommand('copy') with navigator.clipboard fallback.
 */
export function copyToClipboard(text: string): boolean {
  if (!text) return false;

  let success = false;

  // Method 1: document.execCommand('copy') via temporary textarea.
  // This is the most reliable method inside Figma plugin iframes
  // because it runs synchronously in the direct user click gesture.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.zIndex = '-9999';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    success = document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch (err) {
    console.warn('execCommand copy failed:', err);
  }

  // Method 2: Modern navigator.clipboard as secondary attempt
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        success = true;
      }).catch((err) => {
        console.warn('navigator.clipboard.writeText rejected:', err);
      });
    }
  } catch (err) {
    console.warn('navigator.clipboard access error:', err);
  }

  return success;
}
