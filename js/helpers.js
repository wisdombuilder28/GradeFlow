/**
 * helpers.js — Pure utility functions.
 * No side effects. No imports from other local modules.
 * Safe to import anywhere without risk of circular dependencies.
 */

// ─── XSS PROTECTION ───────────────────────────────────────────
/**
 * Escape a string for safe HTML insertion.
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ─── TIMING ───────────────────────────────────────────────────
/**
 * Returns a debounced version of fn that delays execution by ms.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── ID GENERATION ────────────────────────────────────────────
/**
 * Generate a unique numeric ID (timestamp + jitter).
 * @returns {number}
 */
export function generateId() {
  return Date.now() + Math.floor(Math.random() * 10_000);
}

// ─── GRADE LOGIC ──────────────────────────────────────────────
/**
 * Derive grade letter from a numeric score.
 * @param {number} score
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
export function getGrade(score) {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Human-readable descriptor for a grade letter.
 * @param {string} grade
 * @returns {string}
 */
export function getGradeLabel(grade) {
  const map = { A: 'Excellent', B: 'Good', C: 'Average', D: 'Below Average', F: 'Failing' };
  return map[grade] ?? '';
}

/**
 * CSS color value for a score (reads live CSS custom properties).
 * @param {number} score
 * @returns {string}
 */
export function getScoreColor(score) {
  const s = getComputedStyle(document.documentElement);
  const v = (k) => s.getPropertyValue(k).trim();
  if (score >= 70) return v('--cyan')  || '#0dd4b8';
  if (score >= 60) return v('--blue')  || '#4f8ef7';
  if (score >= 50) return v('--amber') || '#fbbf24';
  if (score >= 40) return '#fb923c';
  return v('--red') || '#f87171';
}

// ─── VALIDATION ───────────────────────────────────────────────
/**
 * Validate a subject name + score pair.
 * @param {string} name
 * @param {string|number} score
 * @returns {string|null} Error message, or null if valid.
 */
export function validateSubject(name, score) {
  if (!name || name.trim().length < 2) return 'Subject name must be at least 2 characters.';
  if (name.trim().length > 60)         return 'Subject name must be under 60 characters.';
  if (score === '' || score == null)   return 'Please enter a score.';
  const n = Number(score);
  if (isNaN(n))  return 'Score must be a valid number.';
  if (n < 0)     return 'Score cannot be negative.';
  if (n > 100)   return 'Score cannot exceed 100.';
  return null;
}

// ─── DATE FORMATTING ──────────────────────────────────────────
/**
 * Format a Unix timestamp into a readable date string.
 * @param {number} ts
 * @returns {string}
 */
export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}
