/** Height of a table row on a touch screen: a finger needs at least 40 px. */
export const TOUCH_ROW_HEIGHT_PX = 40;
/** The header cells lose 2 px to the borders of the header. */
export const TOUCH_HEADER_HEIGHT_PX = 42;

/** For a form control (select, input, button, checkbox line): 40 px high on a touch screen. */
export const TOUCH_FIELD_CLASS = 'pointer-coarse:h-10';
export const TOUCH_LINE_CLASS = 'pointer-coarse:min-h-10';

/** True on a device whose main pointer is a finger. */
export function detectTouchScreen(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
