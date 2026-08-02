export const VIEWPORT_CASES = Object.freeze([
  Object.freeze({ name: 'mobile', width: 360, mode: 'stacked' }),
  Object.freeze({ name: 'tablet', width: 768, mode: 'split' }),
  Object.freeze({ name: 'desktop', width: 1280, mode: 'wide' })
]);

export const HOSTILE_LAYOUT_CASES = Object.freeze([
  Object.freeze({ name: 'narrow-320', width: 320, zoom: 1, mode: 'stacked' }),
  Object.freeze({ name: 'zoom-200', width: 768, zoom: 2, mode: 'stacked' }),
  Object.freeze({ name: 'zoom-400', width: 1280, zoom: 4, mode: 'stacked' }),
  Object.freeze({ name: 'wide-graph', width: 1440, zoom: 1, mode: 'wide' })
]);

export function getLayoutMode(width) {
  const value = Number(width);
  if (Number.isNaN(value) || value < 600) return 'stacked';
  if (value < 900) return 'split';
  return 'wide';
}

export function getLayoutModeForViewport({ width, zoom = 1 } = {}) {
  const physical = Number(width);
  const scale = Number(zoom);
  const safeWidth = Number.isFinite(physical) && physical > 0 ? physical : 0;
  const safeZoom = Number.isFinite(scale) && scale >= 1 ? Math.min(scale, 4) : 1;
  return getLayoutMode(safeWidth / safeZoom);
}
