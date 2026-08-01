export const VIEWPORT_CASES = Object.freeze([
  Object.freeze({ name: 'mobile', width: 360, mode: 'stacked' }),
  Object.freeze({ name: 'tablet', width: 768, mode: 'split' }),
  Object.freeze({ name: 'desktop', width: 1280, mode: 'wide' })
]);

export function getLayoutMode(width) {
  const value = Number(width);
  if (Number.isNaN(value) || value < 600) return 'stacked';
  if (value < 900) return 'split';
  return 'wide';
}
