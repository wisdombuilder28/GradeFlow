/**
 * subjects.js — Subject CRUD operations.
 *
 * Responsibilities:
 *  - Mutate state.subjects
 *  - Persist to localStorage via storage.js
 *
 * Explicitly NOT responsible for:
 *  - Triggering UI re-renders (app.js orchestrates that)
 *  - DOM access
 *  - Validation (helpers.js)
 */

import { state, setState } from './state.js';
import { saveSubjects }    from './storage.js';
import { generateId }      from './helpers.js';

// ─── CREATE ───────────────────────────────────────────────────
/**
 * Add a new subject to the front of the list.
 * @param {string} name
 * @param {string|number} score
 * @returns {{ id: number, name: string, score: number, createdAt: number }}
 */
export function addSubject(name, score) {
  const subject = {
    id:        generateId(),
    name:      name.trim(),
    score:     Number(score),
    createdAt: Date.now(),
  };
  setState({ subjects: [subject, ...state.subjects] });
  saveSubjects();
  return subject;
}

// ─── DELETE ───────────────────────────────────────────────────
/**
 * Remove a subject by ID.
 * @param {number} id
 */
export function deleteSubject(id) {
  setState({ subjects: state.subjects.filter((s) => s.id !== id) });
  saveSubjects();
}

// ─── UPDATE ───────────────────────────────────────────────────
/**
 * Update a subject's name and score in-place.
 * @param {number} id
 * @param {string} name
 * @param {string|number} score
 * @returns {boolean} true if found and updated, false otherwise
 */
export function updateSubject(id, name, score) {
  const idx = state.subjects.findIndex((s) => s.id === id);
  if (idx === -1) return false;

  const updated = [...state.subjects];
  updated[idx]  = { ...updated[idx], name: name.trim(), score: Number(score) };
  setState({ subjects: updated });
  saveSubjects();
  return true;
}

// ─── READ ─────────────────────────────────────────────────────
/**
 * Find a single subject by ID.
 * @param {number} id
 * @returns {object|undefined}
 */
export function findSubjectById(id) {
  return state.subjects.find((s) => s.id === id);
}
