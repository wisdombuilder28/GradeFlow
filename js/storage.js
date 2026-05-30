/**
 * storage.js — localStorage persistence layer.
 * Only this module is allowed to read/write localStorage directly.
 * All other modules call these functions instead of touching
 * localStorage themselves, keeping persistence logic centralized.
 */

import { state } from './state.js';

const SUBJECTS_KEY = 'gradeflow_subjects';
const THEME_KEY    = 'gradeflow_theme';

// ─── SUBJECTS ─────────────────────────────────────────────────
/**
 * Persist the current subjects array from state to localStorage.
 */
export function saveSubjects() {
  try {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(state.subjects));
  } catch (e) {
    console.error('[GradeFlow:storage] Failed to save subjects:', e);
  }
}

/**
 * Load subjects from localStorage.
 * Returns an empty array on any parse failure.
 * @returns {Array}
 */
export function loadSubjects() {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Basic shape validation
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) => typeof s.id === 'number' && typeof s.name === 'string' && typeof s.score === 'number'
    );
  } catch (e) {
    console.warn('[GradeFlow:storage] Corrupted subjects data — resetting.', e);
    return [];
  }
}

// ─── THEME ────────────────────────────────────────────────────
/**
 * Persist the theme preference.
 * @param {string} theme — 'dark' | 'light'
 */
export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

/**
 * Load the stored theme preference.
 * Defaults to 'dark' if nothing is stored.
 * @returns {string}
 */
export function loadTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}
