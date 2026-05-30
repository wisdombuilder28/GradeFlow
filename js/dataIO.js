/**
 * dataIO.js — Data Export / Import system.
 *
 * Export: serialises state.subjects → JSON → Blob → download link.
 * Import: reads a JSON file → validates structure → restores subjects.
 *
 * Uses only Web APIs: Blob, URL.createObjectURL, FileReader.
 * No external dependencies.
 */

import { state, setState } from './state.js';
import { saveSubjects }    from './storage.js';

// ─── EXPORT ───────────────────────────────────────────────────
/**
 * Download all subjects as a formatted JSON file.
 * Filename includes date for easy identification.
 */
export function exportData() {
  const { subjects } = state;

  if (!subjects.length) {
    // Caller (app.js) should show a toast for this, but we return false
    // so the caller knows nothing was exported.
    return false;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    version:    1,
    subjects,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  const anchor    = document.createElement('a');
  anchor.href     = url;
  anchor.download = `gradeflow-export-${_dateStamp()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up the object URL after the browser has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

// ─── IMPORT ───────────────────────────────────────────────────
/**
 * Read, validate, and restore subjects from a JSON File object.
 *
 * @param {File} file - The JSON file selected by the user.
 * @param {Function} onSuccess - Called with the imported subjects array.
 * @param {Function} onError   - Called with a human-readable error string.
 */
export function importData(file, onSuccess, onError) {
  if (!file) return onError('No file selected.');

  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    return onError('Invalid file type. Please select a .json file.');
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);

      // ── Structural validation ──────────────────────────────
      // Accept both the wrapper format { version, subjects: [] }
      // and a bare array for backwards compatibility.
      let subjects;

      if (Array.isArray(raw)) {
        subjects = raw;
      } else if (raw && Array.isArray(raw.subjects)) {
        subjects = raw.subjects;
      } else {
        return onError('Invalid format: expected a JSON array or an object with a "subjects" array.');
      }

      if (subjects.length === 0) {
        return onError('The file contains no subjects to import.');
      }

      // ── Per-record validation ──────────────────────────────
      const clean = [];
      for (const [i, s] of subjects.entries()) {
        if (typeof s.name  !== 'string' || !s.name.trim()) {
          return onError(`Record ${i + 1}: missing or invalid "name" field.`);
        }
        if (typeof s.score !== 'number' || s.score < 0 || s.score > 100) {
          return onError(`Record ${i + 1} ("${s.name}"): "score" must be a number between 0–100.`);
        }
        clean.push({
          id:        typeof s.id === 'number' ? s.id : Date.now() + i,
          name:      s.name.trim(),
          score:     s.score,
          createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
        });
      }

      // ── Commit ────────────────────────────────────────────
      setState({ subjects: clean });
      saveSubjects();
      onSuccess(clean);

    } catch {
      onError('Could not parse file. Make sure it is valid JSON.');
    }
  };

  reader.onerror = () => onError('Could not read the file. Please try again.');
  reader.readAsText(file);
}

// ─── HELPERS ──────────────────────────────────────────────────
function _dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
