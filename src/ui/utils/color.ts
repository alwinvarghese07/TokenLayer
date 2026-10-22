import type { TokenModeValue } from '../../shared/messages';

/**
 * Formats a color mode value strictly as a hex string (#RRGGBB or #RRGGBBAA).
 * Properly includes the alpha channel in 8-digit hex format when alpha < 1.
 */
export function formatHexColor(modeVal?: TokenModeValue): string {
  if (!modeVal) return '';

  // 1. Check if colorRgba has an alpha value < 1
  if (modeVal.colorRgba) {
    const match = modeVal.colorRgba.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
    );
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

      const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, '0')
          .toUpperCase();

      if (a < 0.999) {
        const alphaHex = Math.max(0, Math.min(255, Math.round(a * 255)))
          .toString(16)
          .padStart(2, '0')
          .toUpperCase();
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
      } else {
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }
    }
  }

  // 2. Direct colorHex
  if (modeVal.colorHex) {
    const match = modeVal.colorHex.match(/#[0-9a-fA-F]{3,8}/);
    if (match) {
      let hex = match[0].toUpperCase();
      // Expand shorthand #RGB or #RGBA if any
      if (hex.length === 4) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
      } else if (hex.length === 5) {
        hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}${hex[4]}${hex[4]}`;
      }
      return hex;
    }
    return modeVal.colorHex.trim().toUpperCase();
  }

  return '';
}
