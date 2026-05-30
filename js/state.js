/**
 * state.js — Single source of truth for all runtime data.
 *
 * Architecture note: All modules read from this object. Only
 * setState() should mutate it, keeping updates predictable.
 */

export const state = {
  subjects:         [],   // Array<{ id, name, score, createdAt }>
  filteredSubjects: [],   // Derived view (after search/filter/sort)
  currentSection:   'dashboard',
  theme:            'dark',

  // Sort / filter state (Phase 4)
  sortKey:     'recently-added', // 'recently-added' | 'highest-score' | 'lowest-score' | 'alpha-az' | 'alpha-za'
  filterGrade: 'all',            // 'all' | 'A' | 'B' | 'C' | 'D' | 'F'
  searchQuery: ''
};

/**
 * Shallow-merge updates into state.
 * @param {Partial<typeof state>} updates
 */
export function setState(updates) {
  Object.assign(state, updates);
}
