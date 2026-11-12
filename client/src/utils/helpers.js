export const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';

// Shortcut kanvas tidak boleh jalan saat user sedang mengetik
export const isTypingTarget = (el) =>
  Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)));
