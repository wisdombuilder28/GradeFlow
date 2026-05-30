/**
 * theme.js — Theme management.
 * Applies the theme to the document root and persists the preference.
 */

import { state, setState } from './state.js';
import { saveTheme }       from './storage.js';

/**
 * Toggle between 'dark' and 'light' theme.
 */
export function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/**
 * Apply a specific theme: mutates state, updates DOM, and persists.
 * Also syncs the <meta name="theme-color"> for PWA chrome.
 * @param {'dark'|'light'} theme
 */
export function applyTheme(theme) {
  setState({ theme });
  document.documentElement.setAttribute('data-theme', theme);
  saveTheme(theme);

  // Sync PWA browser chrome colour with active theme
  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#0dd4b8' : '#059c86');
  }
}
